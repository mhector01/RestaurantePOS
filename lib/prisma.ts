// Cliente de Prisma del restaurante actual: cada consulta queda filtrada por restaurante.
// Para tareas de la plataforma (sin filtro) usa `rootPrisma` de "@/lib/prisma-base".
import { rootPrisma } from "@/lib/prisma-base";
import { currentRestaurantId } from "@/lib/tenant";
import { tenantExtension } from "@/lib/tenant-scope";

const prisma = rootPrisma.$extends(tenantExtension(currentRestaurantId));

export default prisma;
