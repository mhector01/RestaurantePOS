// Ayudas del panel de la plataforma (todo con rootPrisma: ve a todos los restaurantes).
import { rootPrisma } from "@/lib/prisma-base";

/** Restaurante que abre el dominio principal (sin subdominio). */
export async function defaultRestaurantId() {
  const slug = process.env.DEFAULT_RESTAURANT?.trim();
  const r = slug
    ? await rootPrisma.restaurant.findUnique({ where: { slug }, select: { id: true } })
    : await rootPrisma.restaurant.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return r?.id ?? null;
}

/** Dirección de un restaurante, o null si falta configurar ROOT_DOMAIN en producción. */
export function restaurantUrl(slug: string) {
  const root = process.env.ROOT_DOMAIN?.trim().replace(/^\./, "");
  if (root) return `https://${slug}.${root}`;
  if (process.env.NODE_ENV !== "production") return `http://${slug}.localhost:3000`;
  return null;
}

export const DAY = 86_400_000;

/** Ventas, actividad y tamaño de cada restaurante para el panel. */
export async function restaurantStats(ids?: number[]) {
  const where = ids ? { restaurantId: { in: ids } } : {};
  const since = new Date(Date.now() - 30 * DAY);
  const [sales, last, accounts, owners, waiters, products, tables] = await Promise.all([
    rootPrisma.payment.groupBy({ by: ["restaurantId"], where: { ...where, createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    rootPrisma.payment.groupBy({ by: ["restaurantId"], where, _max: { createdAt: true } }),
    rootPrisma.account.groupBy({ by: ["restaurantId"], where: { ...where, active: true }, _count: true, _max: { lastLoginAt: true } }),
    rootPrisma.account.findMany({ where: { ...where, role: "OWNER", active: true }, select: { restaurantId: true, email: true, name: true } }),
    rootPrisma.user.groupBy({ by: ["restaurantId"], where, _count: true }),
    rootPrisma.product.groupBy({ by: ["restaurantId"], where, _count: true }),
    rootPrisma.table.groupBy({ by: ["restaurantId"], where: { ...where, number: { gt: 0 } }, _count: true }),
  ]);
  const map = new Map<
    number,
    {
      sales30: number;
      payments30: number;
      lastSale: Date | null;
      accounts: number;
      lastLogin: Date | null;
      owners: { email: string; name: string }[];
      waiters: number;
      products: number;
      tables: number;
    }
  >();
  const get = (id: number) => {
    let e = map.get(id);
    if (!e) {
      e = { sales30: 0, payments30: 0, lastSale: null, accounts: 0, lastLogin: null, owners: [], waiters: 0, products: 0, tables: 0 };
      map.set(id, e);
    }
    return e;
  };
  for (const s of sales) Object.assign(get(s.restaurantId), { sales30: s._sum.amount ?? 0, payments30: s._count });
  for (const l of last) get(l.restaurantId).lastSale = l._max.createdAt;
  for (const a of accounts) Object.assign(get(a.restaurantId), { accounts: a._count, lastLogin: a._max.lastLoginAt });
  for (const o of owners) get(o.restaurantId).owners.push({ email: o.email, name: o.name });
  for (const w of waiters) get(w.restaurantId).waiters = w._count;
  for (const p of products) get(p.restaurantId).products = p._count;
  for (const t of tables) get(t.restaurantId).tables = t._count;
  return { get };
}
