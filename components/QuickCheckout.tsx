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
import { processFullPayment } from "@/app/actions";
import { TicketPrint } from "./TicketPrint";
import { CreditCard, Banknote, Loader2, CheckCircle2 } from "lucide-react";

export function QuickCheckout({ orderId, mesaId, total, disabled }: { orderId: number, mesaId: number, total: number, disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [lastPayment, setLastPayment] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const handleFullPayment = async (method: string) => {
    setLoading(true);
    try {
      const result = await processFullPayment(orderId, mesaId, method);
      if (result) {
        setLastPayment(result);
      }
    } catch (error) {
      console.error("Error en pago total:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(val) => {
        if (loading) return;
        if (lastPayment && !val) return; 
        setOpen(val);
      }}
    >
      <DialogTrigger asChild>
        {/* AQUÍ ESTÁ EL CAMBIO: Recibe el disabled */}
        <Button disabled={disabled} className="w-full bg-green-600 hover:bg-green-700 text-white font-black h-12 shadow-md disabled:opacity-50">
          PAGAR TOTAL (${total.toFixed(2)})
        </Button>
      </DialogTrigger>
      
      <DialogContent 
        className="sm:max-w-[420px]" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center font-black uppercase italic tracking-tighter text-xl">
            {lastPayment ? "¡Venta Completada!" : "Método de Pago"}
          </DialogTitle>
        </DialogHeader>

        {!lastPayment ? (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => handleFullPayment("CASH")} 
                disabled={loading}
                className="h-28 flex flex-col gap-3 border-2 hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Banknote size={36} className="text-green-600 group-hover:scale-110 transition-transform" />}
                <span className="font-bold text-xs uppercase">Efectivo</span>
              </Button>
              <Button 
                onClick={() => handleFullPayment("CARD")} 
                disabled={loading}
                className="h-28 flex flex-col gap-3 border-2 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                {loading ? <Loader2 className="animate-spin" /> : <CreditCard size={36} className="text-blue-600 group-hover:scale-110 transition-transform" />}
                <span className="font-bold text-xs uppercase">Tarjeta</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="flex flex-col items-center justify-center p-6 bg-green-600 text-white rounded-3xl shadow-lg animate-in zoom-in duration-300">
              <CheckCircle2 size={48} className="mb-2" />
              <p className="font-black text-2xl italic tracking-tighter">ORDEN PAGADA</p>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Mesa liberada con éxito</p>
            </div>

            <div className="border rounded-2xl p-2 bg-slate-50 max-h-[300px] overflow-y-auto shadow-inner">
              <TicketPrint payment={lastPayment} />
            </div>

            <Button
              className="w-full h-14 font-black uppercase tracking-widest bg-slate-900 hover:bg-black text-white rounded-2xl shadow-xl transition-all active:scale-95"
              onClick={() => {
                window.location.href = "/"; 
              }}
            >
              Cerrar y Salir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}