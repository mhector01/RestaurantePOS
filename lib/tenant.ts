// El restaurante de la petición actual: sale del subdominio (ver tenant-host.ts).
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { headers } from "next/headers";
import type { Restaurant } from "@prisma/client";
import { rootPrisma } from "@/lib/prisma-base";
import { tenantSlugFromHost } from "@/lib/tenant-host";
import { BUSINESS } from "@/lib/config";
import { billingOf, getPlatformSettings } from "@/lib/billing";
import { imageUrl } from "@/lib/uploads";

const forced = new AsyncLocalStorage<number>();

/** Corre `fn` como si la petición fuera del restaurante `id` (scripts, tareas de la plataforma, pruebas). */
export function runAsRestaurant<T>(id: number, fn: () => Promise<T>) {
  return forced.run(id, fn);
}

async function findDefault() {
  const slug = process.env.DEFAULT_RESTAURANT?.trim();
  if (slug) return rootPrisma.restaurant.findUnique({ where: { slug } });
  return rootPrisma.restaurant.findFirst({ orderBy: { id: "asc" } });
}

/** Restaurante que corresponde a una dirección (también lo usa el proxy, que no tiene `headers()`). */
export function restaurantForHost(host: string | null | undefined): Promise<Restaurant | null> {
  const slug = tenantSlugFromHost(host);
  // Un subdominio que no existe NO cae al restaurante por defecto: no debe ver datos de nadie.
  return slug ? rootPrisma.restaurant.findUnique({ where: { slug } }) : findDefault();
}

/** Restaurante de la dirección con la que se entró (una consulta por petición). */
export const getRestaurant = cache(async (): Promise<Restaurant | null> => {
  const id = forced.getStore();
  if (id) return rootPrisma.restaurant.findUnique({ where: { id } });
  return restaurantForHost((await headers()).get("host"));
});

export class TenantError extends Error {}

/** Id del restaurante actual; falla si la dirección no corresponde a ninguno. */
export async function currentRestaurantId(): Promise<number> {
  const id = forced.getStore();
  if (id) return id;
  const r = await getRestaurant();
  if (!r) throw new TenantError("Restaurante no encontrado");
  if (r.status !== "ACTIVE") throw new TenantError("Restaurante suspendido");
  if (r.paidUntil && billingOf(r.paidUntil, (await getPlatformSettings()).graceDays).state === "EXPIRED") {
    throw new TenantError("Suscripción vencida");
  }
  return r.id;
}

/**
 * Datos que se imprimen en tickets y encabezados. Un restaurante que aún no guarda sus datos
 * (el que ya usaba el sistema antes de ser multi-restaurante) sigue mostrando los del .env.
 */
export async function getBusiness() {
  const r = await getRestaurant();
  const logo = imageUrl(r?.logo);
  if (!r?.name) return { name: BUSINESS.name, address: BUSINESS.address, taxId: BUSINESS.taxId, phone: r?.phone ?? "", logo };
  return { name: r.name, address: r.address, taxId: r.taxId, phone: r.phone, logo };
}

export type BusinessInfo = Awaited<ReturnType<typeof getBusiness>>;
