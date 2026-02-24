"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveUser } from "@/app/actions";
import { Edit, UserPlus } from "lucide-react";

interface User {
  id: number;
  name: string;
  pin: string;
}

export function UserModal({ user }: { user?: User }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [pin, setPin] = useState(user?.pin || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return alert("El PIN debe tener al menos 4 números.");
    
    setLoading(true);
    try {
      await saveUser(user?.id || null, name, pin);
      setOpen(false);
      if (!user) {
        setName("");
        setPin("");
      }
    } catch (error) {
      console.error(error);
      alert("Error al guardar. Tal vez ese PIN ya lo tiene otro mesero.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {user ? (
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
            <Edit size={16} />
          </Button>
        ) : (
          <Button className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
            <UserPlus className="mr-2 h-5 w-5" /> Nuevo Mesero
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-black italic uppercase text-xl">
            {user ? "Editar Mesero" : "Registrar Personal"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nombre del Mesero/a</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carlos Mendoza" required className="h-12 font-medium" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">PIN de Acceso (4 dígitos)</Label>
            <Input 
              type="text" 
              maxLength={4} 
              pattern="\d{4}" // Solo permite 4 números exactos
              title="Debe ser un PIN de 4 números"
              value={pin} 
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Evita letras
              placeholder="1234" 
              required 
              className="h-16 font-black text-center tracking-[1em] text-2xl" 
            />
          </div>
          
          <Button type="submit" className="w-full h-12 font-black tracking-widest uppercase bg-blue-600 hover:bg-blue-700 mt-4" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Registro"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}