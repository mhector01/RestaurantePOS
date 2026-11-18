// Clave de instalación (ADMIN_PASSWORD).
// Ya no sirve para entrar al panel: cada restaurante tiene sus cuentas (ver lib/session.ts).
// Solo se pide una vez, para crear la cuenta del dueño en un restaurante que todavía no tiene ninguna.

export function getAdminPassword(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "production" ? null : "12345";
}
