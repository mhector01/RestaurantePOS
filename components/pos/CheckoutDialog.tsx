"use client";

import { printWhenReady } from "@/lib/print";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Banknote, Check, CreditCard, FileText, Loader2, Minus, Plus, Printer } from "lucide-react";
import { processFullPayment, processProductPayment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketPrint, type TicketPayment } from "@/components/TicketPrint";
import { PAYMENT_LABEL, formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";
import { normalizeRtn } from "@/lib/fiscal";
import type { OrderLine } from "./OrderWorkspace";
import { DiscountPanel, previewDiscount, type PaidLine } from "./DiscountPanel";
import type { DiscountInput, DiscountRules } from "@/lib/discounts";
import { callAction } from "@/lib/client-action";

type Mode = "full" | "split";
type Method = "CASH" | "CARD";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialMode: Mode;
  orderId: number;
  mesaId: number;
  items: OrderLine[];
  takeout?: boolean;
  /** Facturación con CAI activa: se pide (opcional) el RTN del cliente. */
  invoicing?: boolean;
  /** Límite de descuento sin autorización y % de tercera edad del restaurante. */
  discountRules: DiscountRules;
}

type Paid = TicketPayment & { remainingItems: number; invoiceWarning?: string };

/** Sugerencias de billetes para el efectivo recibido. */
function cashSuggestions(total: number) {
  const bills = [20, 50, 100, 200, 500, 1000];
  const out = new Set<number>();
  for (const b of bills) {
    const v = Math.ceil(total / b) * b;
    if (v > total) out.add(v);
    if (out.size >= 3) break;
  }
  return [...out];
}

