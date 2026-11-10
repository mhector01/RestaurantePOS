// Sesión de administrador.
// La cookie guarda un hash de la contraseña (+ un secreto opcional), así nadie puede
// "fabricar" la sesión escribiendo admin_session=true a mano. Funciona en el middleware y en el servidor.

export const ADMIN_COOKIE = "admin_session";

/** Contraseña del panel. En producción es obligatorio definir ADMIN_PASSWORD. */
export function getAdminPassword(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "production" ? null : "12345";
}

export async function adminToken(): Promise<string | null> {
  const password = getAdminPassword();
  if (!password) return null;
  const data = new TextEncoder().encode(`pos-admin:${password}:${process.env.SESSION_SECRET ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidAdminToken(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await adminToken();
  return expected !== null && value === expected;
}
