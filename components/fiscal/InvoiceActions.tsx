"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Ban, Loader2, Printer, UserPen } from "lucide-react";
import { getInvoiceForPrint, reissueInvoice, voidInvoice } from "@/app/fiscal-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceBody } from "@/components/InvoicePrint";
import { normalizeRtn, type InvoiceView } from "@/lib/fiscal";

export function InvoiceActions({ id, number, voided }: { id: number; number: string; voided: boolean }) {
  const [printing, setPrinting] = useState<InvoiceView | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"void" | "reissue" | null>(null);
  const [reason, setReason] = useState("");
  const [rtn, setRtn] = useState("");
  const [name, setName] = useState("");

  const reprint = async (inv?: InvoiceView, invId = id) => {
    setBusy(true);
    try {
      const data = inv ?? (await getInvoiceForPrint(invId));
      if (!data) return toast.error("No se encontró la factura");
      setPrinting(data);
      // Espera a que el contenido esté en el DOM antes de imprimir
      setTimeout(() => {
        window.print();
        setPrinting(null);
      }, 150);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "void") {
        const res = await voidInvoice(id, reason);
        if (!res.success) return toast.error(res.error ?? "No se pudo anular");
        toast.success(`Factura ${number} anulada`);
        setMode(null);
      } else if (mode === "reissue") {
        if (rtn.trim() && !normalizeRtn(rtn)) return toast.error("El RTN debe tener 14 dígitos");
        const res = await reissueInvoice(id, { rtn, name });
        if (!res.success) return toast.error(res.error ?? "No se pudo reemitir");
        toast.success(`Se anuló la ${number} y se emitió la ${res.invoice.number}`);
        setMode(null);
        await reprint(undefined, res.invoice.id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={`Reimprimir ${number}`} title="Reimprimir" onClick={() => reprint()} disabled={busy}>
          {busy && !mode ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
        </Button>
        {!voided && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              aria-label="Corregir datos del cliente"
              title="Corregir cliente / agregar RTN"
              onClick={() => {
                setRtn("");
                setName("");
                setMode("reissue");
              }}
            >
              <UserPen className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg text-muted-foreground hover:text-destructive"
              aria-label={`Anular ${number}`}
              title="Anular"
              onClick={() => {
                setReason("");
                setMode("void");
              }}
            >
              <Ban className="size-4" />
            </Button>
          </>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(v) => !v && !busy && setMode(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{mode === "void" ? `Anular factura ${number}` : "Corregir datos del cliente"}</DialogTitle>
            <DialogDescription>
              {mode === "void"
                ? "El número queda usado y la factura se conserva como ANULADA en el libro de ventas. El pago no se modifica."
                : "Se anula esta factura y se emite una nueva, con el siguiente número, con los mismos productos y los datos que indiques."}
            </DialogDescription>
          </DialogHeader>
          {mode === "void" ? (
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (ej. error en la venta, devolución)"
              className="w-full h-12 rounded-xl border bg-card px-3 outline-none focus:border-primary"
            />
          ) : (
            <div className="space-y-2">
              <input
                autoFocus
                inputMode="numeric"
                value={rtn}
                onChange={(e) => setRtn(e.target.value.replace(/[^\d-]/g, "").slice(0, 16))}
                placeholder="RTN (14 dígitos, vacío = consumidor final)"
                className="w-full h-12 rounded-xl border bg-card px-3 tabular outline-none focus:border-primary"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre o razón social"
                className="w-full h-12 rounded-xl border bg-card px-3 outline-none focus:border-primary"
              />
            </div>
          )}
          <Button
            variant={mode === "void" ? "destructive" : "default"}
            className="h-12 rounded-xl"
            onClick={submit}
            disabled={busy || (mode === "void" && !reason.trim())}
          >
            {busy && <Loader2 className="animate-spin" />}
            {mode === "void" ? "Anular factura" : "Anular y emitir nueva"}
          </Button>
        </DialogContent>
      </Dialog>

      {printing &&
        createPortal(
          <div className="print-area hidden print:block">
            <InvoiceBody invoice={printing} copy />
          </div>,
          document.body
        )}
    </>
  );
}
