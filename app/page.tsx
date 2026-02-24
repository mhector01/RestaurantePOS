import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import { ShoppingBag, Store, Settings, PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tables = await prisma.table.findMany({
    orderBy: { number: 'asc' }
  });

  // Separamos la mesa virtual (Mesa 0) de las mesas físicas (Mesa 1, 2, 3...)
  const mostrador = tables.find(t => t.number === 0);
  const mesasFisicas = tables.filter(t => t.number > 0);

  // Acción para crear la mesa virtual si no existe
  async function habilitarMostrador() {
    "use server";
    await prisma.table.create({ data: { number: 0, status: "FREE" } });
    revalidatePath("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 p-4 px-6 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Store className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic">SISTEMA POS</h1>
        </div>
        
        <Link href="/admin">
          <Button variant="outline" className="font-bold bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white h-12 px-6">
            <Settings className="mr-2 h-5 w-5" /> Panel Admin
          </Button>
        </Link>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* SECCIÓN 1: VENTA RÁPIDA / PARA LLEVAR */}
        <section>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Venta Directa</h2>
          
          {!mostrador ? (
            <form action={habilitarMostrador}>
              <Button type="submit" className="w-full md:w-auto h-16 bg-blue-600 hover:bg-blue-700 text-lg font-black uppercase tracking-widest shadow-lg rounded-2xl">
                <PlusCircle className="mr-2 h-6 w-6" /> Habilitar Módulo "Para Llevar"
              </Button>
            </form>
          ) : (
            <Link href={`/mesa/${mostrador.id}`} className="block">
              <div className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                mostrador.status === "FREE" 
                ? "bg-white border-blue-200 hover:border-blue-500 hover:shadow-xl" 
                : "bg-orange-50 border-orange-300 hover:shadow-xl"
              }`}>
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-2xl ${mostrador.status === "FREE" ? "bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors" : "bg-orange-200 text-orange-700"}`}>
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Mostrador / Para Llevar</h2>
                    <p className="text-sm font-bold uppercase tracking-widest mt-1 text-slate-500">
                      {mostrador.status === "FREE" ? "Listo para cobrar" : "Cobro en proceso..."}
                    </p>
                  </div>
                </div>
                <Button className={`h-14 px-8 font-black uppercase tracking-widest rounded-xl ${mostrador.status === "FREE" ? "bg-slate-900" : "bg-orange-600"}`}>
                  {mostrador.status === "FREE" ? "Nueva Venta" : "Continuar"}
                </Button>
              </div>
            </Link>
          )}
        </section>

        {/* SECCIÓN 2: PLANO DE MESAS */}
        <section>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 border-t border-slate-200 pt-8">Mesas de Comedor</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mesasFisicas.map((mesa) => (
              <Link key={mesa.id} href={`/mesa/${mesa.id}`}>
                <div className={`h-32 rounded-2xl border-2 flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-lg ${
                  mesa.status === "FREE" 
                  ? "bg-white border-slate-200 hover:border-green-400" 
                  : "bg-orange-50 border-orange-200 shadow-inner"
                }`}>
                  <h3 className="text-3xl font-black text-slate-800">{mesa.number}</h3>
                  <span className={`text-[10px] font-black uppercase tracking-widest mt-2 px-3 py-1 rounded-full ${
                    mesa.status === "FREE" ? "bg-green-100 text-green-700" : "bg-orange-200 text-orange-800"
                  }`}>
                    {mesa.status === "FREE" ? "Libre" : "Ocupada"}
                  </span>
                </div>
              </Link>
            ))}

            {mesasFisicas.length === 0 && (
              <div className="col-span-full p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold">
                No has creado mesas aún. Ve a tu base de datos para agregarlas.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}