export function CheckoutDialog({
  open,
  onOpenChange,
  initialMode,
  orderId,
  mesaId,
  items,
  takeout = false,
  invoicing = false,
  discountRules,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>("CASH");
  const [qty, setQty] = useState<Record<number, number>>({});
  const [received, setReceived] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Paid | null>(null);
  const [discount, setDiscount] = useState<DiscountInput | null>(null);
  const [withRtn, setWithRtn] = useState(false);
  const [rtn, setRtn] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paidInfo, setPaidInfo] = useState<{ received: number; change: number } | null>(null);

  // Reinicia el estado cada vez que se abre
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setMode(initialMode);
      setMethod("CASH");
      setQty({});
      setReceived("");
      setResult(null);
      setPaidInfo(null);
      setWithRtn(false);
      setRtn("");
      setCustomerName("");
      setDiscount(null);
    }
  }

  const fullTotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const splitTotal = items.reduce((s, i) => s + i.price * (qty[i.id] ?? 0), 0);
  const gross = mode === "full" ? fullTotal : splitTotal;
  // Lo que se cobra en este pago (para repartir el descuento como lo hará el servidor)
  const paidLines: PaidLine[] = items
    .map((i) => ({ key: i.id, name: i.name, total: Math.round(i.price * (mode === "full" ? i.quantity : (qty[i.id] ?? 0)) * 100) / 100 }))
    .filter((l) => l.total > 0);
  const preview = previewDiscount(paidLines, discount, discountRules);
  const discountAmount = preview && !preview.error ? preview.total : 0;
  const total = Math.round((gross - discountAmount) * 100) / 100;
  const discountBlocked =
    !!discount && (!!preview?.error || (preview?.needsPin && (discount.managerPin ?? "").length !== 4));

  const receivedNum = parseFloat(received) || 0;
  const change = method === "CASH" && receivedNum > 0 ? receivedNum - total : 0;
  const insufficient = method === "CASH" && receivedNum > 0 && receivedNum < total;

  const setLine = (id: number, max: number, value: number) =>
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(max, value)) }));

  const rtnInvalid = withRtn && rtn.trim() !== "" && !normalizeRtn(rtn);
  const missingName = withRtn && normalizeRtn(rtn) !== null && !customerName.trim();

  const pay = async () => {
    if (gross <= 0) return;
    if (discountBlocked) return toast.error(preview?.error ?? "Falta el PIN del encargado para el descuento");
    if (withRtn && (rtnInvalid || !normalizeRtn(rtn))) return toast.error("El RTN debe tener 14 dígitos");
    if (missingName) return toast.error("Escribe el nombre o razón social del cliente");
    const customer = withRtn ? { rtn, name: customerName } : undefined;
    setLoading(true);
    try {
      const res = await callAction(() =>
        mode === "full"
          ? processFullPayment(orderId, mesaId, method, customer, discount)
          : processProductPayment(
              orderId,
              mesaId,
              Object.entries(qty)
                .filter(([, q]) => q > 0)
                .map(([id, q]) => ({ id: Number(id), quantity: q })),
              method,
              customer,
              discount
            )
      );
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (!("id" in res)) throw new Error("sin resultado");
      setResult(res as unknown as Paid);
      if (res.invoiceWarning) toast.warning(res.invoiceWarning, { duration: 8000 });
      setPaidInfo({ received: receivedNum, change: Math.max(0, change) });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo registrar el pago. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    onOpenChange(false);
    if (result && result.remainingItems === 0) router.push(takeout ? "/llevar" : "/");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (loading) return;
        if (!v && result) return finish();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="sm:max-w-lg rounded-3xl p-0 gap-0 max-h-[92dvh] flex flex-col overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {result ? (
          // ------------------ PAGO REGISTRADO ------------------
          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            <span className="size-16 rounded-full bg-success text-white grid place-items-center mb-4">
              <Check className="size-8" strokeWidth={3} />
            </span>
            <DialogTitle className="text-xl">Pago registrado</DialogTitle>
            <DialogDescription className="mt-1">
              {formatMoney(result.amount)} · {PAYMENT_LABEL[result.method] ?? result.method}
            </DialogDescription>
            {result.invoice && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium tabular">
                <FileText className="size-4 text-primary" /> Factura {result.invoice.number}
              </p>
            )}
            {result.invoiceWarning && (
              <p className="mt-3 w-full rounded-xl bg-red-500/10 text-red-300 text-sm p-3 flex gap-2 text-left">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" /> {result.invoiceWarning}
              </p>
            )}

            {paidInfo && paidInfo.received > 0 && method === "CASH" && (
              <div className="mt-5 w-full rounded-2xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">Cambio a entregar</p>
                <p className="text-4xl font-semibold tabular mt-1">{formatMoney(paidInfo.change)}</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground mt-4">
              {result.remainingItems === 0
                ? takeout
                  ? "Pedido pagado. Entrégalo al cliente cuando cocina lo marque listo."
                  : "La cuenta quedó saldada y la mesa está libre."
                : takeout
                  ? "Aún quedan productos por cobrar en este pedido."
                  : "Aún quedan productos por cobrar en esta mesa."}
            </p>

            <div className="grid grid-cols-2 gap-2 w-full mt-6">
              <Button variant="outline" className="h-12 rounded-xl" onClick={() => printWhenReady()}>
                <Printer /> Imprimir
              </Button>
              <Button className="h-12 rounded-xl" onClick={finish}>
                {result.remainingItems === 0 ? (takeout ? "Ir a pedidos" : "Ir a mesas") : "Seguir cobrando"}
              </Button>
            </div>
            <TicketPrint payment={result} received={paidInfo?.received} change={paidInfo?.change} />
          </div>
        ) : (
          // ------------------ FORMULARIO DE COBRO ------------------
          <>
            <DialogHeader className="p-5 pb-3 sm:p-6 sm:pb-4 text-left">
              <DialogTitle className="text-xl">Cobrar</DialogTitle>
              <DialogDescription>Elige qué cobrar y cómo paga el cliente.</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5 sm:px-6 space-y-5 pb-4">
              {/* Qué se cobra */}
              <Segmented
                value={mode}
                onChange={(v) => setMode(v as Mode)}
                options={[
                  { value: "full", label: "Cuenta completa" },
                  { value: "split", label: "Dividir por productos" },
                ]}
              />

              {mode === "split" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Selecciona lo que paga esta persona</p>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary"
                      onClick={() => setQty({})}
                    >
                      Limpiar
                    </button>
                  </div>
                  <ul className="rounded-2xl border divide-y">
                    {items.map((item) => {
                      const q = qty[item.id] ?? 0;
                      return (
                        <li key={item.id} className="flex items-center gap-3 p-3">
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left"
                            onClick={() => setLine(item.id, item.quantity, q === item.quantity ? 0 : item.quantity)}
                          >
                            <p className="font-medium truncate">{item.name}</p>
                            {item.detail && <p className="text-xs text-muted-foreground truncate">{item.detail}</p>}
                            <p className="text-xs text-muted-foreground tabular">
                              {formatMoney(item.price)} · {item.quantity} en cuenta
                            </p>
                          </button>
                          <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                            <button
                              type="button"
                              aria-label="Menos"
                              className="size-9 rounded-lg grid place-items-center hover:bg-card disabled:opacity-30"
                              disabled={q === 0}
                              onClick={() => setLine(item.id, item.quantity, q - 1)}
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className={cn("w-7 text-center font-semibold tabular", q > 0 && "text-primary")}>
                              {q}
                            </span>
                            <button
                              type="button"
                              aria-label="Más"
                              className="size-9 rounded-lg grid place-items-center hover:bg-card disabled:opacity-30"
                              disabled={q >= item.quantity}
                              onClick={() => setLine(item.id, item.quantity, q + 1)}
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Descuento */}
              {paidLines.length > 0 && (
                <DiscountPanel lines={paidLines} rules={discountRules} value={discount} onChange={setDiscount} />
              )}

              {/* Método de pago */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "CASH", label: "Efectivo", Icon: Banknote },
                      { id: "CARD", label: "Tarjeta", Icon: CreditCard },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMethod(id)}
                      className={cn(
                        "h-14 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all",
                        method === id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"
                      )}
                    >
                      <Icon className="size-5" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Factura a nombre de un cliente con RTN */}
              {invoicing && (
                <div className="rounded-2xl border p-3 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withRtn}
                      onChange={(e) => setWithRtn(e.target.checked)}
                      className="size-5 accent-[var(--primary)]"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">Factura con RTN</span>
                      <span className="block text-xs text-muted-foreground">
                        {withRtn ? "Datos del cliente para la factura" : "Si no, sale a nombre de Consumidor final"}
                      </span>
                    </span>
                  </label>
                  {withRtn && (
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <input
                          inputMode="numeric"
                          value={rtn}
                          onChange={(e) => setRtn(e.target.value.replace(/[^\d-]/g, "").slice(0, 16))}
                          placeholder="RTN (14 dígitos)"
                          aria-label="RTN del cliente"
                          className={cn(
                            "w-full h-11 rounded-xl border bg-card px-3 tabular outline-none focus:border-primary",
                            rtnInvalid && "border-destructive"
                          )}
                        />
                        {rtnInvalid && <p className="text-xs text-destructive mt-1">Deben ser 14 dígitos</p>}
                      </div>
                      <input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nombre o razón social"
                        aria-label="Nombre o razón social del cliente"
                        className="w-full h-11 rounded-xl border bg-card px-3 outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Calculadora de cambio */}
              {method === "CASH" && total > 0 && (
                <div className="space-y-2">
                  <label htmlFor="received" className="text-sm font-medium">
                    Efectivo recibido <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    id="received"
                    inputMode="decimal"
                    value={received}
                    onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.00"
                    className="w-full h-12 rounded-xl border bg-card px-4 text-lg font-semibold tabular outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Chip onClick={() => setReceived(total.toFixed(2))}>Exacto</Chip>
                    {cashSuggestions(total).map((v) => (
                      <Chip key={v} onClick={() => setReceived(String(v))}>
                        {formatMoney(v)}
                      </Chip>
                    ))}
                  </div>
                  {receivedNum > 0 && (
                    <p className={cn("text-sm font-medium", insufficient ? "text-destructive" : "text-success")}>
                      {insufficient
                        ? `Faltan ${formatMoney(total - receivedNum)}`
                        : `Cambio: ${formatMoney(change)}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Pie con total y botón */}
            <div className="border-t p-4 sm:p-5 flex items-center gap-4 bg-muted/40">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Total a cobrar</p>
                {discountAmount > 0 && (
                  <p className="text-xs text-muted-foreground tabular">
                    <span className="line-through">{formatMoney(gross)}</span> · descuento −{formatMoney(discountAmount)}
                  </p>
                )}
                <p className="text-2xl font-semibold tabular">{formatMoney(total)}</p>
              </div>
              <Button
                className="h-12 px-6 rounded-xl text-base"
                disabled={loading || gross <= 0 || insufficient || discountBlocked}
                onClick={pay}
              >
                {loading && <Loader2 className="animate-spin" />}
                Cobrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-lg text-sm font-medium transition-all",
            value === o.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-3 rounded-lg border bg-card text-sm font-medium tabular hover:border-primary/50 hover:bg-accent transition-colors"
    >
      {children}
    </button>
  );
}
