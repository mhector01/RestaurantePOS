"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImageIcon, Loader2, Pencil, Plus, X } from "lucide-react";
import { saveExpense, setExpenseAttachment, type ExpenseInput } from "@/app/expense-actions";
import { callAction } from "@/lib/client-action";
import { resizeDocument } from "@/lib/resize-image";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, expenseAmounts, type TaxMode } from "@/lib/expenses";
import { formatMoney } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface SupplierLite {
  id: number;
  name: string;
  taxId: string | null;
}

/** Lo que el formulario necesita de un gasto existente para editarlo. */
export interface EditableExpense {
  id: number;
  date: string;
  category: string;
  description: string;
  supplierId: number | null;
  supplierName: string;
  supplierRtn: string;
  hasInvoice: boolean;
  invoiceNumber: string;
  cai: string;
  exempt: number;
  taxable15: number;
  taxable18: number;
  isv15: number;
  isv18: number;
  total: number;
  method: string;
  registerClosed: boolean;
  attachmentUrl: string | null;
  notes: string;
}

interface Form {
  date: string;
  category: string;
  description: string;
  supplier: string; // id, "" (ninguno) u "other"
  supplierName: string;
  supplierRtn: string;
  hasInvoice: boolean;
  invoiceNumber: string;
  cai: string;
  taxMode: TaxMode;
  total: string;
  isv: string; // vacío = automático
  taxable15: string;
  taxable18: string;
  exempt: string;
  method: string;
  notes: string;
}

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (n: number) => (n ? String(Math.round(n * 100) / 100) : "");

function initial(today: string, e?: EditableExpense): Form {
  if (!e) {
    return {
      date: today,
      category: "",
      description: "",
      supplier: "",
      supplierName: "",
      supplierRtn: "",
      hasInvoice: true,
      invoiceNumber: "",
      cai: "",
      taxMode: "15",
      total: "",
      isv: "",
      taxable15: "",
      taxable18: "",
      exempt: "",
      method: "TRANSFER",
      notes: "",
    };
  }
  const t15 = e.taxable15 > 0;
  const t18 = e.taxable18 > 0;
  const mode: TaxMode = !e.hasInvoice ? "15" : (t15 && t18) || ((t15 || t18) && e.exempt > 0) ? "MIXED" : t18 ? "18" : t15 ? "15" : "EXEMPT";
  return {
    date: e.date,
    category: e.category,
    description: e.description,
    supplier: e.supplierId ? String(e.supplierId) : e.supplierName ? "other" : "",
    supplierName: e.supplierName,
    supplierRtn: e.supplierRtn,
    hasInvoice: e.hasInvoice,
    invoiceNumber: e.invoiceNumber,
    cai: e.cai,
    taxMode: mode,
    total: str(e.total),
    isv: mode === "15" ? str(e.isv15) : mode === "18" ? str(e.isv18) : "",
    taxable15: str(e.taxable15),
    taxable18: str(e.taxable18),
    exempt: str(e.exempt),
    method: e.method,
    notes: e.notes,
  };
}

const MODES: { value: TaxMode; label: string }[] = [
  { value: "15", label: "ISV 15%" },
  { value: "18", label: "ISV 18%" },
  { value: "EXEMPT", label: "Exento" },
  { value: "MIXED", label: "Mixto" },
];

const selectCls = "w-full h-12 rounded-xl border border-input bg-card px-3 outline-none focus:border-primary";

