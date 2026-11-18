// El restaurante de la petición actual: sale del subdominio (ver tenant-host.ts).
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { headers } from "next/headers";
import type { Restaurant } from "@prisma/client";
import { rootPrisma } from "@/lib/prisma-base";
import { tenantSlugFromHost } from "@/lib/tenant-host";
import { BUSINESS } from "@/lib/config";

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

/** Restaurante de la dirección con la que se entró (una consulta por petición). */
export const getRestaurant = cache(async (): Promise<Restaurant | null> => {
  const id = forced.getStore();
  if (id) return rootPrisma.restaurant.findUnique({ where: { id } });
  const slug = tenantSlugFromHost((await headers()).get("host"));
  // Un subdominio que no existe NO cae al restaurante por defecto: no debe ver datos de nadie.
  return slug ? rootPrisma.restaurant.findUnique({ where: { slug } }) : findDefault();
});

export class TenantError extends Error {}

/** Id del restaurante actual; falla si la dirección no corresponde a ninguno. */
export async function currentRestaurantId(): Promise<number> {
  const id = forced.getStore();
  if (id) return id;
  const r = await getRestaurant();
  if (!r) throw new TenantError("Restaurante no encontrado");
  if (r.status !== "ACTIVE") throw new TenantError("Restaurante suspendido");
  return r.id;
}

/** Datos que se imprimen en tickets y encabezados. Si el restaurante no los tiene, se usan los del .env. */
export async function getBusiness() {
  const r = await getRestaurant();
  return {
    name: r?.name || BUSINESS.name,
    address: r?.address || BUSINESS.address,
    taxId: r?.taxId || BUSINESS.taxId,
  };
}

export type BusinessInfo = Awaited<ReturnType<typeof getBusiness>>;
