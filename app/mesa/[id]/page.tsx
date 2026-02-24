import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  removeProductFromOrder, 
  clearOrder
} from "@/app/actions";
import { CheckoutModal } from "@/components/CheckoutModal";
import { Trash2, XCircle } from "lucide-react";
import { QuickCheckout } from "@/components/QuickCheckout";
import { ProductMenu } from "@/components/ProductMenu";
import { cookies } from "next/headers";
import { PinPad } from "@/components/PinPad";
import { logoutWaiter } from "@/app/actions"; // Para el botón de cambiar mesero

export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const mesaId = parseInt(resolvedParams.id);

  // --- 1. VALIDACIÓN DE SEGURIDAD DEL MESERO ---
  const cookieStore = await cookies();
  const waiterId = cookieStore.get("waiter_id")?.value;

  // Si no hay cookie, mostramos el PinPad a pantalla completa y bloqueamos el resto
  if (!waiterId) {
    return <PinPad />;
  }

  // Si sí hay cookie, buscamos cómo se llama el mesero para saludarlo
  const mesero = await prisma.user.findUnique({ where: { id: parseInt(waiterId) } });

  // Si por alguna razón el mesero fue borrado del sistema, pedimos PIN de nuevo
  if (!mesero) {
    return <PinPad />;
  }


  const mesa = await prisma.table.findUnique({
    where: { id: mesaId }
  });

  const productos = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  });

  const categorias = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });

  const openOrder = await prisma.order.findFirst({
    where: { tableId: mesaId, status: "OPEN" },
    include: {
      items: {
        include: { product: true }
      },
      payments: true 
    }
  });

  const totalAmount = openOrder?.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0) || 0;

  const totalPaid = openOrder?.payments.reduce((sum, p) => sum + p.amount, 0) || 0;

  if (!mesa) return <div className="p-8 text-center font-bold">Mesa no encontrada</div>;

  const isOrderEmpty = !openOrder || openOrder.items.length === 0;

  // Lógica para determinar si es Mostrador (Mesa 0)
  const esMostrador = mesa.number === 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" className="font-semibold rounded-xl">← Volver al Plano</Button>
          </Link>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">
            {/* Título condicional para el Mostrador */}
            {esMostrador ? "MOSTRADOR / PARA LLEVAR" : `Mesa ${mesa.number}`}
          </h1>

          {/* Gafete del Mesero */}
          <form action={logoutWaiter} className="ml-4">
            <button type="submit" className="text-[10px] font-black tracking-widest bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-600 px-3 py-1.5 rounded-md uppercase transition-colors" title="Cerrar sesión de mesero">
              👤 {mesero.name} (Salir)
            </button>
          </form>
          
        </div>
        <div className={`text-xs font-black tracking-widest px-4 py-2 rounded-xl border-2 uppercase ${
          mesa.status === "FREE" 
          ? "bg-green-50 text-green-700 border-green-200" 
          : "bg-orange-50 text-orange-700 border-orange-200"
        }`}>
           {/* Estado condicional para el Mostrador */}
          {esMostrador 
            ? (mesa.status === "FREE" ? "LISTO PARA COBRAR" : "COBRO EN PROCESO")
            : (mesa.status === "FREE" ? "DISPONIBLE" : "OCUPADA")
          }
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* IZQUIERDA: MENÚ DE PRODUCTOS */}
        <div className="w-2/3 p-6 overflow-hidden bg-slate-100/50 flex flex-col">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4 italic shrink-0">
            Menú Digital
          </h2>
          
          <ProductMenu 
            productos={productos} 
            categorias={categorias} 
            mesaId={mesaId} 
          />
        </div>

        {/* DERECHA: COMANDA */}
        <div className="w-1/3 bg-white border-l p-6 shadow-2xl flex flex-col z-10">
          <h2 className="text-xl font-black mb-4 text-slate-800 uppercase tracking-tighter italic shrink-0">Comanda en curso</h2>
          
          <div className="flex-1 overflow-y-auto border-t border-b border-slate-100 py-4 pr-2">
            {isOrderEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 italic text-center">
                <p>No hay pedidos aún.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {openOrder!.items.map((item) => (
                  <li key={item.id} className="flex justify-between items-start group">
                    <div className="flex gap-3">
                      <span className="bg-slate-900 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-md">
                        {item.quantity}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-none">{item.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-black mt-1 uppercase">u/p: ${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-slate-700">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <form action={async () => {
                        "use server";
                        await removeProductFromOrder(item.id, mesaId);
                      }}>
                        <button type="submit" className="text-slate-300 hover:text-red-500 transition-colors bg-slate-50 p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-6 space-y-4 shrink-0">
            {/* BOTÓN LIMPIAR TODO */}
            {!isOrderEmpty && (
              <form action={async () => {
                "use server";
                await clearOrder(openOrder!.id, mesaId);
              }}>
                <Button variant="ghost" size="sm" className="w-full text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-bold uppercase tracking-widest rounded-xl h-10">
                  <XCircle size={14} className="mr-2" /> Limpiar Carrito
                </Button>
              </form>
            )}

            <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
               <div className="flex justify-between text-xs font-black text-green-600 uppercase tracking-widest">
                  <span>ABONADO:</span>
                  <span>${totalPaid.toFixed(2)}</span>
               </div>
               <div className="flex justify-between text-3xl font-black text-slate-900 pt-1">
                 <span>TOTAL:</span>
                 <span>${totalAmount.toFixed(2)}</span>
               </div>
            </div>

            {/* SECCIÓN DE BOTONES DE COBRO */}
            <div className="grid grid-cols-1 gap-2">
                <QuickCheckout 
                  orderId={openOrder?.id || 0} 
                  mesaId={mesaId} 
                  total={totalAmount} 
                  disabled={isOrderEmpty}
                />

                <CheckoutModal 
                  orderId={openOrder?.id || 0} 
                  mesaId={mesaId} 
                  items={openOrder?.items || []} 
                  disabled={isOrderEmpty}
                />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}