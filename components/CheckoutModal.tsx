"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Minus, Plus, ReceiptText } from "lucide-react";
import { processProductPayment } from "@/app/actions";
import { TicketPrint } from "./TicketPrint";

interface Props {
  orderId: number;
  mesaId: number;
  items: any[];
  disabled?: boolean; // <-- AÑADIDO
}

export function CheckoutModal({ orderId, mesaId, items, disabled }: Props) {
  const [quantities, setQuantities] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastPayment, setLastPayment] = useState<any>(null);

  const updateQty = (id: number, max: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const selectedTotal = items.reduce((sum, item) => {
    const qty = quantities[item.id] || 0;
    return sum + item.price * qty;
  }, 0);

  const handlePayment = async () => {
    const itemsToPay = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ id: parseInt(id), quantity: qty }));

    if (itemsToPay.length === 0) return;

    setLoading(true);
    try {
      const result = await processProductPayment(orderId, mesaId, itemsToPay, "CASH");
      setLastPayment(result);
      setQuantities({}); 
    } catch (error) {
      console.error("Error en el pago:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    // Si hay un pago en pantalla, no cerramos dando click afuera
    if (lastPayment && !isOpen) return;
    setOpen(isOpen);
    if (!isOpen) {
      setLastPayment(null);
      setQuantities({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {/* AQUÍ ESTÁ EL CAMBIO: Recibe el disabled */}
        <Button disabled={disabled} className="w-full h-12 text-lg font-black shadow-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50">
          <ReceiptText className="mr-2 h-5 w-5" />
          Dividir Cuenta
        </Button>
      </DialogTrigger>
      
      <DialogContent 
        className="sm:max-w-[480px]"
        onPointerDownOutside={(e) => e.preventDefault()} // <-- AÑADIDO PARA BLINDARLO
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">
            Cobro por Unidades
          </DialogTitle>
        </DialogHeader>

        {!lastPayment ? (
          <div className="space-y-6 pt-2">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              Selecciona la cantidad de cada producto a pagar:
            </p>

            <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-200 transition-all">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">{item.product.name}</h4>
                    <p className="text-[10px] text-slate-400 font-black">
                      VALOR U: ${item.price.toFixed(2)} | DISPONIBLE: {item.quantity}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-white shadow-sm hover:bg-red-50 hover:text-red-500" onClick={() => updateQty(item.id, item.quantity, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center font-black text-slate-900 text-sm">{quantities[item.id] || 0}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-white shadow-sm hover:bg-green-50 hover:text-green-500" onClick={() => updateQty(item.id, item.quantity, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-[2rem] flex justify-between items-center shadow-xl">
              <div>
                <p className="text-[10px] text-slate-400 font-black tracking-[0.2em] mb-1">SUBTOTAL SELECCIÓN</p>
                <p className="text-3xl font-black">${selectedTotal.toFixed(2)}</p>
              </div>
              <Button onClick={handlePayment} disabled={loading || selectedTotal === 0} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 h-12 rounded-full text-md transition-all active:scale-95">
                {loading ? "PROCESANDO..." : "COBRAR"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-green-50 border-2 border-green-100 rounded-[2rem] p-8 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-green-200 shadow-lg">
                <span className="text-white text-3xl font-black">✓</span>
              </div>
              <h3 className="text-green-900 font-black text-2xl tracking-tighter italic">¡PAGO REGISTRADO!</h3>
              <p className="text-green-600 font-bold text-sm">El inventario de la mesa se ha actualizado.</p>
            </div>

            <TicketPrint payment={lastPayment} />

            <Button
              variant="outline"
              className="w-full h-12 rounded-xl font-bold border-2"
              onClick={() => {
                if (items.length === 0 || !items) {
                  window.location.href = "/"; // Si ya no hay items, lo mandamos al menú
                } else {
                  setLastPayment(null);
                }
              }}
            >
              {items.length === 0 || !items ? "CERRAR Y LIBERAR MESA" : "COBRAR RESTANTE"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}