"use client";

import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/config";
import { formatRtn } from "@/lib/fiscal";
import { suggestedTip, type TipRules } from "@/lib/tips";
import { useBusiness } from "@/components/BusinessProvider";
import type { OrderLine } from "./OrderWorkspace";

/**
 * Pre-cuenta de 80 mm: lo consumido, la propina sugerida y el total con propina.
 * Solo aparece al imprimir. No es factura: el cliente decide si paga la propina al cobrar.
 */
export function PreBillPrint({
  label,
  waiterName,
  items,
  paid,
  tipRules,
}: {
  label: string; // "Mesa 4" o "Para llevar · Juan"
  waiterName?: string | null;
  items: OrderLine[];
  paid: number;
  tipRules: TipRules;
}) {
  const business = useBusiness();
  if (typeof document === "undefined") return null;
  const consumption = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
  const tip = suggestedTip(consumption, tipRules);

  return createPortal(
    <div className="print-area hidden print:block bg-white text-black font-mono text-[11px] leading-snug">
      <div className="text-center pb-2 mb-2 border-b border-dashed border-black">
        {business.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logo} alt="" className="ticket-logo mx-auto mb-1.5 max-h-20 max-w-[70%] object-contain" />
        )}
        <p className="text-sm font-bold uppercase">{business.name}</p>
        {business.taxId && <p>RTN: {/^\d{14}$/.test(business.taxId) ? formatRtn(business.taxId) : business.taxId}</p>}
      </div>

      <div className="text-center mb-2">
        <p className="text-sm font-bold">PRE-CUENTA</p>
      </div>
      <div className="mb-2 space-y-0.5">
        <p>{label}</p>
        {waiterName && <p>Atendió: {waiterName}</p>}
        <p>Fecha: {new Date().toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}</p>
      </div>

      <table className="w-full mb-2 border-y border-dashed border-black">
        <thead>
          <tr className="text-left">
            <th className="py-1 w-8">Cant</th>
            <th className="py-1">Descripción</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="py-0.5 align-top">{i.quantity}</td>
              <td className="py-0.5 pr-1">
                {i.name}
                {i.detail && <span className="block text-[10px]">  {i.detail}</span>}
              </td>
              <td className="py-0.5 text-right align-top whitespace-nowrap">{formatMoney(i.price * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-0.5 mb-2">
        <div className="flex justify-between font-bold text-sm">
          <span>CONSUMO</span>
          <span>{formatMoney(consumption)}</span>
        </div>
        {paid > 0 && (
          <div className="flex justify-between">
            <span>Ya abonado</span>
            <span>{formatMoney(paid)}</span>
          </div>
        )}
        {tip > 0 && (
          <>
            <div className="flex justify-between pt-1">
              <span>Propina sugerida ({tipRules.percent}%)</span>
              <span>{formatMoney(tip)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total con propina</span>
              <span>{formatMoney(consumption + tip)}</span>
            </div>
          </>
        )}
      </div>

      <div className="text-center mt-3 pt-2 border-t border-dashed border-black space-y-0.5">
        {tip > 0 && <p className="font-bold">La propina es voluntaria. Indique a su mesero si desea incluirla.</p>}
        <p className="text-[9px]">Este documento no es una factura</p>
        <p className="text-[9px]">Ristemo · Sistema para restaurantes</p>
      </div>
    </div>,
    document.body
  );
}
