import prisma from "@/lib/prisma";
import { ProductModal } from "@/components/ProductModal";
import { deleteProduct } from "@/app/actions";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  // 1. Buscamos productos INCLUYENDO los datos de su categoría relacionada
  const productos = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: { category: true } // <-- Muy importante para que no dé error
  });

  // 2. Buscamos todas las categorías que existen para mandarlas al Modal
  const categorias = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Menú / Productos</h1>
          <p className="text-slate-500">Administra los platillos y precios de tu restaurante.</p>
        </div>
        {/* Pasamos las categorías al modal para crear un producto NUEVO */}
        <ProductModal categories={categorias} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">ID</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">Nombre del Producto</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">Categoría</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">Precio</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 italic">No hay productos registrados.</td>
              </tr>
            ) : (
              productos.map((producto) => (
                <tr key={producto.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-400 font-mono text-sm">#{producto.id}</td>
                  <td className="p-4 font-bold text-slate-800">{producto.name}</td>
                  
                  {/* AQUÍ ESTÁ EL CAMBIO CLAVE: Leemos el .name de la categoría */}
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                      {producto.category?.name || "Sin Categoría"}
                    </span>
                  </td>
                  
                  <td className="p-4 font-black text-blue-600">${producto.price.toFixed(2)}</td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    {/* Pasamos el producto y las categorías al modal de EDICIÓN */}
                    <ProductModal product={producto} categories={categorias} />
                    
                    <form action={async () => {
                      "use server";
                      await deleteProduct(producto.id);
                    }}>
                      <Button type="submit" variant="outline" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}