"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface HandoffData {
  title: string;
  description: string;
  rows: { label: string; value: string; mono?: boolean }[];
  message: string; // texto para copiar y enviar por WhatsApp o correo
}

/** Muestra una contraseña temporal una sola vez, con un mensaje listo para enviar. */
export function HandoffDialog({ data, onClose }: { data: HandoffData | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar; selecciona el texto a mano");
    }
  };
  return (
    <Dialog open={!!data} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{data?.title}</DialogTitle>
          <DialogDescription>{data?.description}</DialogDescription>
        </DialogHeader>
        {data && (
          <div className="space-y-4">
            <dl className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
              {data.rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 items-center">
                  <dt className="text-muted-foreground shrink-0">{r.label}</dt>
                  <dd className={r.mono ? "font-mono text-lg font-semibold tracking-wider" : "font-medium truncate"}>{r.value}</dd>
                </div>
              ))}
            </dl>
            <Button type="button" variant="outline" className="w-full h-11 rounded-xl" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar mensaje para enviar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mensaje y datos para el dueño de un restaurante con su contraseña temporal. */
export function ownerHandoff(opts: { restaurant: string; url: string | null; email: string; password: string; isNew: boolean }): HandoffData {
  const login = opts.url ? `${opts.url}/login` : "(configura ROOT_DOMAIN para tener la dirección)";
  return {
    title: opts.isNew ? "Restaurante creado" : "Acceso del dueño listo",
    description: "Pásale estos datos al dueño. La contraseña temporal no se vuelve a mostrar; al entrar pondrá una propia.",
    rows: [
      { label: "Restaurante", value: opts.restaurant },
      { label: "Entrar en", value: login },
      { label: "Correo", value: opts.email },
      { label: "Contraseña temporal", value: opts.password, mono: true },
    ],
    message: `Hola, ${opts.isNew ? `ya está listo ${opts.restaurant} en Ristemo` : `te dejo un acceso nuevo a ${opts.restaurant} en Ristemo`}.\nEntra en: ${login}\nCorreo: ${opts.email}\nContraseña temporal: ${opts.password}\nAl entrar te pedirá poner una contraseña propia.`,
  };
}
