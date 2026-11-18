// Cookie del mesero: guarda su id firmado, para que nadie pueda hacerse pasar por otro
// escribiendo "waiter_id=3" a mano en el navegador.
import { createHmac, timingSafeEqual } from "node:crypto";

export const WAITER_COOKIE = "waiter_id";

function key() {
  // SESSION_SECRET es lo recomendado; si falta, la URL de la base (que tampoco es pública) sirve de llave.
  return process.env.SESSION_SECRET || process.env.DATABASE_URL || "ristemo";
}

const sign = (id: string) => createHmac("sha256", key()).update(`waiter:${id}`).digest("base64url");

export function signWaiterId(id: number) {
  return `${id}.${sign(String(id))}`;
}

/** Id del mesero si la cookie es auténtica; si no, undefined (como si no hubiera entrado). */
export function verifiedWaiterId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [id, mac] = value.split(".");
  if (!/^\d+$/.test(id ?? "") || !mac) return undefined;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : undefined;
}
