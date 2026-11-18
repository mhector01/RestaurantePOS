// Sesión de administrador.
// La cookie guarda un hash de la contraseña (+ un secreto opcional), así nadie puede
// "fabricar" la sesión escribiendo admin_session=true a mano. Funciona en el middleware y en el servidor.
// Lleva también el restaurante (subdominio): una sesión de un restaurante no sirve en otro.

import { tenantSlugFromHost } from "@/lib/tenant-host";

export const ADMIN_COOKIE = "admin_session";

/** Contraseña del panel. En producción es obligatorio definir ADMIN_PASSWORD. */
export function getAdminPassword(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "production" ? null : "12345";
}

export async function adminToken(host: string | null | undefined): Promise<string | null> {
  const password = getAdminPassword();
  if (!password) return null;
  const scope = tenantSlugFromHost(host);
  // Sin subdominio (restaurante por defecto) el token es el mismo de antes: las sesiones abiertas siguen valiendo.
  const base = `pos-admin:${password}:${process.env.SESSION_SECRET ?? ""}`;
  const data = new TextEncoder().encode(scope ? `${base}:${scope}` : base);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidAdminToken(value: string | undefined, host: string | null | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await adminToken(host);
  return expected !== null && value === expected;
}
