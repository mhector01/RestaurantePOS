// Contraseñas del panel con scrypt (incluido en Node, sin dependencias).
// Formato guardado: scrypt$N$r$p$salt$hash (base64url), así se puede subir el costo más adelante.
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: +n, r: +r, p: +p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash de relleno: se usa cuando el correo no existe para que la respuesta tarde lo mismo. */
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummy ??= hashPassword("relleno-para-igualar-tiempos");
  await verifyPassword(password, await dummy);
}

export const MIN_PASSWORD = 8;

/** Reglas mínimas de una contraseña nueva; devuelve el problema o null. */
export function passwordProblem(password: string, email?: string) {
  if (password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  if (password.length > 200) return "La contraseña es demasiado larga";
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|12345678|123456789|password|contraseña)/i.test(password)) {
    return "Esa contraseña es muy fácil de adivinar";
  }
  if (email && password.toLowerCase() === email.toLowerCase()) return "La contraseña no puede ser tu correo";
  return null;
}

/** Contraseña temporal fácil de dictar: sin letras que se confunden (0/O, 1/l). */
export function temporaryPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[randomInt(chars.length)];
  return out;
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120 ? email : null;
}
