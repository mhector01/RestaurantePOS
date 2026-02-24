"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { closeRegister } from "@/app/actions";

export function PrintAndCloseButton({ hasSales }: { hasSales: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleClose = async () => {
    const confirmacion = window.confirm(
      "¿Imprimir reporte y cerrar el turno? La caja volverá a $0.00"
    );
    
    if (!confirmacion) return;

    // 1. Abrimos el diálogo de impresión (imprime el ticket oculto)
    window.print();

    // 2. Cerramos la caja en la base de datos
    setLoading(true);
    await closeRegister();
    setLoading(false);
  };

  // Si no hay ventas, no mostramos el botón
  if (!hasSales) return null;

  return (
    <Button 
      onClick={handleClose} 
      disabled={loading} 
      className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest h-12 px-6 rounded-xl shadow-lg print:hidden"
    >
      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
      Imprimir y Cerrar Caja
    </Button>
  );
}