import prisma from "@/lib/prisma";
import { getAdmin } from "@/lib/session";
import { getBusiness } from "@/lib/tenant";
import { isoDay, resolvePeriod } from "@/lib/period";
import { productSales, profitSummary, salesSummary, taxSummary } from "@/lib/reports";
import { EXPENSE_CATEGORY_LABEL, EXPENSE_METHOD_LABEL, expenseCost } from "@/lib/expenses";

export const dynamic = "force-dynamic";

type Cell = string | number | null | undefined;

const cell = (v: Cell) => {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  const s = v ?? "";
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const date = (d: Date) => d.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Descargas de los reportes en CSV (abre directo en Excel, con acentos). */
export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response("No autorizado", { status: 401 });
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "ventas";
  const sp = Object.fromEntries(url.searchParams) as { p?: string; desde?: string; hasta?: string };
  const period = resolvePeriod(sp, tipo.startsWith("libro") || tipo === "impuestos" ? "mesant" : "mes");
  const last = new Date(period.end.getTime() - 86_400_000);
  const rangeText = `${date(period.start)} al ${date(last)}`;
  const range = { gte: period.start, lt: period.end };

  let rows: Cell[][] = [];
  let name = tipo;

  if (tipo === "ventas") {
    const s = await salesSummary(period);
    rows = [
      ["Periodo", "Ventas (con ISV)", "Cuentas"],
      ...s.series.map((b) => [b.long, b.value, b.note?.split(" ")[0] ?? "0"]),
      [],
      ["Total", s.total, s.orders],
      ["Ticket promedio", s.avg],
      ["Efectivo", s.methods.CASH],
      ["Tarjeta", s.methods.CARD],
      ["Transferencia", s.methods.TRANSFER ?? 0],
      ["En mesa", s.channel.MESA ?? 0],
      ["Para llevar", s.channel.LLEVAR ?? 0],
      [],
      ["Mesero", "Ventas", "Cuentas", "Ticket promedio"],
      ...s.waiters.map((w) => [w.name, w.total, w.orders, w.orders ? w.total / w.orders : 0]),
    ];
  } else if (tipo === "productos") {
    const r = await productSales(period);
    rows = [
      ["Producto", "Categoría", "Unidades", "Ventas (con ISV)", "Ventas netas", "Costo", "Ganancia", "Margen %", "% de las ventas"],
      ...[...r.products]
        .sort((a, b) => b.total - a.total)
        .map((p) => [
          p.name,
          p.category,
          p.units,
          p.total,
          p.net,
          p.costed ? p.cost : "",
          p.costed ? p.profit : "",
          p.margin === null ? "sin receta" : Math.round(p.margin * 1000) / 10,
          Math.round(p.share * 1000) / 10,
        ]),
    ];
  } else if (tipo === "ganancias") {
    const g = await profitSummary(period);
    rows = [
      ["Concepto", "Monto"],
      ["Ventas cobradas (con ISV)", g.gross],
      ["ISV cobrado", -g.tax],
      ["Ventas netas", g.net],
      ["Costo de lo vendido", -g.cost],
      ["Utilidad bruta", g.grossProfit],
      ["Margen bruto %", Math.round(g.margin * 1000) / 10],
      ["Mermas", -g.waste],
      ["Ajustes de conteo", g.countAdj],
      ["Utilidad bruta real", g.adjusted],
      ["Gastos de operación (sin ISV a favor)", -g.opex],
      ["Utilidad neta", g.netProfit],
      ["Margen neto %", Math.round(g.netMargin * 1000) / 10],
      ["Compras del periodo", g.purchases],
      ["% de ventas con costo conocido", Math.round(g.coverage * 1000) / 10],
      [],
      ["Gastos por categoría", "Monto"],
      ...g.expensesByCategory.map((e) => [EXPENSE_CATEGORY_LABEL[e.category] ?? e.category, e.amount]),
      [],
      ["Periodo", "Utilidad bruta"],
      ...g.series.map((b) => [b.long, b.value]),
    ];
  } else if (tipo === "impuestos") {
    const t = await taxSummary(period);
    rows = [
      ["Concepto", "Monto"],
      ["Ventas exentas", t.exempt],
      ["Ventas exoneradas", t.exonerated],
      ["Ventas gravadas 15%", t.taxable15],
      ["Ventas gravadas 18%", t.taxable18],
      ["ISV 15%", t.isv15],
      ["ISV 18%", t.isv18],
      ["Débito fiscal", t.debit],
      ["Total facturado", t.total],
      ["Facturas emitidas", t.count],
      ["Facturas anuladas", t.voided],
      ["Primera factura", t.first ?? ""],
      ["Última factura", t.last ?? ""],
      [],
      ["Compras de inventario", t.purchasesTotal],
      ["ISV en compras", t.purchasesCredit],
      ["Gastos", t.expensesTotal],
      ["ISV en gastos con factura", t.expensesCredit],
      ["Crédito fiscal total", t.credit],
      [],
      [t.payable >= 0 ? "ISV a pagar" : "Saldo a favor", Math.abs(t.payable)],
      [],
      ["Cobros sin factura", t.unbilledCount],
      ["Monto de cobros sin factura", t.unbilledTotal],
    ];
  } else if (tipo === "libro-ventas") {
    const invoices = await prisma.invoice.findMany({ where: { createdAt: range }, include: { range: { select: { cai: true } } }, orderBy: { sequence: "asc" } });
    const valid = invoices.filter((i) => i.status === "ISSUED");
    const sum = (k: "exempt" | "exonerated" | "taxable15" | "taxable18" | "isv15" | "isv18" | "total") => valid.reduce((s, i) => s + i[k], 0);
    rows = [
      ["Fecha", "Número de factura", "CAI", "RTN cliente", "Nombre cliente", "Exento", "Exonerado", "Gravado 15%", "Gravado 18%", "ISV 15%", "ISV 18%", "Total", "Estado"],
      ...invoices.map((i) => {
        const v = i.status === "VOID";
        const z = (n: number) => (v ? 0 : n);
        return [date(i.createdAt), i.number, i.range.cai, i.customerRtn ?? "", i.customerName, z(i.exempt), z(i.exonerated), z(i.taxable15), z(i.taxable18), z(i.isv15), z(i.isv18), z(i.total), v ? `ANULADA: ${i.voidReason ?? ""}` : "EMITIDA"];
      }),
      ["TOTALES", `${valid.length} emitidas`, "", "", "", sum("exempt"), sum("exonerated"), sum("taxable15"), sum("taxable18"), sum("isv15"), sum("isv18"), sum("total"), ""],
    ];
  } else if (tipo === "libro-compras") {
    const [purchases, expenses] = await Promise.all([
      prisma.purchase.findMany({ where: { status: "RECEIVED", date: range }, include: { supplier: true } }),
      // Solo los gastos con factura: los que no tienen no son documentos fiscales
      prisma.expense.findMany({ where: { status: "ACTIVE", hasInvoice: true, date: range } }),
    ]);
    const lines = [
      ...purchases.map((p) => ({
        date: p.date,
        row: [date(p.date), "Compra (inventario)", p.supplier?.name ?? "Sin proveedor", p.supplier?.taxId ?? "", p.invoice ?? "", "", 0, p.total - p.tax, 0, p.tax, 0, p.total, p.paid ? "Pagada" : "Pendiente"] as Cell[],
        total: p.total,
        tax: p.tax,
      })),
      ...expenses.map((e) => ({
        date: e.date,
        row: [date(e.date), `Gasto: ${EXPENSE_CATEGORY_LABEL[e.category] ?? e.category}`, e.supplierName || "Sin proveedor", e.supplierRtn, e.invoiceNumber, e.cai, e.exempt, e.taxable15, e.taxable18, e.isv15, e.isv18, e.total, e.paid ? "Pagada" : "Pendiente"] as Cell[],
        total: e.total,
        tax: e.isv15 + e.isv18,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sumE = (k: "exempt" | "taxable15" | "taxable18" | "isv15" | "isv18") => expenses.reduce((s, e) => s + e[k], 0);
    rows = [
      ["Fecha", "Tipo", "Proveedor", "RTN proveedor", "Número de factura", "CAI", "Exento", "Gravado 15%", "Gravado 18%", "ISV 15%", "ISV 18%", "Total", "Estado de pago"],
      ...lines.map((l) => l.row),
      [
        "TOTALES",
        `${lines.length} facturas`,
        "",
        "",
        "",
        "",
        sumE("exempt"),
        purchases.reduce((s, p) => s + p.total - p.tax, 0) + sumE("taxable15"),
        sumE("taxable18"),
        purchases.reduce((s, p) => s + p.tax, 0) + sumE("isv15"),
        sumE("isv18"),
        lines.reduce((s, l) => s + l.total, 0),
        "",
      ],
    ];
    rows.push([], ["Las compras de inventario se registran con un solo ISV: se muestran como gravado 15%."]);
  } else if (tipo === "gastos") {
    const expenses = await prisma.expense.findMany({ where: { date: range }, orderBy: [{ date: "asc" }, { id: "asc" }] });
    const active = expenses.filter((e) => e.status === "ACTIVE");
    rows = [
      ["Fecha", "Categoría", "Descripción", "Proveedor", "RTN proveedor", "Comprobante", "Número de factura", "CAI", "Exento", "Gravado 15%", "Gravado 18%", "ISV 15%", "ISV 18%", "Total", "Costo (sin ISV a favor)", "Forma de pago", "Pagado", "Estado", "Notas", "Registró"],
      ...expenses.map((e) => {
        const v = e.status === "VOID";
        const z = (n: number) => (v ? 0 : n);
        return [
          date(e.date),
          EXPENSE_CATEGORY_LABEL[e.category] ?? e.category,
          e.description,
          e.supplierName,
          e.supplierRtn,
          e.hasInvoice ? "Factura" : "Sin factura",
          e.invoiceNumber,
          e.cai,
          z(e.exempt),
          z(e.taxable15),
          z(e.taxable18),
          z(e.isv15),
          z(e.isv18),
          z(e.total),
          z(expenseCost(e)),
          EXPENSE_METHOD_LABEL[e.method] ?? e.method,
          e.paid ? "Sí" : "No",
          v ? `ANULADO: ${e.voidReason ?? ""}` : "Activo",
          e.notes,
          e.createdBy ?? "",
        ];
      }),
      ["TOTALES", `${active.length} gastos`, "", "", "", "", "", "", ...(["exempt", "taxable15", "taxable18", "isv15", "isv18", "total"] as const).map((k) => active.reduce((s, e) => s + e[k], 0)), active.reduce((s, e) => s + expenseCost(e), 0), "", "", "", "", ""],
    ];
  } else {
    return new Response("Reporte desconocido", { status: 400 });
  }

  const header: Cell[][] = [[(await getBusiness()).name], [`Reporte: ${name.replace("-", " de ")}`], [`Periodo: ${rangeText}`], []];
  name = `${name}-${isoDay(period.start)}_${isoDay(last)}`;
  const body = "﻿" + [...header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}
