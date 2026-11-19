import prisma from "@/lib/prisma";
import { bucketKey, buckets, type Period } from "@/lib/period";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type CostLine = { productId: number | null; name: string; quantity: number; cost: number };

/**
 * Costo de cada línea. Las ventas sin costo registrado (anteriores a la receta, o cuando el insumo
 * aún no tenía costo) se estiman con el costo unitario promedio de ese producto en el periodo.
 * Devuelve null para productos de los que no se conoce ningún costo.
 */
function estimateCosts<T extends CostLine>(lines: T[]) {
  const unit = new Map<string, { cost: number; units: number }>();
  const key = (l: CostLine) => (l.productId ? String(l.productId) : l.name);
  for (const l of lines) {
    if (l.cost <= 0) continue;
    const e = unit.get(key(l)) ?? { cost: 0, units: 0 };
    e.cost += l.cost;
    e.units += l.quantity;
    unit.set(key(l), e);
  }
  return lines.map((l) => {
    if (l.cost > 0) return l.cost;
    const u = unit.get(key(l));
    return u && u.units > 0 ? (u.cost / u.units) * l.quantity : null;
  });
}

// ---------------------------------------------------------------------------
// VENTAS
// ---------------------------------------------------------------------------

export async function salesSummary(period: Period) {
  const [payments, prevPayments, lines, prevLines] = await Promise.all([
    prisma.payment.findMany({ where: { createdAt: { gte: period.start, lt: period.end } }, select: { amount: true, method: true, orderId: true, createdAt: true } }),
    prisma.payment.findMany({ where: { createdAt: { gte: period.prevStart, lt: period.prevEnd } }, select: { amount: true, orderId: true } }),
    prisma.saleLine.findMany({ where: { createdAt: { gte: period.start, lt: period.end } } }),
    prisma.saleLine.aggregate({ where: { createdAt: { gte: period.prevStart, lt: period.prevEnd } }, _sum: { quantity: true } }),
  ]);

  const total = round2(payments.reduce((s, p) => s + p.amount, 0));
  const prevTotal = round2(prevPayments.reduce((s, p) => s + p.amount, 0));
  const orders = new Set(payments.map((p) => p.orderId)).size;
  const prevOrders = new Set(prevPayments.map((p) => p.orderId)).size;
  const units = lines.reduce((s, l) => s + l.quantity, 0);

  // Evolución
  const evo = new Map<string, { value: number; orders: Set<number> }>();
  for (const p of payments) {
    const k = bucketKey(period, p.createdAt);
    const e = evo.get(k) ?? { value: 0, orders: new Set<number>() };
    e.value += p.amount;
    e.orders.add(p.orderId);
    evo.set(k, e);
  }
  const series = buckets(period).map((b) => {
    const e = evo.get(b.key);
    const n = e?.orders.size ?? 0;
    return { ...b, value: round2(e?.value ?? 0), note: n ? `${n} cuenta${n === 1 ? "" : "s"}` : undefined };
  });

  // Hora del día y día de la semana (para encontrar las horas pico)
  const byHour = Array.from({ length: 24 }, () => 0);
  const byWeekday = Array.from({ length: 7 }, () => 0);
  for (const p of payments) {
    byHour[p.createdAt.getHours()] += p.amount;
    byWeekday[p.createdAt.getDay()] += p.amount;
  }
  const firstHour = byHour.findIndex((v) => v > 0);
  const lastHour = 23 - [...byHour].reverse().findIndex((v) => v > 0);
  const hours =
    firstHour < 0
      ? []
      : byHour.slice(firstHour, lastHour + 1).map((v, i) => ({
          key: String(firstHour + i),
          label: `${firstHour + i}h`,
          long: `${firstHour + i}:00 – ${firstHour + i}:59`,
          value: round2(v),
        }));
  const WEEK = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: String(d), label: WEEK[d].slice(0, 3), long: WEEK[d], value: round2(byWeekday[d]) }));

  const methods = { CASH: 0, CARD: 0 } as Record<string, number>;
  for (const p of payments) methods[p.method === "CARD" ? "CARD" : "CASH"] += p.amount;

  const channel = { MESA: 0, LLEVAR: 0 } as Record<string, number>;
  const waiters = new Map<string, { total: number; orders: Set<number> }>();
  for (const l of lines) {
    channel[l.channel] = (channel[l.channel] ?? 0) + l.total;
    const w = waiters.get(l.waiterName ?? "Sin asignar") ?? { total: 0, orders: new Set<number>() };
    w.total += l.total;
    w.orders.add(l.orderId);
    waiters.set(l.waiterName ?? "Sin asignar", w);
  }

  return {
    total,
    prevTotal,
    orders,
    prevOrders,
    avg: orders ? total / orders : 0,
    prevAvg: prevOrders ? prevTotal / prevOrders : 0,
    units,
    prevUnits: prevLines._sum.quantity ?? 0,
    series,
    hours,
    weekdays,
    methods,
    channel,
    waiters: [...waiters].map(([name, w]) => ({ name, total: round2(w.total), orders: w.orders.size })).sort((a, b) => b.total - a.total),
    payments: payments.length,
  };
}

