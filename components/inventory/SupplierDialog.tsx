"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { saveSupplier, type SupplierInput } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface SupplierRow extends SupplierInput {
  id: number;
}

const EMPTY: SupplierInput = { name: "", contact: "", phone: "", email: "", taxId: "", notes: "" };

export function SupplierDialog({ supplier }: { supplier?: SupplierRow }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const set = (k: keyof SupplierInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await saveSupplier(supplier?.id ?? null, form);
      if (!res.success) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(supplier ? "Proveedor actualizado" : "Proveedor agregado");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setForm(
            supplier
              ? {
                  name: supplier.name,
                  contact: supplier.contact ?? "",
                  phone: supplier.phone ?? "",
                  email: supplier.email ?? "",
                  taxId: supplier.taxId ?? "",
                  notes: supplier.notes ?? "",
                }
              : EMPTY
          );
        }
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {supplier ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${supplier.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button className="h-11 rounded-xl">
            <Plus /> Nuevo proveedor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>Quién te vende y cómo contactarlo para hacer pedidos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field id="s-name" label="Nombre o empresa">
            <Input id="s-name" value={form.name} onChange={set("name")} required autoFocus placeholder="Ej. Distribuidora La Granja" className="h-12 rounded-xl" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="s-contact" label="Persona de contacto">
              <Input id="s-contact" value={form.contact} onChange={set("contact")} placeholder="Opcional" className="h-12 rounded-xl" />
            </Field>
            <Field id="s-phone" label="Teléfono / WhatsApp">
              <Input id="s-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="Opcional" className="h-12 rounded-xl" />
            </Field>
            <Field id="s-email" label="Correo">
              <Input id="s-email" type="email" value={form.email} onChange={set("email")} placeholder="Opcional" className="h-12 rounded-xl" />
            </Field>
            <Field id="s-tax" label="RTN">
              <Input id="s-tax" value={form.taxId} onChange={set("taxId")} placeholder="Opcional" className="h-12 rounded-xl" />
            </Field>
          </div>
          <Field id="s-notes" label="Notas">
            <textarea
              id="s-notes"
              value={form.notes}
              onChange={set("notes")}
              rows={2}
              placeholder="Ej. Entrega martes y viernes. Crédito a 15 días."
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-primary resize-none"
            />
          </Field>
          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {supplier ? "Guardar cambios" : "Agregar proveedor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
