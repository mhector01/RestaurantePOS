"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { createInvoiceRange, deleteInvoiceRange, setRangeActive, type RangeInput } from "@/app/fiscal-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmAction } from "@/components/pos/ConfirmAction";

const EMPTY: RangeInput = { cai: "", from: "", to: "", deadline: "", next: "" };

/** Formatea mientras se escribe: 000-001-01-00000001 */
function maskNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 16);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8)].filter(Boolean);
  return parts.join("-");
}

/** Formatea el CAI en grupos de 6 mientras se escribe. */
function maskCai(v: string) {
  const raw = v.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 32);
  return (raw.match(/.{1,6}/g) ?? []).join("-");
}

export function NewRangeDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RangeInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await createInvoiceRange(form);
      if (!res.success) return toast.error(res.error ?? "No se pudo guardar");
      toast.success("Rango CAI registrado");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setForm(EMPTY);
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 rounded-xl">
          <Plus /> Registrar rango CAI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo rango autorizado</DialogTitle>
          <DialogDescription>Cópialo tal como aparece en la autorización de la SAR.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-cai">CAI</Label>
            <Input
              id="r-cai"
              value={form.cai}
              onChange={(e) => setForm((f) => ({ ...f, cai: maskCai(e.target.value) }))}
              placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX"
              required
              autoFocus
              className="h-12 rounded-xl font-mono text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-from">Rango desde</Label>
              <Input
                id="r-from"
                inputMode="numeric"
                value={form.from}
                onChange={(e) => setForm((f) => ({ ...f, from: maskNumber(e.target.value) }))}
                placeholder="000-001-01-00000001"
                required
                className="h-12 rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-to">Rango hasta</Label>
              <Input
                id="r-to"
                inputMode="numeric"
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: maskNumber(e.target.value) }))}
                placeholder="000-001-01-00000500"
                required
                className="h-12 rounded-xl font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-deadline">Fecha límite de emisión</Label>
              <Input
                id="r-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                required
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-next">Siguiente número (opcional)</Label>
              <Input
                id="r-next"
                inputMode="numeric"
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: maskNumber(e.target.value) }))}
                placeholder="Si ya usaste parte del rango"
                className="h-12 rounded-xl font-mono text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El prefijo es establecimiento (000), punto de emisión (001) y tipo de documento (01 = factura). Si ya emitiste
            facturas de este rango en otro sistema o a mano, indica el siguiente número para no repetir.
          </p>
          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Guardar rango
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RangeActions({ id, active, used }: { id: number; active: boolean; used: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-9 rounded-lg"
        disabled={pending}
        onClick={() => startTransition(() => setRangeActive(id, !active))}
      >
        {active ? <PowerOff className="size-4" /> : <Power className="size-4" />} {active ? "Desactivar" : "Activar"}
      </Button>
      {!used && (
        <ConfirmAction
          title="¿Eliminar este rango?"
          description="Aún no tiene facturas emitidas."
          confirmLabel="Eliminar"
          successMessage="Rango eliminado"
          action={() => deleteInvoiceRange(id)}
        >
          <Button variant="ghost" size="icon" className="size-9 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Eliminar rango">
            <Trash2 className="size-4" />
          </Button>
        </ConfirmAction>
      )}
    </div>
  );
}
