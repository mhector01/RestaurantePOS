"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Agrega un producto a la comanda. 
 */
export async function addProductToOrder(tableId: number, productId: number, price: number) {
  // 1. Leemos qué mesero está usando la tablet en este momento
  const cookieStore = await cookies();
  const waiterId = cookieStore.get("waiter_id")?.value;

  let order = await prisma.order.findFirst({
    where: { tableId, status: "OPEN" }
  });

  // Si no hay orden, creamos una y LE ASIGNAMOS EL MESERO
  if (!order) {
    order = await prisma.order.create({
      data: { 
        tableId,
        userId: waiterId ? parseInt(waiterId) : null // <-- MAGIA AQUÍ
      }
    });
  }

  // Agregamos el producto a la orden
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      productId,
      price
    }
  });

  revalidatePath(`/mesa/${tableId}`);
}

/**
 * Procesa el pago de productos específicos seleccionados por cantidad.
 */
export async function processProductPayment(
  orderId: number, 
  mesaId: number, 
  itemsToPay: { id: number, quantity: number }[], 
  method: string
) {
  let totalAmountToPay = 0;
  const ticketItems = [];

  for (const itemRequest of itemsToPay) {
    const originalItem = await prisma.orderItem.findUnique({
      where: { id: itemRequest.id },
      include: { product: true }
    });

    if (!originalItem) continue;

    const priceForThisItem = originalItem.price * itemRequest.quantity;
    totalAmountToPay += priceForThisItem;

    // --- CORRECCIÓN AQUÍ: Agregamos ID para la KEY y estructura correcta de producto ---
    ticketItems.push({
      id: originalItem.id, // Esto quita el error de la consola
      quantity: itemRequest.quantity,
      price: originalItem.price,
      product: { 
        name: originalItem.product.name // Esto hace que aparezca el nombre en el ticket
      }
    });

    if (originalItem.quantity <= itemRequest.quantity) {
      await prisma.orderItem.delete({ where: { id: originalItem.id } });
    } else {
      await prisma.orderItem.update({
        where: { id: originalItem.id },
        data: { quantity: originalItem.quantity - itemRequest.quantity }
      });
    }
  }

  const newPayment = await prisma.payment.create({
    data: {
      orderId,
      amount: totalAmountToPay,
      method,
    },
    include: {
      order: { include: { table: true } }
    }
  });

  const paymentWithItems = {
    ...newPayment,
    order: {
      ...newPayment.order,
      items: ticketItems 
    }
  };

  const remainingItems = await prisma.orderItem.count({ where: { orderId } });
  if (remainingItems === 0) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
    await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });
  }

  revalidatePath(`/mesa/${mesaId}`);
  revalidatePath("/");
  return paymentWithItems;
}

/**
 * Obtiene detalles para reimpresión
 */
export async function getPaymentTicket(paymentId: number) {
  return await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          items: { include: { product: true } },
          table: true
        }
      }
    }
  });
}


// ... (tus otras acciones arriba)

/**
 * Elimina una unidad de un producto de la comanda
 */
export async function removeProductFromOrder(orderItemId: number, mesaId: number) {
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) return;

  if (item.quantity > 1) {
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { quantity: item.quantity - 1 }
    });
  } else {
    await prisma.orderItem.delete({ where: { id: orderItemId } });
  }

  // Si la comanda se queda vacía, podríamos opcionalmente liberar la mesa
  const remaining = await prisma.orderItem.count({ 
    where: { orderId: item.orderId } 
  });
  
  if (remaining === 0) {
    await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });
    await prisma.order.delete({ where: { id: item.orderId } });
  }

  revalidatePath(`/mesa/${mesaId}`);
}

/**
 * Limpia toda la comanda (Borrar todo)
 */
export async function clearOrder(orderId: number, mesaId: number) {
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });
  
  revalidatePath(`/mesa/${mesaId}`);
  revalidatePath("/");
}

/**
 * Paga el total de la cuenta de un solo golpe
 */
/**
 * Paga el total de la cuenta de un solo golpe y devuelve los datos para el ticket
 */
