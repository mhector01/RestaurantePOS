import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";
import { monthRange } from "@/lib/month";

export const dynamic = "force-dynamic";

const csv = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const n = (v: number) => v.toFixed(2);

/** Libro de ventas del mes en CSV (se abre en Excel). Incluye las anuladas marcadas como tal. */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return new Response("No autorizado", { status: 401 });
  }
  const url = new URL(request.url);
  const range = monthRange(url.searchParams.get("mes") ?? undefined);
  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    include: { range: { select: { cai: true } } },
    orderBy: { sequence: "asc" },
  });

  const header = [
    "Fecha",
    "Número de factura",
    "CAI",
    "RTN cliente",
    "Nombre cliente",
    "Importe exento",
    "Importe exonerado",
    "Importe gravado 15%",
    "Importe gravado 18%",
    "ISV 15%",
    "ISV 18%",
    "Total",
    "Estado",
    "Motivo anulación",
  ];
  const rows = invoices.map((i) => {
    const voided = i.status === "VOID";
    const z = (v: number) => (voided ? "0.00" : n(v));
    return [
      i.createdAt.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" }),
      i.number,
      i.range.cai,
      i.customerRtn ?? "",
      i.customerName,
      z(i.exempt),
      z(i.exonerated),
      z(i.taxable15),
      z(i.taxable18),
      z(i.isv15),
      z(i.isv18),
      z(i.total),
      voided ? "ANULADA" : "EMITIDA",
      i.voidReason ?? "",
    ];
  });
  const valid = invoices.filter((i) => i.status === "ISSUED");
  const total = (k: "exempt" | "exonerated" | "taxable15" | "taxable18" | "isv15" | "isv18" | "total") =>
    n(valid.reduce((s, i) => s + i[k], 0));
  rows.push([
    "TOTALES",
    `${valid.length} emitidas`,
    "",
    "",
    "",
    total("exempt"),
    total("exonerated"),
    total("taxable15"),
    total("taxable18"),
    total("isv15"),
    total("isv18"),
    total("total"),
    "",
    "",
  ]);

  // BOM para que Excel respete los acentos
  const body = "﻿" + [header, ...rows].map((r) => r.map(csv).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="libro-ventas-${range.key}.csv"`,
    },
  });
}
