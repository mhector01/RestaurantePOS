"use client";

import { createPortal } from "react-dom";
import { BUSINESS, PAYMENT_LABEL, formatMoney } from "@/lib/config";

export interface TicketPayment {
  id: number;
  amount: number;
  method: string;
  createdAt: string | Date;
  order: {
    table: { number: number };
    items: { id: number; quantity: number; price: number; product: { name: string } }[];
  };
}

/**
 * Ticket de 80 mm. No se ve en pantalla; solo aparece al imprimir (window.print()).
 */
export function TicketPrint({
  payment,
  received,
  change,
}: {
  payment: TicketPayment;
  received?: number;
  change?: number;
}) {
  // Se monta directo en <body> para que la impresión no herede posiciones del diálogo.
  // Solo se renderiza tras un cobro (en el navegador), nunca en el servidor.
  if (typeof document === "undefined") return null;

  const mesa = payment.order.table.number;
  return createPortal(
    <div className="print-area hidden print:block bg-white text-black font-mono text-[11px] leading-snug">
      <div className="text-center pb-2 mb-2 border-b border-dashed border-black">
        <p className="text-sm font-bold uppercase">{BUSINESS.name}</p>
        <p>{BUSINESS.address}</p>
        {BUSINESS.taxId && <p>RTN/NIT: {BUSINESS.taxId}</p>}
      </div>

      <div className="mb-2 space-y-0.5">
        <p>Fecha: {new Date(payment.createdAt).toLocaleString("es")}</p>
        <p>{mesa === 0 ? "Para llevar" : `Mesa ${mesa}`}</p>
        <p>Comprobante #{payment.id}</p>
      </div>

      <table className="w-full mb-2 border-b border-dashed border-black">
        <thead>
          <tr className="text-left">
            <th className="pb-1 w-8">Cant</th>
            <th className="pb-1">Descripción</th>
            <th className="pb-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {payment.order.items.map((item) => (
            <tr key={item.id}>
              <td className="py-0.5 align-top">{item.quantity}</td>
              <td className="py-0.5 pr-1">{item.product.name}</td>
              <td className="py-0.5 text-right align-top">{formatMoney(item.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{formatMoney(payment.amount)}</span>
      </div>
      <p className="mt-1">Pago: {PAYMENT_LABEL[payment.method] ?? payment.method}</p>
      {received !== undefined && received > 0 && (
        <>
          <p>Recibido: {formatMoney(received)}</p>
          <p>Cambio: {formatMoney(change ?? 0)}</p>
        </>
      )}

      <div className="text-center mt-4 pt-2 border-t border-dashed border-black">
        <p className="font-bold">¡Gracias por su visita!</p>
        <p className="text-[9px]">Este documento no es una factura</p>
        <p className="text-[9px] mt-1">Ristemo · Sistema para restaurantes</p>
      </div>
    </div>,
    document.body
  );
}
