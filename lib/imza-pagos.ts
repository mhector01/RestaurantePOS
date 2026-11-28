// Cobros con tarjeta a través de IMZA Pagos (imzaris.com), que es el único sitio integrado con Pagadito.
// Contrato: imza-web/docs/API-COBROS.md. Las dos direcciones se firman igual:
//   X-IMZA-Firma = hex( HMAC-SHA256( IMZA_PAGOS_SECRETO, timestamp + "." + cuerpo_crudo ) )
import { createHmac, timingSafeEqual } from "node:crypto";

export const PRODUCT_ID = "ristemo";
const MAX_SKEW_SECONDS = 300;

const baseUrl = () => process.env.IMZA_PAGOS_URL?.trim().replace(/\/+$/, "") ?? "";
const secret = () => process.env.IMZA_PAGOS_SECRETO?.trim() ?? "";

/** ¿Está configurado el pago con tarjeta (IMZA_PAGOS_URL e IMZA_PAGOS_SECRETO)? */
export function cardPaymentsEnabled() {
  return !!baseUrl() && !!secret();
}

export function firmar(timestamp: string, rawBody: string, key = secret()) {
  return createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * ¿La firma de un aviso es válida? Timestamp a ±5 min de ahora y HMAC comparado en tiempo constante.
 * `now` y `key` solo para pruebas.
 */
export function verificarFirma(
  rawBody: string,
  timestamp: string | null | undefined,
  firma: string | null | undefined,
  opts: { key?: string; now?: number } = {}
) {
  const key = opts.key ?? secret();
  if (!key || !timestamp || !firma || !/^\d{1,12}$/.test(timestamp)) return false;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  if (!/^[0-9a-f]{64}$/i.test(firma)) return false;
  const expected = Buffer.from(firmar(timestamp, rawBody, key), "hex");
  const given = Buffer.from(firma.toLowerCase(), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class ImzaPagosError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Petición firmada a IMZA Pagos. */
async function signedFetch(path: string, init: { method: "GET" | "POST"; body?: unknown }) {
  if (!cardPaymentsEnabled()) throw new ImzaPagosError("El pago con tarjeta no está configurado");
  const raw = init.body === undefined ? "" : JSON.stringify(init.body);
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "X-IMZA-Producto": PRODUCT_ID,
      "X-IMZA-Timestamp": ts,
      "X-IMZA-Firma": firmar(ts, raw),
    },
    body: init.method === "GET" ? undefined : raw,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // respuesta que no es JSON: se informa abajo con el código
  }
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new ImzaPagosError(msg, res.status);
  }
  return data;
}

export interface NuevoCobro {
  referencia: string;
  descripcion: string;
  monto: number;
  moneda: "USD" | "HNL";
  cliente: { nombre: string; correo: string };
  retorno_url: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CobroCreado {
  id: string;
  url: string;
  estado: string;
}

/** POST /api/v1/cobros: crea un cobro único y devuelve la dirección de Pagadito a la que se manda al cliente. */
export async function crearCobro(input: NuevoCobro): Promise<CobroCreado> {
  const data = (await signedFetch("/api/v1/cobros", { method: "POST", body: input })) as Partial<CobroCreado> | null;
  if (!data?.id || !data.url || !/^https:\/\//.test(data.url)) throw new ImzaPagosError("Respuesta inesperada de IMZA Pagos");
  return { id: String(data.id), url: String(data.url), estado: String(data.estado ?? "") };
}

/** Estados de Pagadito. Solo COMPLETED significa pagado. */
export type EstadoCobro = "REGISTERED" | "COMPLETED" | "VERIFYING" | "REVOKED" | "FAILED" | "CANCELED" | "EXPIRED";

export interface CobroAviso {
  id: string;
  referencia: string;
  estado: EstadoCobro | string;
  monto: string;
  moneda: string;
  referencia_pagadito?: string | null;
  fecha_pago?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** GET /api/v1/cobros/:id (consulta el estado en Pagadito). */
export async function consultarCobro(id: string): Promise<CobroAviso> {
  return (await signedFetch(`/api/v1/cobros/${encodeURIComponent(id)}`, { method: "GET" })) as CobroAviso;
}
