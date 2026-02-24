// Archivo: components/PinPad.tsx
"use client";

import { useState } from "react";
import { loginWaiter } from "@/app/actions";
import { LockKeyhole, Delete, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";

export function PinPad() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePress = async (num: string) => {
    if (pin.length >= 4 || loading) return;
    
    const newPin = pin + num;
    setPin(newPin);
    setError("");

    // Si ya tecleó 4 números, verificamos automáticamente sin pedir "Enter"
    if (newPin.length === 4) {
      setLoading(true);
      const res = await loginWaiter(newPin);
      
      if (res?.error) {
        setError(res.error);
        setPin(""); // Borramos para que intente de nuevo
        setLoading(false);
      } else {
        // Recargamos la página actual para que ya lo deje ver la mesa
        window.location.reload(); 
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 w-full absolute inset-0 z-50">
      
      <div className="absolute top-8 left-8">
        <Link href="/">
          <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800">
            <ArrowLeft className="mr-2 h-5 w-5" /> Volver al Plano
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="bg-blue-600/20 p-4 rounded-full mb-6">
          <LockKeyhole className="h-10 w-10 text-blue-500" />
        </div>
        
        <h2 className="text-2xl font-black text-white tracking-widest uppercase mb-2">Acceso a Mesa</h2>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mb-8">Ingresa tu PIN de Mesero</p>

        {/* Círculos que se llenan como en los celulares */}
        <div className="flex gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`w-5 h-5 rounded-full border-2 transition-all ${
                i < pin.length ? "bg-white border-white scale-110" : "border-slate-600"
              }`} 
            />
          ))}
        </div>

        {error && <p className="text-red-400 font-bold mb-4 animate-bounce">{error}</p>}
        {loading && <p className="text-blue-400 font-bold mb-4 flex items-center gap-2"><Loader2 className="animate-spin" /> Verificando...</p>}

        {/* TECLADO NUMÉRICO */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handlePress(num)}
              className="h-20 bg-slate-800 hover:bg-slate-700 text-white text-3xl font-black rounded-2xl active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          <div /> {/* Espacio vacío */}
          <button
            onClick={() => handlePress("0")}
            className="h-20 bg-slate-800 hover:bg-slate-700 text-white text-3xl font-black rounded-2xl active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-20 bg-slate-800/50 hover:bg-slate-700 text-red-400 flex justify-center items-center rounded-2xl active:scale-95 transition-all"
          >
            <Delete size={32} />
          </button>
        </div>
      </div>
    </div>
  );
}