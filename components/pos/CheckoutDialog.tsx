"use client";

import { printWhenReady } from "@/lib/print";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Banknote, Check, CreditCard, FileText, Landmark, Loader2, Minus, Plus, Printer, Split } from "lucide-react";
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
import { computeTip, type TipInput, type TipRules } from "@/lib/tips";
import { callAction } from "@/lib/client-action";
import { paymentText } from "@/lib/payments";

type Mode = "full" | "split";
type Method = "CASH" | "CARD" | "TRANSFER" | "MIXED";

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
  /** Propina sugerida del restaurante. */
  tipRules: TipRules;
}

type Paid = TicketPayment & { remainingItems: number; invoiceWarning?: string };
type TipChoice = "none" | "suggested" | "other";

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
  tipRules,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [method, setMethod] = useState<Method>("CASH");
  const [qty, setQty] = useState<Record<number, number>>({});
  const [received, setReceived] = useState("");
  // Pago mixto: lo que se pasa con tarjeta; el resto se cobra en efectivo
  const [cardPart, setCardPart] = useState("");
  const [mixedWith, setMixedWith] = useState<"CARD" | "TRANSFER">("CARD");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Paid | null>(null);
  const [discount, setDiscount] = useState<DiscountInput | null>(null);
  // La propina siempre empieza en "No": solo se cobra si el cliente la acepta
  const [tipChoice, setTipChoice] = useState<TipChoice>("none");
  const [tipOther, setTipOther] = useState("");
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
      setCardPart("");
      setMixedWith("CARD");
      setReference("");
      setResult(null);
      setPaidInfo(null);
      setWithRtn(false);
      setRtn("");
      setCustomerName("");
      setDiscount(null);
      setTipChoice("none");
      setTipOther("");
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
  const consumption = Math.round((gross - discountAmount) * 100) / 100;
  const tipInput: TipInput | null =
    !tipRules.enabled || tipChoice === "none"
      ? null
      : tipChoice === "suggested"
        ? { percent: tipRules.percent }
        : { amount: parseFloat(tipOther) || 0 };
  const tip = computeTip(consumption, tipInput);
  // Lo que paga el cliente: consumo (facturado) + propina voluntaria (aparte)
  const total = Math.round((consumption + tip) * 100) / 100;
  const discountBlocked =
    !!discount && (!!preview?.error || (preview?.needsPin && (discount.managerPin ?? "").length !== 4));

  const cardNum = Math.round((parseFloat(cardPart) || 0) * 100) / 100;
  const mixedInvalid = method === "MIXED" && !(cardNum > 0 && cardNum < total);
  // Lo que se cobra en efectivo: todo, o en mixto lo que no va con tarjeta
  const otherLabel = mixedWith === "TRANSFER" ? "Transferencia" : "Tarjeta";
  const usesTransfer = method === "TRANSFER" || (method === "MIXED" && mixedWith === "TRANSFER");
  const cashDue = method === "CARD" || method === "TRANSFER" ? 0 : method === "MIXED" ? Math.round((total - cardNum) * 100) / 100 : total;
  const receivedNum = parseFloat(received) || 0;
  const change = cashDue > 0 && receivedNum > 0 ? receivedNum - cashDue : 0;
  const insufficient = cashDue > 0 && receivedNum > 0 && receivedNum < cashDue;

  const setLine = (id: number, max: number, value: number) =>
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(max, value)) }));

  const rtnInvalid = withRtn && rtn.trim() !== "" && !normalizeRtn(rtn);
  const missingName = withRtn && normalizeRtn(rtn) !== null && !customerName.trim();

  const pay = async () => {
    if (gross <= 0) return;
    if (discountBlocked) return toast.error(preview?.error ?? "Falta el PIN del encargado para el descuento");
    if (withRtn && (rtnInvalid || !normalizeRtn(rtn))) return toast.error("El RTN debe tener 14 dígitos");
    if (missingName) return toast.error("Escribe el nombre o razón social del cliente");
    if (mixedInvalid) return toast.error(`Escribe cuánto va con ${otherLabel.toLowerCase()} (menos de ${formatMoney(total)})`);
    const card = {
      cardAmount: method === "MIXED" ? cardNum : null,
      mixedWith: method === "MIXED" ? mixedWith : null,
      reference: usesTransfer ? reference : null,
    };
    const customer = withRtn ? { rtn, name: customerName } : undefined;
    setLoading(true);
    try {
      const res = await callAction(() =>
        mode === "full"
          ? processFullPayment(orderId, mesaId, method, customer, discount, tipInput, card)
          : processProductPayment(
              orderId,
              mesaId,
              Object.entries(qty)
                .filter(([, q]) => q > 0)
                .map(([id, q]) => ({ id: Number(id), quantity: q })),
              method,
              customer,
              discount,
              tipInput,
              card
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
              {formatMoney(result.amount)}
              {(result.tip ?? 0) > 0 && ` + propina ${formatMoney(result.tip ?? 0)}`} ·{" "}
              {paymentText(result, formatMoney, PAYMENT_LABEL)}
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

            {paidInfo && paidInfo.received > 0 && method !== "CARD" && (
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

              {/* Propina voluntaria */}
              {tipRules.enabled && consumption > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    ¿El cliente deja propina? <span className="text-muted-foreground font-normal">(voluntaria)</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "none", label: "No" },
                        { id: "suggested", label: `Sí, ${tipRules.percent}%` },
                        { id: "other", label: "Otro monto" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setTipChoice(o.id)}
                        className={cn(
                          "h-11 rounded-xl border-2 text-sm font-medium transition-all",
                          tipChoice === o.id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {tipChoice === "suggested" && (
                    <p className="text-xs text-muted-foreground tabular">
                      {tipRules.percent}% de {formatMoney(consumption)} = {formatMoney(tip)}
                    </p>
                  )}
                  {tipChoice === "other" && (
                    <input
                      inputMode="decimal"
                      value={tipOther}
                      onChange={(e) => setTipOther(e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="Monto de la propina"
                      aria-label="Monto de la propina"
                      className="w-full h-11 rounded-xl border bg-card px-3 tabular outline-none focus:border-primary"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    No lleva ISV. En la factura sale aparte, debajo del total.
                  </p>
                </div>
              )}

              {/* Método de pago */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "CASH", label: "Efectivo", Icon: Banknote },
                      { id: "CARD", label: "Tarjeta", Icon: CreditCard },
                      { id: "TRANSFER", label: "Transferencia", Icon: Landmark },
                      { id: "MIXED", label: "Mixto", Icon: Split },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setMethod(id);
                        setReceived("");
                      }}
                      className={cn(
                        "h-14 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all px-3",
                        method === id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"
                      )}
                    >
                      <Icon className="size-5 shrink-0" /> {label}
                    </button>
                  ))}
                </div>
                {method === "MIXED" && (
                  <div className="rounded-2xl border p-3 space-y-2">
                    <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
                      {(
                        [
                          { value: "CARD", label: "Efectivo + tarjeta" },
                          { value: "TRANSFER", label: "Efectivo + transferencia" },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setMixedWith(o.value)}
                          className={cn(
                            "h-10 rounded-lg text-sm font-medium transition-all",
                            mixedWith === o.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <label htmlFor="card-part" className="text-sm font-medium block">
                      ¿Cuánto paga con {otherLabel.toLowerCase()}?
                    </label>
                    <input
                      id="card-part"
                      inputMode="decimal"
                      autoFocus
                      value={cardPart}
                      onChange={(e) => {
                        setCardPart(e.target.value.replace(/[^\d.]/g, ""));
                        setReceived("");
                      }}
                      placeholder="0.00"
                      className={cn(
                        "w-full h-12 rounded-xl border bg-card px-4 text-lg font-semibold tabular outline-none focus:border-primary focus:ring-3 focus:ring-primary/20",
                        cardPart !== "" && mixedInvalid && "border-destructive"
                      )}
                    />
                    {cardPart !== "" && mixedInvalid ? (
                      <p className="text-sm text-destructive">Debe ser menos que el total ({formatMoney(total)})</p>
                    ) : (
                      cardNum > 0 && (
                        <p className="text-sm text-muted-foreground tabular">
                          {otherLabel} <span className="font-semibold text-foreground">{formatMoney(cardNum)}</span> · Efectivo{" "}
                          <span className="font-semibold text-foreground">{formatMoney(cashDue)}</span>
                        </p>
                      )
                    )}
                  </div>
                )}
                {usesTransfer && (
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value.slice(0, 60))}
                    placeholder="Referencia de la transferencia (opcional)"
                    aria-label="Referencia de la transferencia"
                    className="w-full h-11 rounded-xl border bg-card px-3 tabular outline-none focus:border-primary"
                  />
                )}
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
              {cashDue > 0 && (method === "CASH" || cardNum > 0) && (
                <div className="space-y-2">
                  <label htmlFor="received" className="text-sm font-medium">
                    Efectivo recibido{method === "MIXED" && ` (de ${formatMoney(cashDue)})`}{" "}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
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
                    <Chip onClick={() => setReceived(cashDue.toFixed(2))}>Exacto</Chip>
                    {cashSuggestions(cashDue).map((v) => (
                      <Chip key={v} onClick={() => setReceived(String(v))}>
                        {formatMoney(v)}
                      </Chip>
                    ))}
                  </div>
                  {receivedNum > 0 && (
                    <p className={cn("text-sm font-medium", insufficient ? "text-destructive" : "text-success")}>
                      {insufficient
                        ? `Faltan ${formatMoney(cashDue - receivedNum)}`
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
                {tip > 0 && (
                  <p className="text-xs text-muted-foreground tabular">
                    Consumo {formatMoney(consumption)} + propina {formatMoney(tip)}
                  </p>
                )}
                <p className="text-2xl font-semibold tabular">{formatMoney(total)}</p>
              </div>
              <Button
                className="h-12 px-6 rounded-xl text-base"
                disabled={loading || gross <= 0 || insufficient || discountBlocked || mixedInvalid}
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