// ---------------------------------------------------------------------------
// PRODUCTOS (con ingeniería de menú)
// ---------------------------------------------------------------------------

export type MenuClass = "estrella" | "caballo" | "rompecabezas" | "perro";

export async function productSales(period: Period) {
  const lines = await prisma.saleLine.findMany({ where: { createdAt: { gte: period.start, lt: period.end } } });
  const costs = estimateCosts(lines);
  const map = new Map<string, { name: string; category: string; units: number; total: number; net: number; cost: number; costed: boolean; combo: boolean }>();
  lines.forEach((l, i) => {
    const k = l.productId ? String(l.productId) : l.name;
    const e = map.get(k) ?? { name: l.name, category: l.categoryName, units: 0, total: 0, net: 0, cost: 0, costed: true, combo: l.isCombo };
    e.units += l.quantity;
    e.total += l.total;
    e.net += l.net;
    e.cost += costs[i] ?? 0;
    if (costs[i] === null) e.costed = false;
    map.set(k, e);
  });
  const totalSales = lines.reduce((s, l) => s + l.total, 0);
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const products = [...map.values()].map((p) => ({
    ...p,
    total: round2(p.total),
    net: round2(p.net),
    cost: round2(p.cost),
    share: totalSales ? p.total / totalSales : 0,
    profit: round2(p.net - p.cost),
    margin: p.costed && p.net > 0 ? (p.net - p.cost) / p.net : null,
    unitProfit: p.units ? (p.net - p.cost) / p.units : 0,
  }));

  // Ingeniería de menú (Kasavana y Smith): popularidad vs. contribución por plato.
  // Popular si su participación en unidades >= 70% de la participación promedio;
  // rentable si su ganancia por plato >= la ganancia promedio ponderada.
  const costed = products.filter((p) => p.costed && !p.combo);
  const cUnits = costed.reduce((s, p) => s + p.units, 0);
  const avgProfit = cUnits ? costed.reduce((s, p) => s + p.profit, 0) / cUnits : 0;
  const popularity = costed.length ? (1 / costed.length) * 0.7 : 0;
  const matrix = costed.map((p) => {
    const popular = cUnits ? p.units / cUnits >= popularity : false;
    const profitable = p.unitProfit >= avgProfit;
    const cls: MenuClass = popular ? (profitable ? "estrella" : "caballo") : profitable ? "rompecabezas" : "perro";
    return { name: p.name, units: p.units, unitProfit: p.unitProfit, cls };
  });

  const categories = new Map<string, { total: number; units: number }>();
  for (const p of products) {
    const c = categories.get(p.category) ?? { total: 0, units: 0 };
    c.total += p.total;
    c.units += p.units;
    categories.set(p.category, c);
  }

  return {
    products,
    totalSales: round2(totalSales),
    totalUnits,
    matrix,
    avgProfit,
    categories: [...categories].map(([name, c]) => ({ name, total: round2(c.total), units: c.units })).sort((a, b) => b.total - a.total),
    costedShare: totalSales ? lines.reduce((s, l, i) => s + (costs[i] !== null ? l.total : 0), 0) / totalSales : 0,
  };
}

// ---------------------------------------------------------------------------
// GANANCIAS
// ---------------------------------------------------------------------------

export async function profitSummary(period: Period) {
  const range = { gte: period.start, lt: period.end };
  const [lines, prevLines, movements, purchases] = await Promise.all([
    prisma.saleLine.findMany({
      where: { createdAt: range },
      select: { productId: true, name: true, quantity: true, total: true, net: true, tax: true, cost: true, createdAt: true },
    }),
    prisma.saleLine.aggregate({ where: { createdAt: { gte: period.prevStart, lt: period.prevEnd } }, _sum: { net: true, cost: true } }),
    prisma.stockMovement.findMany({ where: { createdAt: range, type: { in: ["WASTE", "COUNT"] } }, select: { type: true, quantity: true, unitCost: true } }),
    prisma.purchase.aggregate({ where: { status: "RECEIVED", date: range }, _sum: { total: true }, _count: true }),
  ]);
  const gross = round2(lines.reduce((s, l) => s + l.total, 0));
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
  const net = round2(lines.reduce((s, l) => s + l.net, 0));
  const est = estimateCosts(lines);
  const cost = round2(est.reduce<number>((s, c) => s + (c ?? 0), 0));
  const waste = round2(movements.filter((m) => m.type === "WASTE").reduce((s, m) => s + Math.abs(m.quantity) * m.unitCost, 0));
  // Conteo: negativo = faltó mercadería (pérdida), positivo = sobró
  const countAdj = round2(movements.filter((m) => m.type === "COUNT").reduce((s, m) => s + m.quantity * m.unitCost, 0));
  const grossProfit = round2(net - cost);
  const adjusted = round2(grossProfit - waste + Math.min(0, countAdj));
  const costedNet = round2(lines.reduce((s, l, i) => s + (est[i] !== null ? l.net : 0), 0));
  const prevNet = prevLines._sum.net ?? 0;
  const prevProfit = prevNet - (prevLines._sum.cost ?? 0);

  const evo = new Map<string, number>();
  lines.forEach((l, i) => {
    const k = bucketKey(period, l.createdAt);
    evo.set(k, (evo.get(k) ?? 0) + (l.net - (est[i] ?? 0)));
  });
  const series = buckets(period).map((b) => ({ ...b, value: round2(Math.max(0, evo.get(b.key) ?? 0)) }));

  return {
    gross,
    tax,
    net,
    cost,
    grossProfit,
    margin: net > 0 ? grossProfit / net : 0,
    foodCost: costedNet > 0 ? cost / costedNet : null,
    coverage: net > 0 ? costedNet / net : 0,
    waste,
    countAdj,
    adjusted,
    purchases: round2(purchases._sum.total ?? 0),
    purchaseCount: purchases._count,
    prevProfit,
    series,
  };
}

