"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Printer, Receipt, Search, X } from "lucide-react";
import { getPaymentReprint } from "@/app/receipt-actions";
import { callAction } from "@/lib/client-action";
import { printWhenReady } from "@/lib/print";
import { PAYMENT_LABEL, formatMoney } from "@/lib/config";
import { TicketPrint, type TicketPayment } from "@/components/TicketPrint";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaymentRow {
  id: number;
  createdAt: string;
  place: string; // "Mesa 4" o "Para llevar · #123"
  customer: string | null;
  waiter: string | null;
  amount: number;
  tip: number;
  discount: number;
  discountLabel: string | null;
  method: string;
  invoiceNumber: string | null;
  invoiceVoid: boolean;
}

type Filter = "all" | "invoice" | "receipt";

/** Todos los cobros del periodo, con o sin factura, para consultarlos y reimprimirlos. */
export function PaymentsList({ rows, truncated }: { rows: PaymentRow[]; truncated: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [printing, setPrinting] = useState<TicketPayment | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "invoice" && !r.invoiceNumber) return false;
      if (filter === "receipt" && r.invoiceNumber) return false;
      if (!q) return true;
      return [r.place, r.customer, r.waiter, r.invoiceNumber, `#${r.id}`, String(r.id)].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  const total = shown.reduce((s, r) => s + r.amount, 0);

  const reprint = async (id: number) => {
    setBusy(id);
    const res = await callAction(() => getPaymentReprint(id));
    if (!res || "error" in res) {
      setBusy(null);
      return void toast.error(res && "error" in res ? res.error : "No se encontró el cobro");
    }
    setPrinting(res);
    await printWhenReady();
    setPrinting(null);
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por mesa, cliente, mesero, # de comprobante o factura"
            aria-label="Buscar cobro"
            className="w-full h-11 rounded-xl border bg-card pl-10 pr-10 outline-none focus:border-primary"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {(
            [
              { key: "all", label: "Todos" },
              { key: "invoice", label: "Con factura" },
              { key: "receipt", label: "Solo recibo" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-11 px-3.5 rounded-xl text-sm font-medium border shrink-0",
                filter === f.key ? "bg-primary/15 border-primary/40 text-primary" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {shown.length} cobro{shown.length === 1 ? "" : "s"} · {formatMoney(total)}
        {truncated && " · se muestran los 300 más recientes; acorta el periodo para ver los demás"}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          {rows.length === 0 ? "No hay cobros en este periodo." : "Ningún cobro coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <span
                className={cn(
                  "size-10 rounded-xl grid place-items-center shrink-0",
                  r.invoiceNumber ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
                title={r.invoiceNumber ? "Con factura" : "Recibo"}
              >
                {r.invoiceNumber ? <FileText className="size-5" /> : <Receipt className="size-5" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {r.place}
                  {r.customer && <span className="text-muted-foreground font-normal"> · {r.customer}</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(r.createdAt).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}
                  {" · "}
                  {r.invoiceNumber ? (
                    <span className={cn("tabular", r.invoiceVoid && "line-through")}>
                      Factura {r.invoiceNumber}
                      {r.invoiceVoid && " (anulada)"}
                    </span>
                  ) : (
                    `Recibo #${r.id}`
                  )}
                  {r.waiter && ` · ${r.waiter}`}
                  {r.discount > 0 && ` · ${r.discountLabel ?? "Descuento"}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold tabular">{formatMoney(r.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {PAYMENT_LABEL[r.method] ?? r.method}
                  {r.tip > 0 && ` · +${formatMoney(r.tip)} propina`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl shrink-0"
                aria-label={`Reimprimir ${r.invoiceNumber ? `factura ${r.invoiceNumber}` : `recibo #${r.id}`}`}
                title="Reimprimir"
                disabled={busy !== null}
                onClick={() => reprint(r.id)}
              >
                {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {printing && <TicketPrint payment={printing} copy />}
    </div>
  );
}