export function ExpenseDialog({ suppliers, today, expense }: { suppliers: SupplierLite[]; today: string; expense?: EditableExpense }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => initial(today, expense));
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  const locked = !!expense?.registerClosed;
  const mode: TaxMode = form.hasInvoice ? form.taxMode : "EXEMPT";
  const amounts = expenseAmounts({
    mode,
    total: num(form.total),
    isv: form.isv.trim() === "" ? null : num(form.isv),
    taxable15: num(form.taxable15),
    taxable18: num(form.taxable18),
    exempt: num(form.exempt),
  });
  const ok = !("error" in amounts) ? amounts : null;
  const autoIsv = mode === "15" || mode === "18" ? expenseAmounts({ mode, total: num(form.total) }) : null;
  const autoIsvValue = autoIsv && !("error" in autoIsv) ? autoIsv.isv15 + autoIsv.isv18 : 0;

  const pickSupplier = (v: string) => {
    const s = suppliers.find((x) => String(x.id) === v);
    setForm((f) => ({ ...f, supplier: v, supplierName: s ? s.name : v === "other" ? f.supplierName : "", supplierRtn: s ? s.taxId ?? "" : v === "other" ? f.supplierRtn : "" }));
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      const blob = await resizeDocument(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la foto");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) return toast.error("Elige una categoría");
    if (!ok) return toast.error("error" in amounts ? amounts.error : "Revisa los importes");
    const input: ExpenseInput = {
      date: form.date,
      category: form.category,
      description: form.description,
      supplierId: form.supplier && form.supplier !== "other" ? parseInt(form.supplier) : null,
      supplierName: form.supplier === "other" ? form.supplierName : "",
      supplierRtn: form.supplier === "other" ? form.supplierRtn : "",
      hasInvoice: form.hasInvoice,
      invoiceNumber: form.invoiceNumber,
      cai: form.cai,
      taxMode: form.taxMode,
      total: ok.total,
      isv: form.isv.trim() === "" ? null : num(form.isv),
      taxable15: num(form.taxable15),
      taxable18: num(form.taxable18),
      exempt: num(form.exempt),
      method: form.method,
      notes: form.notes,
    };
    setSaving(true);
    const res = await callAction(() => saveExpense(expense?.id ?? null, input));
    if (!res.success || !("id" in res) || !res.id) {
      setSaving(false);
      return void toast.error(res.error ?? "No se pudo guardar");
    }
    if (photo) {
      const fd = new FormData();
      fd.set("file", photo.blob, "factura.jpg");
      const up = await callAction(() => setExpenseAttachment(res.id!, fd));
      if (!up.success) toast.error(`El gasto se guardó, pero la foto no: ${up.error ?? "error"}`);
    }
    setSaving(false);
    toast.success(expense ? "Gasto actualizado" : `Gasto registrado por ${formatMoney(ok.total)}`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setForm(initial(today, expense));
          setPhoto(null);
        }
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {expense ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${expense.description}`} title="Editar">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button className="h-11 rounded-xl">
            <Plus /> Registrar gasto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar gasto" : "Registrar gasto"}</DialogTitle>
          <DialogDescription>
            Lo que no entra al inventario. Las compras de insumos se registran en Inventario → Compras.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid sm:grid-cols-[160px_minmax(0,1fr)] gap-4">
            <F id="x-date" label="Fecha del documento">
              <Input id="x-date" type="date" value={form.date} max={today} onChange={field("date")} required className="h-12 rounded-xl" />
            </F>
            <F id="x-cat" label="Categoría">
              <select id="x-cat" value={form.category} onChange={field("category")} required className={selectCls}>
                <option value="" disabled>
                  Elige…
                </option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </F>
          </div>
          <F id="x-desc" label="Descripción">
            <Input
              id="x-desc"
              value={form.description}
              onChange={field("description")}
              required
              maxLength={200}
              placeholder="Ej. Energía eléctrica de noviembre"
              className="h-12 rounded-xl"
            />
          </F>

          {/* Proveedor */}
          <div className="grid sm:grid-cols-2 gap-4">
            <F id="x-sup" label="Proveedor">
              <select id="x-sup" value={form.supplier} onChange={(e) => pickSupplier(e.target.value)} className={selectCls}>
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="other">Otro (escribir nombre y RTN)…</option>
              </select>
            </F>
            {form.supplier === "other" && (
              <F id="x-supname" label="Nombre del proveedor">
                <Input id="x-supname" value={form.supplierName} onChange={field("supplierName")} placeholder="Ej. ENEE" className="h-12 rounded-xl" />
              </F>
            )}
            {form.supplier === "other" && (
              <F id="x-suprtn" label="RTN del proveedor" hint="14 dígitos (para el libro de compras)">
                <Input
                  id="x-suprtn"
                  inputMode="numeric"
                  value={form.supplierRtn}
                  onChange={(e) => set("supplierRtn", e.target.value.replace(/[^\d-]/g, ""))}
                  placeholder="08011999123456"
                  className="h-12 rounded-xl tabular"
                />
              </F>
            )}
          </div>

          {/* Comprobante */}
          <section className="rounded-2xl border p-4 space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border bg-muted/40">
              {[
                { v: true, label: "Factura con CAI" },
                { v: false, label: "Sin factura (recibo, ticket…)" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  disabled={locked}
                  onClick={() => set("hasInvoice", o.v)}
                  className={cn(
                    "h-10 rounded-lg text-sm font-medium transition-colors px-2",
                    form.hasInvoice === o.v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {form.hasInvoice ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <F id="x-num" label="N.º de factura">
                    <Input
                      id="x-num"
                      value={form.invoiceNumber}
                      onChange={field("invoiceNumber")}
                      required
                      placeholder="000-001-01-00012345"
                      className="h-12 rounded-xl tabular"
                    />
                  </F>
                  <F id="x-cai" label="CAI" hint="Opcional">
                    <Input id="x-cai" value={form.cai} onChange={field("cai")} placeholder="XXXXXX-XXXXXX-…" className="h-12 rounded-xl tabular uppercase" />
                  </F>
                </div>
                <div className="space-y-1.5">
                  <Label>¿Cómo viene el impuesto?</Label>
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border bg-muted/40">
                    {MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        disabled={locked}
                        onClick={() => setForm((f) => ({ ...f, taxMode: m.value, isv: "" }))}
                        className={cn(
                          "h-10 rounded-lg text-sm font-medium transition-colors",
                          form.taxMode === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin factura el gasto cuenta completo en la utilidad, pero no da crédito fiscal ni entra al libro de compras con ISV.
              </p>
            )}

            {mode === "MIXED" ? (
              <div className="grid grid-cols-3 gap-3">
                <F id="x-t15" label="Gravado 15%">
                  <Money id="x-t15" value={form.taxable15} onChange={(v) => set("taxable15", v)} disabled={locked} />
                </F>
                <F id="x-t18" label="Gravado 18%">
                  <Money id="x-t18" value={form.taxable18} onChange={(v) => set("taxable18", v)} disabled={locked} />
                </F>
                <F id="x-ex" label="Exento">
                  <Money id="x-ex" value={form.exempt} onChange={(v) => set("exempt", v)} disabled={locked} />
                </F>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <F id="x-total" label={mode === "EXEMPT" ? "Total" : "Total de la factura (con ISV)"}>
                  <Money id="x-total" value={form.total} onChange={(v) => set("total", v)} disabled={locked} autoFocus={!expense} />
                </F>
                {(mode === "15" || mode === "18") && (
                  <F id="x-isv" label={`ISV ${mode}%`} hint="Se calcula solo; corrígelo si la factura dice otra cosa">
                    <Money id="x-isv" value={form.isv} onChange={(v) => set("isv", v)} placeholder={autoIsvValue ? str(autoIsvValue) : "0.00"} disabled={locked} />
                  </F>
                )}
              </div>
            )}

            {ok && (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm rounded-xl bg-muted/40 p-3">
                <Amount label="Exento" value={ok.exempt} />
                <Amount label="Gravado" value={ok.taxable15 + ok.taxable18} />
                <Amount label="ISV a favor" value={form.hasInvoice ? ok.isv15 + ok.isv18 : 0} />
                <Amount label="Total" value={ok.total} strong />
              </dl>
            )}
            {locked && (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Este gasto ya entró en un cierre de caja: el monto y la forma de pago no se pueden cambiar.
              </p>
            )}
          </section>

          <div className="grid sm:grid-cols-2 gap-4">
            <F id="x-method" label="¿Cómo se pagó?" hint={(EXPENSE_METHODS.find((m) => m.value === form.method) as { hint?: string } | undefined)?.hint}>
              <select id="x-method" value={form.method} onChange={field("method")} disabled={locked} className={selectCls}>
                {EXPENSE_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </F>
            <div className="space-y-1.5">
              <Label>Foto de la factura</Label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => choosePhoto(e.target.files?.[0])} />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="h-12 rounded-xl flex-1" onClick={() => fileRef.current?.click()} disabled={preparing}>
                  {preparing ? <Loader2 className="animate-spin" /> : <Camera />}
                  {photo || expense?.attachmentUrl ? "Cambiar foto" : "Tomar o subir foto"}
                </Button>
                {(photo || expense?.attachmentUrl) && (
                  <a
                    href={photo?.url ?? expense!.attachmentUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="size-12 rounded-xl border grid place-items-center shrink-0 overflow-hidden bg-muted"
                    title="Ver foto"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photo ? <img src={photo.url} alt="Foto de la factura" className="size-full object-cover" /> : <ImageIcon className="size-5" />}
                  </a>
                )}
                {photo && (
                  <Button type="button" variant="ghost" size="icon" className="size-10 rounded-xl" aria-label="Quitar foto" onClick={() => setPhoto(null)}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <F id="x-notes" label="Notas" hint="Opcional">
            <textarea
              id="x-notes"
              value={form.notes}
              onChange={field("notes")}
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 outline-none focus:border-primary resize-none"
            />
          </F>

          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={saving || preparing}>
            {saving && <Loader2 className="animate-spin" />}
            {expense ? "Guardar cambios" : ok ? `Registrar ${formatMoney(ok.total)}` : "Registrar gasto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Money({
  id,
  value,
  onChange,
  placeholder = "0.00",
  disabled,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      placeholder={placeholder}
      className="h-12 rounded-xl tabular"
    />
  );
}

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular truncate", strong && "font-semibold")}>{formatMoney(value)}</dd>
    </div>
  );
}
