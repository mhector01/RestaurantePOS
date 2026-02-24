"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAdmin } from "@/app/actions";
import { LockKeyhole, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const formData = new FormData(e.currentTarget);
    const result = await loginAdmin(formData);
    
    // Si la función devuelve algo, es porque hubo un error (contraseña incorrecta)
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Link href="/">
          <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800">
            <ArrowLeft className="mr-2 h-5 w-5" /> Volver al POS
          </Button>
        </Link>
      </div>

      <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md text-center">
        <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <LockKeyhole className="h-10 w-10 text-blue-600" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Acceso Admin</h1>
        <p className="text-slate-500 font-bold tracking-widest text-xs uppercase mb-8">
          Ingresa tu PIN de seguridad
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input 
              type="password" 
              name="password"
              placeholder="•••••" 
              required
              className="h-16 text-center text-3xl font-black tracking-[0.5em] bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-2xl"
            />
            {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-xl text-lg transition-all active:scale-95"
          >
            {loading ? "Verificando..." : "Desbloquear"}
          </Button>
        </form>
      </div>
    </div>
  );
}