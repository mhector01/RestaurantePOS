"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { createTakeoutOrder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Abre un pedido para llevar pidiendo primero el nombre del cliente (obligatorio). */
export function NewTakeoutButton({ className, label = "Nuevo pedido" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();

  const valid = name.trim().length >= 2;

  const create = () =>
    startTransition(async () => {
      const res = await createTakeoutOrder(name, phone);
      if (!res.success || !res.orderId) return void toast.error(res.error ?? "No se pudo crear el pedido");
      setOpen(false);
      router.push(`/llevar/${res.orderId}`);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName("");
          setPhone("");
          setTouched(false);
          setOpen(true);
        }}
        className={cn(
          "h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition",
          className
        )}
      >
        <Plus className="size-4" /> {label}
      </button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo pedido para llevar</DialogTitle>
            <DialogDescription>
              El nombre es obligatorio: así se identifica el pedido en cocina y al entregarlo.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (valid) create();
            }}
          >
            <div>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="Nombre del cliente *"
                  aria-invalid={touched && !valid}
                  className="w-full h-12 rounded-xl border bg-background pl-9 pr-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20 aria-invalid:border-destructive"
                />
              </div>
              {touched && !valid && (
                <p className="text-xs text-destructive mt-1.5">Escribe el nombre del cliente (mínimo 2 letras).</p>
              )}
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={phone}
                inputMode="tel"
                maxLength={20}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono (opcional)"
                className="w-full h-12 rounded-xl border bg-background pl-9 pr-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Crear y tomar pedido
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
