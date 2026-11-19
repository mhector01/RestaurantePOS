"use client";

import { PAYMENT_LABEL, formatMoney } from "@/lib/config";
import { amountInWords, formatRtn, type InvoiceView } from "@/lib/fiscal";
import { useBusiness } from "@/components/BusinessProvider";

const TAX_MARK: Record<string, string> = { "15": "G", "18": "G18", EXENTO: "E", MIXTO: "G" };

/** Contenido de la factura POS (80 mm) con los requisitos del Régimen de Facturación de la SAR. */
export function InvoiceBody({
  invoice,
  received,
  change,
  copy,
}: {
  invoice: InvoiceView;
  received?: number;
  change?: number;
  copy?: boolean;
}) {
  const i = invoice.issuer;
  const { logo } = useBusiness();
  const date = new Date(invoice.createdAt);
  const deadline = new Date(i.deadline);
  const fmtDate = (d: Date) => d.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const row = (label: string, value: number) => (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  );

  return (
    <div className="bg-white text-black font-mono text-[11px] leading-snug">
      <div className="text-center pb-2 mb-2 border-b border-dashed border-black">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="ticket-logo mx-auto mb-1.5 max-h-20 max-w-[70%] object-contain" />
        )}
        <p className="text-sm font-bold uppercase">{i.tradeName || i.legalName}</p>
        {i.tradeName && i.legalName && i.tradeName !== i.legalName && <p>{i.legalName}</p>}
        <p>RTN: {formatRtn(i.rtn)}</p>
        {i.address && <p>{i.address}</p>}
        {i.phone && <p>Tel.: {i.phone}</p>}
        {i.email && <p>{i.email}</p>}
      </div>

      <div className="text-center mb-2">
        <p className="text-sm font-bold">FACTURA{invoice.status === "VOID" ? " · ANULADA" : ""}</p>
        <p className="font-bold">No. {invoice.number}</p>
        {copy && <p>*** COPIA ***</p>}
      </div>

      <div className="mb-2 space-y-0.5 border-b border-dashed border-black pb-2">
        <p className="break-all">CAI: {i.cai}</p>
        <p>
          Fecha: {fmtDate(date)} {date.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {invoice.reference && <p>{invoice.reference}</p>}
        <p>Cliente: {invoice.customerName}</p>
        <p>RTN cliente: {invoice.customerRtn ? formatRtn(invoice.customerRtn) : "—"}</p>
        <p>No. O/C exenta: —</p>
        <p>No. Const. Reg. Exonerado: —</p>
        <p>No. Registro SAG: —</p>
      </div>

      <table className="w-full mb-2 border-b border-dashed border-black">
        <thead>
          <tr className="text-left">
            <th className="pb-1 w-7">Cant</th>
            <th className="pb-1">Descripción</th>
            <th className="pb-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, idx) => (
            <tr key={idx}>
              <td className="py-0.5 align-top">{l.quantity}</td>
              <td className="py-0.5 pr-1">
                {l.name}
                {l.detail && <span className="block text-[10px]">  {l.detail}</span>}
                {l.quantity > 1 && <span className="block text-[10px]">  {formatMoney(l.unitPrice)} c/u</span>}
              </td>
              <td className="py-0.5 text-right align-top whitespace-nowrap">
                {formatMoney(l.total)} {TAX_MARK[l.tax] ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
        {row("Descuentos y rebajas", invoice.discount)}
        {row("Sub-total", invoice.subtotal)}
        {row("Importe exonerado", invoice.exonerated)}
        {row("Importe exento", invoice.exempt)}
        {row("Importe gravado 15%", invoice.taxable15)}
        {row("Importe gravado 18%", invoice.taxable18)}
        {row("ISV 15%", invoice.isv15)}
        {row("ISV 18%", invoice.isv18)}
        <div className="flex justify-between font-bold text-sm pt-1">
          <span>TOTAL</span>
          <span>{formatMoney(invoice.total)}</span>
        </div>
      </div>
      <p className="mb-1">Son: {amountInWords(invoice.total)}</p>
      <p>Pago: {PAYMENT_LABEL[invoice.method] ?? invoice.method}</p>
      {received !== undefined && received > 0 && (
        <>
          <p>Recibido: {formatMoney(received)}</p>
          <p>Cambio: {formatMoney(change ?? 0)}</p>
        </>
      )}

      <div className="mt-2 pt-2 border-t border-dashed border-black space-y-0.5 text-[10px]">
        <p>Rango autorizado:</p>
        <p>del {i.rangeFrom}</p>
        <p>al {i.rangeTo}</p>
        <p>Fecha límite de emisión: {fmtDate(deadline)}</p>
        <p className="pt-1">Original: Cliente · Copia: Obligado tributario emisor</p>
      </div>

      <div className="text-center mt-3 pt-2 border-t border-dashed border-black">
        {i.footer && <p className="font-bold">{i.footer}</p>}
        <p className="font-bold">La factura es beneficio de todos, ¡exíjala!</p>
        <p className="text-[9px] mt-1">G = gravado 15% · G18 = gravado 18% · E = exento</p>
        <p className="text-[9px]">Ristemo · Sistema para restaurantes</p>
      </div>
    </div>
  );
}
