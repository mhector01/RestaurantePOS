"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { setOrderName } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  tableId: number;
  orderId: number | null;
  name: string | null;
  phone?: string | null;
  /** Para llevar: el nombre es obligatorio y se pide también el teléfono. */
  takeout?: boolean;
  className?: string;
}

/** Muestra el nombre de referencia de la cuenta y permite cambiarlo. */
export function OrderNameEditor({ tableId, orderId, name, phone, takeout = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name ?? "");
  const [tel, setTel] = useState(phone ?? "");
  const [pending, startTransition] = useTransition();

  const valid = !takeout || value.trim().length >= 2;

  const save = () =>
    startTransition(async () => {
      const res = await setOrderName(tableId, orderId, value, takeout ? tel : undefined);
      if (!res.success) return void toast.error(res.error);
      toast.success(value.trim() ? "Nombre guardado" : "Nombre quitado");
      setOpen(false);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(name ?? "");
          setTel(phone ?? "");
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium max-w-full transition-colors",
          name
            ? "bg-primary/15 text-primary hover:bg-primary/25"
            : "border border-dashed border-ink-600 text-muted-foreground hover:text-foreground hover:border-primary/60",
          className
        )}
      >
        <UserRound className="size-3.5 shrink-0" />
        {/* Sin nombre, en el celular basta el ícono: así cabe el número de mesa */}
        <span className={cn("truncate", !name && "hidden sm:inline")}>{name ?? "Agregar nombre"}</span>
        {phone && <span className="text-primary/70 hidden sm:inline">· {phone}</span>}
        <Pencil className={cn("size-3 shrink-0 opacity-70", !name && "hidden sm:block")} />
      </button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{takeout ? "Cliente del pedido" : "Nombre de referencia"}</DialogTitle>
            <DialogDescription>
              {takeout
                ? "Con este nombre se llama al cliente cuando su pedido esté listo."
                : "Opcional. Ayuda a reconocer la cuenta, por ejemplo “Familia López” o “Cumpleaños”."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) save();
            }}
          >
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={value}
                maxLength={40}
                onChange={(e) => setValue(e.target.value)}
                placeholder={takeout ? "Nombre del cliente" : "Ej. Familia López"}
                className="w-full h-12 rounded-xl border bg-background pl-9 pr-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
              />
            </div>
            {takeout && (
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={tel}
                  inputMode="tel"
                  maxLength={20}
                  onChange={(e) => setTel(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="w-full h-12 rounded-xl border bg-background pl-9 pr-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {!takeout && name && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 text-muted-foreground"
                  disabled={pending}
                  onClick={() => {
                    setValue("");
                    startTransition(async () => {
                      const res = await setOrderName(tableId, orderId, "");
                      if (!res.success) return void toast.error(res.error);
                      setOpen(false);
                    });
                  }}
                >
                  Quitar
                </Button>
              )}
              <Button type="submit" className="h-11 flex-1 rounded-xl" disabled={pending || !valid}>
                {pending && <Loader2 className="animate-spin" />} Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
