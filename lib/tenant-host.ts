// Qué restaurante corresponde a cada dirección. Sin Prisma ni Node: también lo usa el middleware.
//
//   elbuensabor.ristemo.com  → "elbuensabor"   (con ROOT_DOMAIN=ristemo.com)
//   elbuensabor.localhost    → "elbuensabor"   (para probar en tu compu)
//   pos.cliente.com, ristemo.com, www… → null   (restaurante por defecto)

const RESERVED = new Set(["www", "app", "admin", "api"]);

export function tenantSlugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.split(":")[0].trim().toLowerCase();
  const root = process.env.ROOT_DOMAIN?.trim().toLowerCase().replace(/^\./, "");
  let sub: string | null = null;
  if (root && h.endsWith(`.${root}`)) sub = h.slice(0, -(root.length + 1));
  else if (h.endsWith(".localhost")) sub = h.slice(0, -".localhost".length);
  if (!sub || sub.includes(".") || RESERVED.has(sub)) return null;
  return sub;
}

/** Slug válido para un subdominio: minúsculas, números y guiones. */
export function normalizeSlug(value: string) {
  const s = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s.length >= 2 && !RESERVED.has(s) ? s : null;
}
