import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const prismaClientSingleton = () => {
  // 1. Creamos la conexión usando el driver oficial de Postgres
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  
  // 2. Lo conectamos al adaptador de Prisma 7
  const adapter = new PrismaPg(pool)
  
  // 3. Inicializamos PrismaClient exclusivamente con el adaptador
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma