"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, FileText, ImageIcon, Loader2, Receipt, Search, X } from "lucide-react";
import { setExpensePaid, voidExpense } from "@/app/expense-actions";
import { callAction } from "@/lib/client-action";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_METHODS, EXPENSE_METHOD_LABEL } from "@/lib/expenses";
import { formatMoney } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExpenseDialog, type EditableExpense, type SupplierLite } from "@/components/expenses/ExpenseDialog";
import { cn } from "@/lib/utils";

export interface ExpenseRow extends EditableExpense {
  paid: boolean;
  status: string;
  voidReason: string | null;
  createdBy: string | null;
}

type Filter = "all" | "invoice" | "noinvoice" | "unpaid" | "void";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "invoice", label: "Con factura" },
  { key: "noinvoice", label: "Sin factura" },
  { key: "unpaid", label: "Por pagar" },
  { key: "void", label: "Anulados" },
];

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
};

export function ExpensesList({ rows, suppliers, today, truncated }: { rows: ExpenseRow[]; suppliers: SupplierLite[]; today: string; truncated: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [paying, setPaying] = useState<ExpenseRow | null>(null);
  const [voiding, setVoiding] = useState<ExpenseRow | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "void" ? r.status !== "VOID" : r.status === "VOID" && filter !== "all") return false;
      if (filter === "invoice" && !r.hasInvoice) return false;
      if (filter === "noinvoice" && r.hasInvoice) return false;
      if (filter === "unpaid" && r.paid) return false;
      if (category && r.category !== category) return false;
      if (!q) return true;
      return [r.description, r.supplierName, r.supplierRtn, r.invoiceNumber, r.notes, EXPENSE_CATEGORY_LABEL[r.category]].some((v) =>
        v?.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter, category]);
  const total = shown.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por descripción, proveedor, RTN o factura"
            aria-label="Buscar gasto"
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
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filtrar por categoría"
          className="h-11 rounded-xl border bg-card px-3 outline-none focus:border-primary sm:w-56"
        >
          <option value="">Todas las categorías</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="-mx-4 sm:mx-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-10 px-3.5 rounded-xl text-sm font-medium border shrink-0",
                filter === f.key ? "bg-primary/15 border-primary/40 text-primary" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {shown.length} gasto{shown.length === 1 ? "" : "s"}
        {filter !== "void" && ` · ${formatMoney(total)}`}
        {truncated && " · se muestran los 500 más recientes; acorta el periodo para ver los demás"}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          {rows.length === 0 ? "No hay gastos en este periodo. Registra el alquiler, la luz, el agua, los sueldos…" : "Ningún gasto coincide."}
        </p>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
          {shown.map((r) => {
            const isv = r.isv15 + r.isv18;
            const isVoid = r.status === "VOID";
            return (
              <li key={r.id} className={cn("flex items-center gap-3 px-4 sm:px-5 py-3", isVoid && "opacity-60")}>
                <span
                  className={cn(
                    "size-10 rounded-xl grid place-items-center shrink-0",
                    r.hasInvoice ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                  title={r.hasInvoice ? "Con factura" : "Sin factura"}
                >
                  {r.hasInvoice ? <FileText className="size-5" /> : <Receipt className="size-5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-medium truncate", isVoid && "line-through")}>
                    {r.description}
                    {r.supplierName && <span className="text-muted-foreground font-normal"> · {r.supplierName}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {fmtDay(r.date)} · {EXPENSE_CATEGORY_LABEL[r.category] ?? r.category}
                    {r.hasInvoice && r.invoiceNumber && <span className="tabular"> · Fact. {r.invoiceNumber}</span>}
                    {isVoid && ` · Anulado: ${r.voidReason ?? ""}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold tabular">{formatMoney(r.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {!r.paid && !isVoid ? (
                      <span className="text-amber-600 dark:text-amber-300 font-medium">Por pagar</span>
                    ) : (
                      EXPENSE_METHOD_LABEL[r.method] ?? r.method
                    )}
                    {isv > 0 && ` · ISV ${formatMoney(isv)}`}
                  </p>
                </div>
                <div className="flex shrink-0">
                  {r.attachmentUrl && (
                    <a
                      href={r.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="size-10 rounded-xl grid place-items-center text-muted-foreground hover:bg-muted"
                      aria-label="Ver foto de la factura"
                      title="Ver foto"
                    >
                      <ImageIcon className="size-4" />
                    </a>
                  )}
                  {!isVoid && !r.paid && (
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl" title="Marcar pagado" aria-label="Marcar pagado" onClick={() => setPaying(r)}>
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                  {!isVoid && <ExpenseDialog suppliers={suppliers} today={today} expense={r} />}
                  {!isVoid && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 rounded-xl text-muted-foreground hover:text-red-500"
                      title="Anular"
                      aria-label={`Anular ${r.description}`}
                      onClick={() => setVoiding(r)}
                    >
                      <Ban className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PayDialog expense={paying} onClose={() => setPaying(null)} />
      <VoidDialog expense={voiding} onClose={() => setVoiding(null)} />
    </div>
  );
}

function PayDialog({ expense, onClose }: { expense: ExpenseRow | null; onClose: () => void }) {
  const router = useRouter();
  const [method, setMethod] = useState("TRANSFER");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!expense) return;
    setBusy(true);
    const res = await callAction(() => setExpensePaid(expense.id, method));
    setBusy(false);
    if (!res.success) return void toast.error(res.error ?? "No se pudo guardar");
    toast.success("Gasto marcado como pagado");
    onClose();
    router.refresh();
  };
  return (
    <Dialog open={!!expense} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Marcar pagado</DialogTitle>
          <DialogDescription>
            {expense?.description} · {expense && formatMoney(expense.total)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pay-method">¿Cómo se pagó?</Label>
          <select
            id="pay-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full h-12 rounded-xl border border-input bg-card px-3 outline-none focus:border-primary"
          >
            {EXPENSE_METHODS.filter((m) => m.value !== "CREDIT").map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <Button className="w-full h-12 rounded-xl" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Marcar pagado
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({ expense, onClose }: { expense: ExpenseRow | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;
    setBusy(true);
    const res = await callAction(() => voidExpense(expense.id, reason));
    setBusy(false);
    if (!res.success) return void toast.error(res.error ?? "No se pudo anular");
    toast.success("Gasto anulado");
    setReason("");
    onClose();
    router.refresh();
  };
  return (
    <Dialog open={!!expense} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Anular gasto</DialogTitle>
          <DialogDescription>
            {expense?.description} · {expense && formatMoney(expense.total)}. Queda en el historial, pero deja de contar en los reportes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Motivo</Label>
            <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus placeholder="Ej. Se registró dos veces" className="h-12 rounded-xl" />
          </div>
          {expense?.registerClosed && (
            <p className="text-xs text-amber-600 dark:text-amber-300">Este gasto ya se descontó en un cierre de caja; ese cierre no cambia.</p>
          )}
          <Button type="submit" variant="destructive" className="w-full h-12 rounded-xl" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Anular gasto
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
