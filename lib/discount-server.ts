// Validación del descuento en el servidor: reglas del restaurante, datos obligatorios y PIN de encargado.
// La pantalla de cobro calcula lo mismo para mostrarlo, pero lo que vale es lo de aquí.
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getRestaurant } from "@/lib/tenant";
import {
  allocateDiscount,
  discountLabel,
  needsAuthorization,
  normalizeDni,
  type DiscountInput,
  type DiscountRules,
} from "@/lib/discounts";
import { PIN_LIMIT, blockedMinutes, clearFailures, registerFailure } from "@/lib/rate-limit";
import type { TipRules } from "@/lib/tips";

const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function discountRules(): Promise<DiscountRules> {
  const r = await getRestaurant();
  return { limit: r?.discountLimit ?? 10, seniorPercent: r?.seniorPercent ?? 25 };
}

/** Propina sugerida del restaurante (pre-cuenta y cobro). */
export async function tipRules(): Promise<TipRules> {
  const r = await getRestaurant();
  return { enabled: r?.tipEnabled ?? true, percent: r?.tipPercent ?? 10 };
}

/** Encargado (rol ADMIN en Personal) dueño de este PIN, con freno contra intentos. */
async function managerByPin(pin: string) {
  const h = await headers();
  const key = `mgr-pin:${h.get("host")}:${h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  const wait = blockedMinutes(key);
  if (wait) return { error: `Demasiados intentos de PIN. Espera ${wait} min.` };
  const user = /^\d{4}$/.test(pin) ? await prisma.user.findFirst({ where: { pin, role: "ADMIN" } }) : null;
  if (!user) {
    registerFailure(key, PIN_LIMIT);
    return { error: "PIN de encargado incorrecto" };
  }
  clearFailures(key);
  return { user };
}

export interface ResolvedDiscount {
  perLine: number[];
  total: number;
  record: {
    kind: string;
    scope: string;
    percent: number | null;
    amount: number;
    label: string;
    reason: string;
    items: string;
    beneficiaryName: string | null;
    beneficiaryId: string | null;
    authorizedBy: string | null;
  };
}

/**
 * Revisa y calcula el descuento de un cobro.
 * `lines`: lo que se cobra (key = id de la línea de la cuenta, nombre y total con ISV).
 */
export async function resolveDiscount(
  input: DiscountInput,
  lines: { key: number; name: string; total: number }[]
): Promise<{ error: string } | ResolvedDiscount> {
  const kinds = ["PERCENT", "AMOUNT", "COURTESY", "SENIOR"];
  if (!kinds.includes(input.kind) || !["ORDER", "ITEM"].includes(input.scope)) return { error: "Descuento no válido" };
  const rules = await discountRules();
  const alloc = allocateDiscount(lines, input, rules);
  if (alloc.error) return { error: alloc.error };

  const reason = clean(input.reason);
  if (input.kind === "COURTESY" && reason.length < 3) return { error: "Escribe el motivo de la cortesía" };

  let beneficiaryName: string | null = null;
  let beneficiaryId: string | null = null;
  if (input.kind === "SENIOR") {
    beneficiaryName = clean(input.beneficiaryName, 100);
    beneficiaryId = normalizeDni(input.beneficiaryId ?? "");
    if (beneficiaryName.length < 3) return { error: "Escribe el nombre del beneficiario" };
    if (!beneficiaryId) return { error: "El número de identidad debe tener 13 dígitos" };
  }

  let authorizedBy: string | null = null;
  if (needsAuthorization(input.kind, alloc.effectivePercent, rules)) {
    if (!input.managerPin) {
      return {
        error:
          input.kind === "COURTESY"
            ? "La cortesía necesita el PIN de un encargado"
            : `Más de ${rules.limit}% de descuento necesita el PIN de un encargado`,
      };
    }
    const m = await managerByPin(input.managerPin);
    if ("error" in m) return { error: m.error as string };
    authorizedBy = m.user.name;
  }

  const item = input.scope === "ITEM" ? lines.find((l) => l.key === input.itemId) : undefined;
  const label = discountLabel({ ...input, reason, beneficiaryName: beneficiaryName ?? undefined }, alloc, item?.name);
  return {
    perLine: alloc.perLine,
    total: alloc.total,
    record: {
      kind: input.kind,
      scope: input.scope,
      percent: alloc.percent,
      amount: alloc.total,
      label,
      reason,
      items: item ? item.name : lines.map((l) => l.name).join(", ").slice(0, 500),
      beneficiaryName,
      beneficiaryId,
      authorizedBy,
    },
  };
}
