"use client";

import { Gift, Percent, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { formatMoney, BUSINESS } from "@/lib/config";
import {
  allocateDiscount,
  needsAuthorization,
  normalizeDni,
  type DiscountInput,
  type DiscountKind,
  type DiscountRules,
} from "@/lib/discounts";
import { cn } from "@/lib/utils";

export interface PaidLine {
  key: number; // id de la línea de la cuenta
  name: string;
  total: number;
}

const KINDS: { kind: DiscountKind; label: string; Icon: typeof Percent }[] = [
  { kind: "PERCENT", label: "Porcentaje", Icon: Percent },
  { kind: "AMOUNT", label: "Monto", Icon: Percent },
  { kind: "COURTESY", label: "Cortesía", Icon: Gift },
  { kind: "SENIOR", label: "Tercera edad", Icon: UserRound },
];

/** Calcula el descuento como lo hará el servidor (para mostrarlo antes de cobrar). */
export function previewDiscount(lines: PaidLine[], d: DiscountInput | null, rules: DiscountRules) {
  if (!d) return null;
  const alloc = allocateDiscount(lines, d, rules);
  return { ...alloc, needsPin: !alloc.error && needsAuthorization(d.kind, alloc.effectivePercent, rules) };
}

/** Sección "Descuento" de la pantalla de cobro. */
export function DiscountPanel({
  lines,
  rules,
  value,
  onChange,
}: {
  lines: PaidLine[];
  rules: DiscountRules;
  value: DiscountInput | null;
  onChange: (d: DiscountInput | null) => void;
}) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange({ kind: "PERCENT", scope: "ORDER", value: undefined })}
        className="w-full h-11 rounded-xl border border-dashed text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center justify-center gap-2"
      >
        <Percent className="size-4" /> Agregar descuento
      </button>
    );
  }

  const d = value;
  const set = (patch: Partial<DiscountInput>) => onChange({ ...d, ...patch });
  const preview = previewDiscount(lines, d, rules);
  const dniOk = !d.beneficiaryId || normalizeDni(d.beneficiaryId) !== null;

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Descuento</p>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
          <Trash2 className="size-3.5" /> Quitar
        </button>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-4 gap-1.5">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => set({ kind, value: undefined, managerPin: undefined })}
            className={cn(
              "h-10 rounded-lg border text-xs sm:text-sm font-medium",
              d.kind === kind ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* A qué se aplica */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          {(["ORDER", "ITEM"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set({ scope: s, itemId: s === "ITEM" ? (d.itemId ?? lines[0]?.key) : undefined })}
              className={cn("h-9 rounded-md text-sm font-medium", d.scope === s ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {s === "ORDER" ? "Toda la cuenta" : "Un producto"}
            </button>
          ))}
        </div>
        {d.scope === "ITEM" && (
          <select
            value={d.itemId ?? ""}
            onChange={(e) => set({ itemId: Number(e.target.value) })}
            aria-label="Producto con descuento"
            className="w-full h-11 rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary"
          >
            {lines.map((l) => (
              <option key={l.key} value={l.key}>
                {l.name} · {formatMoney(l.total)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Valor según el tipo */}
      {d.kind === "PERCENT" && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            {[5, 10, 15, 20].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set({ value: p })}
                className={cn("h-9 flex-1 rounded-lg border text-sm font-medium tabular", d.value === p ? "border-primary bg-accent" : "bg-card hover:bg-muted")}
              >
                {p}%
              </button>
            ))}
          </div>
          <Field>
            <input
              inputMode="decimal"
              value={d.value ?? ""}
              onChange={(e) => set({ value: e.target.value ? Number(e.target.value.replace(/[^\d.]/g, "")) : undefined })}
              placeholder="Otro %"
              aria-label="Porcentaje de descuento"
              className="w-full h-11 rounded-xl border bg-card px-3 pr-8 tabular outline-none focus:border-primary"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </Field>
        </div>
      )}
      {d.kind === "AMOUNT" && (
        <Field>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{BUSINESS.currency}</span>
          <input
            inputMode="decimal"
            value={d.value ?? ""}
            onChange={(e) => set({ value: e.target.value ? Number(e.target.value.replace(/[^\d.]/g, "")) : undefined })}
            placeholder="Monto a descontar"
            aria-label="Monto de descuento"
            className="w-full h-11 rounded-xl border bg-card pl-8 pr-3 tabular outline-none focus:border-primary"
          />
        </Field>
      )}
      {d.kind === "SENIOR" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {rules.seniorPercent}% de descuento de ley. Pide la identificación y anota sus datos: salen en la factura.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              value={d.beneficiaryName ?? ""}
              onChange={(e) => set({ beneficiaryName: e.target.value })}
              placeholder="Nombre del beneficiario"
              aria-label="Nombre del beneficiario"
              className="w-full h-11 rounded-xl border bg-card px-3 outline-none focus:border-primary"
            />
            <div>
              <input
                inputMode="numeric"
                value={d.beneficiaryId ?? ""}
                onChange={(e) => set({ beneficiaryId: e.target.value.replace(/[^\d-]/g, "").slice(0, 15) })}
                placeholder="Identidad (13 dígitos)"
                aria-label="Número de identidad"
                className={cn("w-full h-11 rounded-xl border bg-card px-3 tabular outline-none focus:border-primary", !dniOk && "border-destructive")}
              />
              {!dniOk && <p className="text-xs text-destructive mt-1">Deben ser 13 dígitos</p>}
            </div>
          </div>
        </div>
      )}

      {/* Motivo */}
      {d.kind !== "SENIOR" && (
        <input
          value={d.reason ?? ""}
          onChange={(e) => set({ reason: e.target.value })}
          placeholder={d.kind === "COURTESY" ? "Motivo de la cortesía (obligatorio)" : "Motivo (ej. promoción, cliente frecuente)"}
          aria-label="Motivo del descuento"
          className="w-full h-11 rounded-xl border bg-card px-3 outline-none focus:border-primary"
        />
      )}

      {/* Resultado y autorización */}
      {preview && !preview.error && preview.total > 0 && (
        <p className="text-sm font-medium text-primary tabular">Descuento: −{formatMoney(preview.total)}</p>
      )}
      {preview?.error && (d.value !== undefined || d.kind === "COURTESY" || d.kind === "SENIOR") && (
        <p className="text-xs text-destructive">{preview.error}</p>
      )}
      {preview?.needsPin && (
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" />
            {d.kind === "COURTESY" ? "La cortesía la autoriza un encargado." : `Más de ${rules.limit}% lo autoriza un encargado.`}
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={d.managerPin ?? ""}
            onChange={(e) => set({ managerPin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="PIN del encargado"
            aria-label="PIN del encargado"
            className="w-full h-11 rounded-xl border bg-card px-3 tabular tracking-[0.5em] outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>;
}
