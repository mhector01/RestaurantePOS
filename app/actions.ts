"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function refreshTable(mesaId: number) {
  revalidatePath(`/mesa/${mesaId}`);
  revalidatePath("/");
}

/**
 * Cierra una orden que se quedó sin productos.
 * Si ya tenía abonos no se puede borrar (hay dinero registrado), así que se marca como pagada.
 */
async function settleEmptyOrder(orderId: number, mesaId: number) {
  const payments = await prisma.payment.count({ where: { orderId } });
  if (payments > 0) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  } else {
    await prisma.order.delete({ where: { id: orderId } });
  }
  await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });
}

// ---------------------------------------------------------------------------
// COMANDA
// ---------------------------------------------------------------------------

/**
 * Agrega una unidad de un producto a la comanda de la mesa.
 * Si el producto ya está en la comanda, suma la cantidad en lugar de crear otra línea.
 */
export async function addProductToOrder(tableId: number, productId: number) {
  const cookieStore = await cookies();
  const waiterId = cookieStore.get("waiter_id")?.value;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "Producto no encontrado" };

  let order = await prisma.order.findFirst({ where: { tableId, status: "OPEN" } });
  if (!order) {
    order = await prisma.order.create({
      data: { tableId, userId: waiterId ? parseInt(waiterId) : null },
    });
  }

  const existing = await prisma.orderItem.findFirst({
    where: { orderId: order.id, productId, price: product.price },
  });

  if (existing) {
    await prisma.orderItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + 1 },
    });
  } else {
    await prisma.orderItem.create({
      data: { orderId: order.id, productId, price: product.price },
    });
  }

  await prisma.table.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
  refreshTable(tableId);
  return { success: true };
}

/** Suma una unidad a una línea existente de la comanda. */
export async function incrementOrderItem(orderItemId: number, mesaId: number) {
  await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { quantity: { increment: 1 } },
  });
  refreshTable(mesaId);
}

/** Resta una unidad de un producto. Si llega a cero, quita la línea. */
export async function removeProductFromOrder(orderItemId: number, mesaId: number) {
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) return;

  if (item.quantity > 1) {
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { quantity: item.quantity - 1 },
    });
  } else {
    await prisma.orderItem.delete({ where: { id: orderItemId } });
  }

  const remaining = await prisma.orderItem.count({ where: { orderId: item.orderId } });
  if (remaining === 0) await settleEmptyOrder(item.orderId, mesaId);

  refreshTable(mesaId);
}

/** Quita una línea completa de la comanda (todas sus unidades). */
export async function deleteOrderItem(orderItemId: number, mesaId: number) {
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) return;
  await prisma.orderItem.delete({ where: { id: orderItemId } });

  const remaining = await prisma.orderItem.count({ where: { orderId: item.orderId } });
  if (remaining === 0) await settleEmptyOrder(item.orderId, mesaId);

  refreshTable(mesaId);
}

/** Vacía la comanda completa y libera la mesa. */
export async function clearOrder(orderId: number, mesaId: number) {
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await settleEmptyOrder(orderId, mesaId);
  refreshTable(mesaId);
}

// ---------------------------------------------------------------------------
// COBROS
// ---------------------------------------------------------------------------

/**
 * Cobra solo las unidades seleccionadas (cuenta dividida).
 */
export async function processProductPayment(
  orderId: number,
  mesaId: number,
  itemsToPay: { id: number; quantity: number }[],
  method: string
) {
  let totalAmountToPay = 0;
  const ticketItems = [];

  for (const itemRequest of itemsToPay) {
    const originalItem = await prisma.orderItem.findUnique({
      where: { id: itemRequest.id },
      include: { product: true },
    });
    if (!originalItem || itemRequest.quantity <= 0) continue;

    const qty = Math.min(itemRequest.quantity, originalItem.quantity);
    totalAmountToPay += originalItem.price * qty;

    ticketItems.push({
      id: originalItem.id,
      quantity: qty,
      price: originalItem.price,
      product: { name: originalItem.product.name },
    });

    if (originalItem.quantity <= qty) {
      await prisma.orderItem.delete({ where: { id: originalItem.id } });
    } else {
      await prisma.orderItem.update({
        where: { id: originalItem.id },
        data: { quantity: originalItem.quantity - qty },
      });
    }
  }

  const newPayment = await prisma.payment.create({
    data: { orderId, amount: totalAmountToPay, method },
    include: { order: { include: { table: true } } },
  });

  const remainingItems = await prisma.orderItem.count({ where: { orderId } });
  if (remainingItems === 0) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
    await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });
  }

  refreshTable(mesaId);
  return {
    ...newPayment,
    order: { ...newPayment.order, items: ticketItems },
    remainingItems,
  };
}

/**
 * Cobra todo lo pendiente de la cuenta y libera la mesa.
 */
export async function processFullPayment(orderId: number, mesaId: number, method: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order || order.items.length === 0) return null;

  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const payment = await prisma.payment.create({
    data: { orderId, amount: total, method },
    include: {
      order: { include: { table: true, items: { include: { product: true } } } },
    },
  });

  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });

  refreshTable(mesaId);
  return { ...payment, remainingItems: 0 };
}

