import { currentRestaurantId } from "@/lib/tenant";
import { readImage } from "@/lib/uploads";

/** Sirve las fotos del restaurante de esta dirección (nunca las de otro). */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let restaurantId: number;
  try {
    restaurantId = await currentRestaurantId();
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
  const file = await readImage(restaurantId, name);
  if (!file) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      // El nombre es único por foto: al cambiarla cambia la dirección, así que se puede guardar en caché para siempre
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
