import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const prismaClientSingleton = () => {
  // Conexión con el driver oficial de Postgres, conectado al adaptador de Prisma 7
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

/**
 * Cliente SIN filtro de restaurante: ve los datos de todos.
 * Úsalo solo para tareas de la plataforma (buscar el restaurante de una dirección, crear restaurantes…).
 * Todo lo demás usa el cliente de `@/lib/prisma`.
 */
export const rootPrisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = rootPrisma;
