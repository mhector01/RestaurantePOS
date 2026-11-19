"use server";

// Fotos de los productos del menú.
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { currentRestaurantId } from "@/lib/tenant";
import { UploadError, deleteImage, saveImage } from "@/lib/uploads";

type Result = { success: boolean; error?: string; image?: string | null };

function refresh() {
  revalidatePath("/admin/productos");
  revalidatePath("/mesa", "layout");
  revalidatePath("/llevar", "layout");
}

/** Pone (o reemplaza) la foto de un producto. Recibe la foto ya reducida por el navegador. */
export async function setProductImage(productId: number, form: FormData): Promise<Result> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof Blob)) return { success: false, error: "No llegó la foto" };
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { success: false, error: "El producto no existe" };
  const rid = await currentRestaurantId();
  try {
    const name = await saveImage(rid, Buffer.from(await file.arrayBuffer()));
    await prisma.product.update({ where: { id: productId }, data: { image: name } });
    await deleteImage(rid, product.image);
    refresh();
    return { success: true, image: name };
  } catch (e) {
    if (e instanceof UploadError) return { success: false, error: e.message };
    throw e;
  }
}

export async function removeProductImage(productId: number): Promise<Result> {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { success: false, error: "El producto no existe" };
  await prisma.product.update({ where: { id: productId }, data: { image: null } });
  await deleteImage(await currentRestaurantId(), product.image);
  refresh();
  return { success: true, image: null };
}
