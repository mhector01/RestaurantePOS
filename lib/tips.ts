// Propina voluntaria. En Honduras no se puede cobrar sola ni meterla en los importes de la factura:
// se sugiere en la pre-cuenta y, al cobrar, se pregunta al cliente. Si la acepta, va aparte del total
// facturado y sin ISV. La usan el servidor y la pantalla de cobro (calculan lo mismo).

export interface TipRules {
  enabled: boolean;
  /** % sugerido (sobre el consumo, ya con descuentos). */
  percent: number;
}

/** Lo que eligió el cliente: el % sugerido u otro monto. */
export type TipInput = { percent: number } | { amount: number };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Propina sobre lo consumido. Nunca negativa ni mayor que el consumo. */
export function computeTip(consumption: number, tip: TipInput | null | undefined) {
  if (!tip || consumption <= 0) return 0;
  const value = "percent" in tip ? (consumption * Number(tip.percent)) / 100 : Number(tip.amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return round2(Math.min(value, consumption));
}

export const suggestedTip = (consumption: number, rules: TipRules) => (rules.enabled ? computeTip(consumption, { percent: rules.percent }) : 0);
