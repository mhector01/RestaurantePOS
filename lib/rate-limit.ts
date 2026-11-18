// Freno contra adivinar contraseñas o PIN a la fuerza: tras varios intentos fallidos
// se bloquea esa llave (restaurante + correo, o restaurante + IP) por un rato.
// Vive en memoria del servidor: basta para una sola instancia como la de Coolify.

interface Entry {
  fails: number;
  first: number;
  blockedUntil: number;
}

const store = new Map<string, Entry>();

export interface Limit {
  max: number; // intentos fallidos permitidos…
  windowMs: number; // …dentro de esta ventana
  blockMs: number; // tiempo de bloqueo al pasarse
}

export const LOGIN_LIMIT: Limit = { max: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 };
export const PIN_LIMIT: Limit = { max: 10, windowMs: 10 * 60_000, blockMs: 5 * 60_000 };

/** Minutos que faltan si la llave está bloqueada; 0 si se puede intentar. */
export function blockedMinutes(key: string) {
  const e = store.get(key);
  if (!e || e.blockedUntil <= Date.now()) return 0;
  return Math.ceil((e.blockedUntil - Date.now()) / 60_000);
}

export function registerFailure(key: string, limit: Limit) {
  const now = Date.now();
  let e = store.get(key);
  if (!e || now - e.first > limit.windowMs) e = { fails: 0, first: now, blockedUntil: 0 };
  e.fails += 1;
  if (e.fails >= limit.max) e.blockedUntil = now + limit.blockMs;
  store.set(key, e);
  if (store.size > 5000) {
    for (const [k, v] of store) if (v.blockedUntil < now && now - v.first > limit.windowMs) store.delete(k);
  }
}

export function clearFailures(key: string) {
  store.delete(key);
}
