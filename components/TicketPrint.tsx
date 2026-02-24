"use client";

import { Button } from "./ui/button";
import { Printer } from "lucide-react";

interface Props {
  payment: any;
}

export function TicketPrint({ payment }: Props) {
  const handlePrint = () => {
    window.print();
  };

  if (!payment || !payment.order) return null;

  return (
    <div className="mt-4">
      <Button 
        onClick={handlePrint} 
        variant="outline" 
        className="w-full gap-2 font-bold border-2 border-slate-200 hover:bg-slate-50"
      >
        <Printer size={16} /> Imprimir Comprobante
      </Button>

      {/* ÁREA DE IMPRESIÓN (Invisible en web, visible en Ctrl+P) */}
      <div className="hidden print:block fixed inset-0 bg-white p-6 text-black font-mono text-sm leading-tight w-[80mm] mx-auto">
        <div className="text-center border-b border-dashed border-black pb-3 mb-3">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">POS RESTAURANTE</h2>
          <p className="text-[10px]">DIRECCIÓN COMERCIAL 123</p>
          <p className="text-[10px]">CIUDAD - PAÍS</p>
          <p className="text-[10px]">NIT: 900.123.456-1</p>
        </div>

        <div className="mb-3 text-[10px] space-y-1">
          <p>FECHA: {new Date(payment.createdAt).toLocaleString()}</p>
          <p>MESA: {payment.order.table.number}</p>
          <p>COMPROBANTE: #{payment.id}</p>
        </div>

        <table className="w-full mb-3 border-b border-dashed border-black">
          <thead>
            <tr className="text-left text-[10px]">
              <th className="pb-2">CANT</th>
              <th className="pb-2">DESCRIPCIÓN</th>
              <th className="pb-2 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {payment.order.items.map((item: any) => (
              // Usamos item.id como KEY única
              <tr key={item.id} className="text-[11px]">
                <td className="py-1 align-top font-bold">{item.quantity}</td>
                <td className="py-1 uppercase px-1">{item.product.name}</td>
                <td className="py-1 text-right align-top font-bold">
                  ${(item.price * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pt-2">
          <div className="flex justify-between items-center text-xs font-black">
             <span>TOTAL PAGADO:</span>
             <span className="text-lg">${payment.amount.toFixed(2)}</span>
          </div>
          <p className="text-[9px] mt-2 text-right italic font-medium">MÉTODO: {payment.method}</p>
        </div>

        <div className="text-center mt-10 pt-4 border-t border-dashed border-black space-y-1">
          <p className="text-[10px] font-black italic">¡GRACIAS POR PREFERIRNOS!</p>
          <p className="text-[8px]">ESTO NO ES UNA FACTURA LEGAL</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          /* Ocultar todo el sitio web al imprimir */
          body * {
            visibility: hidden;
          }
          /* Mostrar solo nuestro ticket */
          .print\:block, .print\:block * {
            visibility: visible;
          }
          .print\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}