export async function processFullPayment(orderId: number, mesaId: number, method: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  });

  if (!order) return null;

  const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // 1. Registramos el pago e incluimos TODO para el ticket
  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount: total,
      method,
    },
    include: {
      order: { 
        include: { 
          table: true, 
          items: { include: { product: true } } 
        } 
      }
    }
  });

  // 2. Marcamos como pagado y liberamos mesa
  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  await prisma.table.update({ where: { id: mesaId }, data: { status: "FREE" } });

  revalidatePath(`/mesa/${mesaId}`);
  revalidatePath("/");
  
  return payment; // Ahora este objeto lleva los nombres de los productos
}

// Añade esto al final de tu archivo app/actions.ts

export async function getDailySales() {
  // Obtenemos la fecha actual y la ajustamos a las 00:00:00 de hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const pagos = await prisma.payment.findMany({
    where: {
      createdAt: {
        gte: hoy,
      },
    },
  });

  const ventasEfectivo = pagos
    .filter((p) => p.method === "CASH")
    .reduce((sum, p) => sum + p.amount, 0);

  const ventasTarjeta = pagos
    .filter((p) => p.method === "CARD")
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    total: ventasEfectivo + ventasTarjeta,
    efectivo: ventasEfectivo,
    tarjeta: ventasTarjeta,
    transacciones: pagos.length
  };
}

export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({
      where: { id }
    });
    revalidatePath("/admin/productos");
    return { success: true };
  } catch (error) {
    // Si el producto ya está en una orden antigua, Prisma no dejará borrarlo por seguridad
    console.error("Error al borrar producto:", error);
    return { success: false, error: "No se puede borrar porque está registrado en ventas pasadas." };
  }
}

// --- AÑADE ESTO AL FINAL DE app/actions.ts ---

// 1. Crear categoría rápida
export async function createCategory(name: string) {
  const newCategory = await prisma.category.create({
    data: { name }
  });
  return newCategory;
}

// 2. ACTUALIZA tu saveProduct para que use categoryId
export async function saveProduct(id: number | null, name: string, price: number, categoryId: number) {
  if (id) {
    // Actualizar producto existente "conectándolo" con su categoría
    await prisma.product.update({
      where: { id },
      data: { 
        name, 
        price, 
        category: {
          connect: { id: categoryId } // <-- La forma correcta en Prisma
        }
      }
    });
  } else {
    // Crear producto nuevo "conectándolo" con su categoría
    await prisma.product.create({
      data: { 
        name, 
        price, 
        category: {
          connect: { id: categoryId } // <-- La forma correcta en Prisma
        }
      }
    });
  }
  
  revalidatePath("/admin/productos");
  revalidatePath("/"); 
}




// Puedes cambiar "12345" por el PIN que tú quieras
const ADMIN_PASSWORD = "12345"; 

export async function loginAdmin(formData: FormData) {
  const password = formData.get("password");
  
  if (password === ADMIN_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "true", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8 // La sesión durará 8 horas
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

// --- SECCIÓN DE USUARIOS (MESEROS) ---

export async function saveUser(id: number | null, name: string, pin: string) {
  if (id) {
    await prisma.user.update({
      where: { id },
      data: { name, pin }
    });
  } else {
    await prisma.user.create({
      data: { name, pin }
    });
  }
  revalidatePath("/admin/usuarios");
}

export async function deleteUser(id: number) {
  try {
    await prisma.user.delete({
      where: { id }
    });
    revalidatePath("/admin/usuarios");
    return { success: true };
  } catch (error) {
    console.error("Error al borrar usuario:", error);
    return { success: false, error: "No se puede borrar porque este mesero ya tiene ventas registradas." };
  }
}

// --- LOGIN DE MESEROS (PIN PAD) ---
export async function loginWaiter(pin: string) {
  const user = await prisma.user.findUnique({ where: { pin } });
  
  if (!user) return { error: "PIN incorrecto" };

  const cookieStore = await cookies();
  // Guardamos la sesión del mesero por 12 horas
  cookieStore.set("waiter_id", user.id.toString(), { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12 
  });
  
  return { success: true };
}

export async function logoutWaiter() {
  const cookieStore = await cookies();
  cookieStore.delete("waiter_id");
  revalidatePath("/");
}

// --- CIERRE DE CAJA ---
export async function closeRegister() {
  // Cambiamos todas las órdenes pagadas del turno a estado "CERRADO/ARCHIVADO"
  await prisma.order.updateMany({
    where: { status: "PAID" },
    data: { status: "CLOSED" }
  });
  
  revalidatePath("/admin/reportes");
}