// ---------------------------------------------------------------------------
// IMPUESTOS (SAR): débito fiscal de ventas facturadas, crédito fiscal de compras
// ---------------------------------------------------------------------------

export async function taxSummary(period: Period) {
  const range = { gte: period.start, lt: period.end };
  const [invoices, purchases, payments, settings] = await Promise.all([
    prisma.invoice.findMany({ where: { createdAt: range }, orderBy: { sequence: "asc" } }),
    prisma.purchase.findMany({ where: { status: "RECEIVED", date: range }, include: { supplier: true } }),
    prisma.payment.findMany({ where: { createdAt: range }, include: { invoices: { where: { status: "ISSUED" }, select: { id: true } } } }),
    prisma.fiscalSettings.findFirst(),
  ]);
  const valid = invoices.filter((i) => i.status === "ISSUED");
  const sum = (k: "exempt" | "exonerated" | "taxable15" | "taxable18" | "isv15" | "isv18" | "total") =>
    round2(valid.reduce((s, i) => s + i[k], 0));
  const debit = round2(sum("isv15") + sum("isv18"));
  const credit = round2(purchases.reduce((s, p) => s + p.tax, 0));
  const purchasesTotal = round2(purchases.reduce((s, p) => s + p.total, 0));
  const unbilled = payments.filter((p) => p.invoices.length === 0);
  return {
    enabled: settings?.enabled ?? false,
    count: valid.length,
    voided: invoices.length - valid.length,
    first: valid[0]?.number ?? null,
    last: valid[valid.length - 1]?.number ?? null,
    exempt: sum("exempt"),
    exonerated: sum("exonerated"),
    taxable15: sum("taxable15"),
    taxable18: sum("taxable18"),
    isv15: sum("isv15"),
    isv18: sum("isv18"),
    total: sum("total"),
    debit,
    credit,
    payable: round2(debit - credit),
    purchasesTotal,
    purchasesCount: purchases.length,
    purchasesWithoutTax: purchases.filter((p) => p.tax <= 0).length,
    unbilledCount: unbilled.length,
    unbilledTotal: round2(unbilled.reduce((s, p) => s + p.amount, 0)),
    suppliers: [...purchases.reduce((m, p) => {
      const k = p.supplier?.name ?? "Sin proveedor";
      const e = m.get(k) ?? { total: 0, tax: 0, rtn: p.supplier?.taxId ?? "" };
      e.total += p.total;
      e.tax += p.tax;
      m.set(k, e);
      return m;
    }, new Map<string, { total: number; tax: number; rtn: string }>())].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
  };
}

/** Descuentos otorgados en el periodo: total, por tipo, por quién lo autorizó o aplicó, y el detalle. */
export async function discountSummary(period: Period) {
  const rows = await prisma.paymentDiscount.findMany({
    where: { createdAt: { gte: period.start, lt: period.end } },
    orderBy: { createdAt: "desc" },
  });
  const total = round2(rows.reduce((s, d) => s + d.amount, 0));
  const byKind = new Map<string, { count: number; amount: number }>();
  const byPerson = new Map<string, { count: number; amount: number }>();
  for (const d of rows) {
    const k = byKind.get(d.kind) ?? { count: 0, amount: 0 };
    k.count += 1;
    k.amount += d.amount;
    byKind.set(d.kind, k);
    const who = d.authorizedBy ? `${d.authorizedBy} (autorizó)` : (d.appliedBy ?? "Sin mesero");
    const p = byPerson.get(who) ?? { count: 0, amount: 0 };
    p.count += 1;
    p.amount += d.amount;
    byPerson.set(who, p);
  }
  return {
    total,
    count: rows.length,
    byKind: [...byKind.entries()].map(([kind, v]) => ({ kind, count: v.count, amount: round2(v.amount) })).sort((a, b) => b.amount - a.amount),
    byPerson: [...byPerson.entries()].map(([name, v]) => ({ name, count: v.count, amount: round2(v.amount) })).sort((a, b) => b.amount - a.amount),
    recent: rows.slice(0, 15).map((d) => ({
      id: d.id,
      label: d.label,
      amount: d.amount,
      appliedBy: d.appliedBy,
      authorizedBy: d.authorizedBy,
      beneficiaryId: d.beneficiaryId,
      createdAt: d.createdAt,
    })),
  };
}
