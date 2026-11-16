// Reglas de facturación de Honduras (SAR) que sirven en servidor y navegador.

export const TAX_RATES = [
  { value: "15", label: "ISV 15%", hint: "General (comidas, bebidas sin alcohol)" },
  { value: "18", label: "ISV 18%", hint: "Bebidas alcohólicas y tabaco" },
  { value: "EXENTO", label: "Exento", hint: "Productos exentos de ISV" },
] as const;

export type TaxRate = "15" | "18" | "EXENTO";

export function normalizeTaxRate(v: string | null | undefined): TaxRate {
  return v === "18" || v === "EXENTO" ? v : "15";
}

const RATE: Record<TaxRate, number> = { "15": 0.15, "18": 0.18, EXENTO: 0 };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface InvoiceLine {
  name: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number; // con ISV incluido
  total: number;
  tax: TaxRate | "MIXTO";
  /** Para combos con componentes de distinta tasa: monto con ISV por tasa. */
  split?: Partial<Record<TaxRate, number>>;
}

export interface InvoiceTotals {
  exempt: number;
  exonerated: number;
  taxable15: number;
  taxable18: number;
  isv15: number;
  isv18: number;
  discount: number;
  subtotal: number; // importe sin ISV (gravado + exento + exonerado)
  total: number;
}

/**
 * Desglosa el ISV de líneas cuyo precio ya incluye el impuesto.
 * Se calcula por tasa sobre la suma (no línea por línea) para evitar diferencias de redondeo.
 */
export function computeTotals(lines: InvoiceLine[]): InvoiceTotals {
  const gross: Record<TaxRate, number> = { "15": 0, "18": 0, EXENTO: 0 };
  for (const l of lines) {
    if (l.split) {
      for (const [rate, amount] of Object.entries(l.split)) gross[rate as TaxRate] += amount ?? 0;
    } else if (l.tax !== "MIXTO") {
      gross[l.tax] += l.total;
    }
  }
  const total = round2(gross["15"] + gross["18"] + gross.EXENTO);
  const taxable15 = round2(gross["15"] / (1 + RATE["15"]));
  const taxable18 = round2(gross["18"] / (1 + RATE["18"]));
  const isv15 = round2(gross["15"] - taxable15);
  const isv18 = round2(gross["18"] - taxable18);
  const exempt = round2(gross.EXENTO);
  return {
    exempt,
    exonerated: 0,
    taxable15,
    taxable18,
    isv15,
    isv18,
    discount: 0,
    subtotal: round2(taxable15 + taxable18 + exempt),
    total,
  };
}

/**
 * Reparte el precio de un combo entre sus componentes según el precio normal de cada uno,
 * para aplicar la tasa de ISV que corresponde a cada parte (ej. combo con cerveza).
 */
export function splitComboAmount(amount: number, parts: { price: number; quantity: number; tax: TaxRate }[]) {
  const weight = parts.reduce((s, p) => s + p.price * p.quantity, 0);
  const out: Partial<Record<TaxRate, number>> = {};
  if (weight <= 0 || parts.length === 0) {
    out["15"] = amount;
    return out;
  }
  let assigned = 0;
  parts.forEach((p, i) => {
    const share = i === parts.length - 1 ? round2(amount - assigned) : round2((amount * p.price * p.quantity) / weight);
    assigned = round2(assigned + share);
    out[p.tax] = round2((out[p.tax] ?? 0) + share);
  });
  return out;
}

// ---------------------------------------------------------------------------
// CAI, rango y correlativo
// ---------------------------------------------------------------------------

/** CAI: 32 caracteres hexadecimales en grupos XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX. */
export function normalizeCai(input: string) {
  const raw = input.toUpperCase().replace(/[^0-9A-F]/g, "");
  if (raw.length !== 32) return null;
  return [raw.slice(0, 6), raw.slice(6, 12), raw.slice(12, 18), raw.slice(18, 24), raw.slice(24, 30), raw.slice(30)].join("-");
}

/** "000-001-01-00000001" → { prefix: "000-001-01", number: 1 } */
export function parseInvoiceNumber(input: string) {
  const m = input.trim().match(/^(\d{3})-(\d{3})-(\d{2})-(\d{8})$/);
  if (!m) return null;
  return { prefix: `${m[1]}-${m[2]}-${m[3]}`, number: parseInt(m[4], 10) };
}

export function formatInvoiceNumber(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(8, "0")}`;
}

/** RTN hondureño: 14 dígitos. Se acepta con o sin guiones. */
export function normalizeRtn(input: string) {
  const d = input.replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

export function formatRtn(rtn: string) {
  const d = rtn.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : rtn;
}

// ---------------------------------------------------------------------------
// Total en letras: "UN MIL DOSCIENTOS CINCUENTA LEMPIRAS CON 50/100"
// ---------------------------------------------------------------------------

const UNITS = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const TEENS = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const TWENTIES = ["VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function below100(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 30) return TWENTIES[n - 20];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]} Y ${UNITS[u]}` : TENS[t];
}

function below1000(n: number): string {
  if (n === 100) return "CIEN";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [HUNDREDS[h], rest ? below100(rest) : ""].filter(Boolean).join(" ");
}

/** "UNO" → "UN" delante de mil, millones y la moneda. */
const apocope = (s: string) => s.replace(/UNO$/, "UN").replace(/VEINTIUNO$/, "VEINTIÚN");

export function numberToWords(n: number): string {
  n = Math.floor(n);
  if (n === 0) return "CERO";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "UN MILLÓN" : `${apocope(below1000(millions))} MILLONES`);
  if (thousands) parts.push(thousands === 1 ? "UN MIL" : `${apocope(below1000(thousands))} MIL`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

export function amountInWords(amount: number, currency = "LEMPIRAS") {
  const cents = Math.round(amount * 100);
  const whole = Math.floor(cents / 100);
  const dec = cents % 100;
  return `${apocope(numberToWords(whole))} ${currency} CON ${String(dec).padStart(2, "0")}/100`;
}

// ---------------------------------------------------------------------------
// Lo que se imprime
// ---------------------------------------------------------------------------

export interface InvoiceIssuer {
  legalName: string;
  tradeName: string;
  rtn: string;
  address: string;
  phone: string;
  email: string;
  footer: string;
  cai: string;
  rangeFrom: string;
  rangeTo: string;
  deadline: string; // ISO
}

export interface InvoiceView extends InvoiceTotals {
  id: number;
  number: string;
  customerName: string;
  customerRtn: string | null;
  method: string;
  lines: InvoiceLine[];
  issuer: InvoiceIssuer;
  status: string;
  createdAt: string | Date;
  reference?: string; // "Mesa 4" / "Para llevar #12"
}
