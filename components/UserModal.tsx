"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, UserPlus } from "lucide-react";
import { saveUser } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface User {
  id: number;
  name: string;
  pin: string;
}

export function UserModal({ user }: { user?: User }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return toast.error("El PIN debe tener 4 números");
    setLoading(true);
    const res = await saveUser(user?.id ?? null, name, pin);
    setLoading(false);
    if (!res.success) return toast.error(res.error);
    toast.success(user ? "Datos actualizados" : "Persona registrada");
    setOpen(false);
  };

  const randomPin = () => setPin(String(Math.floor(1000 + Math.random() * 9000)));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setName(user?.name ?? "");
          setPin(user?.pin ?? "");
        }
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {user ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${user.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button className="h-11 rounded-xl">
            <UserPlus /> Agregar persona
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{user ? "Editar persona" : "Nueva persona"}</DialogTitle>
          <DialogDescription>Con este PIN entra a tomar pedidos y cobrar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="u-name">Nombre</Label>
            <Input
              id="u-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Carlos Mendoza"
              required
              autoFocus
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="u-pin">PIN de 4 dígitos</Label>
              <button type="button" onClick={randomPin} className="text-sm font-medium text-primary">
                Generar
              </button>
            </div>
            <Input
              id="u-pin"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              required
              className="h-14 rounded-xl text-center text-2xl font-semibold tracking-[0.6em] tabular"
            />
          </div>
          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