export async function getPaymentTicket(paymentId: number) {
  return await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: { include: { items: { include: { product: true } }, table: true } },
    },
  });
}

export async function getDailySales() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const pagos = await prisma.payment.findMany({ where: { createdAt: { gte: hoy } } });

  const efectivo = pagos.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
  const tarjeta = pagos.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0);

  return {
    total: efectivo + tarjeta,
    efectivo,
    tarjeta,
    transacciones: pagos.length,
  };
}

// ---------------------------------------------------------------------------
// MENÚ (PRODUCTOS Y CATEGORÍAS)
// ---------------------------------------------------------------------------

export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/admin/productos");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error al borrar producto:", error);
    return {
      success: false,
      error: "No se puede eliminar porque ya aparece en ventas registradas.",
    };
  }
}

export async function createCategory(name: string) {
  const clean = name.trim();
  const existing = await prisma.category.findUnique({ where: { name: clean } });
  if (existing) return existing;
  const created = await prisma.category.create({ data: { name: clean } });
  revalidatePath("/admin/productos");
  return created;
}

export async function deleteCategory(id: number) {
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    return { success: false, error: "La categoría tiene productos. Muévelos o elimínalos primero." };
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/productos");
  return { success: true };
}

export async function saveProduct(
  id: number | null,
  name: string,
  price: number,
  categoryId: number
) {
  const data = { name: name.trim(), price, category: { connect: { id: categoryId } } };
  if (id) {
    await prisma.product.update({ where: { id }, data });
  } else {
    await prisma.product.create({ data });
  }
  revalidatePath("/admin/productos");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// MESAS
// ---------------------------------------------------------------------------

/** Agrega N mesas nuevas, numeradas a continuación de la última. */
export async function addTables(count: number) {
  const n = Math.max(1, Math.min(50, Math.floor(count)));
  const last = await prisma.table.findFirst({ orderBy: { number: "desc" } });
  const start = Math.max(1, (last?.number ?? 0) + 1);
  for (let i = 0; i < n; i++) {
    await prisma.table.create({ data: { number: start + i } });
  }
  revalidatePath("/admin/mesas");
  revalidatePath("/");
}

export async function deleteTable(id: number) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return { success: false, error: "La mesa no existe." };
  if (table.status !== "FREE") {
    return { success: false, error: "La mesa tiene una cuenta abierta." };
  }
  const orders = await prisma.order.count({ where: { tableId: id } });
  if (orders > 0) {
    return { success: false, error: "La mesa ya tiene ventas registradas y no se puede eliminar." };
  }
  await prisma.table.delete({ where: { id } });
  revalidatePath("/admin/mesas");
  revalidatePath("/");
  return { success: true };
}

/** Habilita la venta de mostrador / para llevar (mesa virtual número 0). */
export async function enableCounter() {
  const exists = await prisma.table.findUnique({ where: { number: 0 } });
  if (!exists) await prisma.table.create({ data: { number: 0 } });
  revalidatePath("/");
  revalidatePath("/admin/mesas");
}

// ---------------------------------------------------------------------------
// ACCESO ADMINISTRADOR
// ---------------------------------------------------------------------------

// Puedes cambiar "12345" por el PIN que tú quieras
const ADMIN_PASSWORD = "12345";

export async function loginAdmin(formData: FormData) {
  const password = formData.get("password");

  if (password === ADMIN_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8,
    });
    redirect("/admin");
  }

  return { error: "Contraseña incorrecta" };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  redirect("/");
}

// ---------------------------------------------------------------------------
// PERSONAL (MESEROS)
// ---------------------------------------------------------------------------

export async function saveUser(id: number | null, name: string, pin: string) {
  const clash = await prisma.user.findUnique({ where: { pin } });
  if (clash && clash.id !== id) {
    return { success: false, error: "Ese PIN ya lo usa otra persona." };
  }
  if (id) {
    await prisma.user.update({ where: { id }, data: { name: name.trim(), pin } });
  } else {
    await prisma.user.create({ data: { name: name.trim(), pin } });
  }
  revalidatePath("/admin/usuarios");
  return { success: true };
}

export async function deleteUser(id: number) {
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error al borrar usuario:", error);
    return {
      success: false,
      error: "No se puede eliminar porque ya tiene ventas registradas.",
    };
  }
}

// --- LOGIN DE MESEROS (PIN PAD) ---
export async function loginWaiter(pin: string) {
  const user = await prisma.user.findUnique({ where: { pin } });
  if (!user) return { error: "PIN incorrecto" };

  const cookieStore = await cookies();
  cookieStore.set("waiter_id", user.id.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });

  revalidatePath("/");
  return { success: true, name: user.name };
}

export async function logoutWaiter() {
  const cookieStore = await cookies();
  cookieStore.delete("waiter_id");
  revalidatePath("/");
}

// --- CIERRE DE CAJA ---
export async function closeRegister() {
  await prisma.order.updateMany({
    where: { status: "PAID" },
    data: { status: "CLOSED" },
  });
  revalidatePath("/admin/reportes");
  revalidatePath("/admin");
}
