// Datos del negocio. Ajusta estos valores a tu restaurante.
export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Mi Restaurante",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "Dirección del local",
  taxId: process.env.NEXT_PUBLIC_BUSINESS_TAX_ID ?? "",
  currency: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "$",
  // Formato de números: "es-HN" → 1,250.00 ; "es-ES" → 1.250,00
  locale: process.env.NEXT_PUBLIC_LOCALE ?? "es-HN",
};

export function formatMoney(value: number) {
  return `${BUSINESS.currency}${value.toLocaleString(BUSINESS.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function minutesSince(date: Date | string) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

export function formatElapsed(date: Date | string) {
  const m = minutesSince(date);
  if (m < 1) return "ahora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
};
