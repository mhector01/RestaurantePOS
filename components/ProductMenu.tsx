// Archivo: components/ProductMenu.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addProductToOrder } from "@/app/actions";
import { Loader2 } from "lucide-react";

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
}

interface Props {
  productos: Product[];
  categorias: Category[];
  mesaId: number;
}

export function ProductMenu({ productos, categorias, mesaId }: Props) {
  // Estado para saber qué pestaña está activa (por defecto "ALL" = Todos)
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  // Estado para mostrar un spinner en el botón que se acaba de presionar
  const [addingId, setAddingId] = useState<number | null>(null);

  // Filtramos los productos según la pestaña seleccionada al instante
  const filteredProducts = activeCategory === "ALL" 
    ? productos 
    : productos.filter(p => p.categoryId === parseInt(activeCategory));

  // Función para agregar a la orden
  const handleAdd = async (productId: number, price: number) => {
    setAddingId(productId);
    try {
      await addProductToOrder(mesaId, productId, price);
    } catch (error) {
      console.error("Error al agregar:", error);
    } finally {
      setAddingId(null); // Quitamos el spinner
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* PESTAÑAS (TABS) HORIZONTALES */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 border-b border-slate-200 shrink-0 select-none no-scrollbar">
        <Button 
          variant={activeCategory === "ALL" ? "default" : "outline"}
          className={`rounded-full font-black text-xs uppercase tracking-widest whitespace-nowrap h-10 px-6 transition-all ${
            activeCategory === "ALL" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-200"
          }`}
          onClick={() => setActiveCategory("ALL")}
        >
          Todos
        </Button>
        
        {categorias.map(cat => (
          <Button 
            key={cat.id}
            variant={activeCategory === cat.id.toString() ? "default" : "outline"}
            className={`rounded-full font-black text-xs uppercase tracking-widest whitespace-nowrap h-10 px-6 transition-all ${
              activeCategory === cat.id.toString() ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-200"
            }`}
            onClick={() => setActiveCategory(cat.id.toString())}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* GRID DE PRODUCTOS FILTRADOS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pb-6 pr-2">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 font-bold italic bg-white rounded-2xl border-2 border-dashed">
            No hay productos en esta categoría.
          </div>
        ) : (
          filteredProducts.map((producto) => (
            <Card key={producto.id} className="border-2 border-transparent shadow-sm hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between bg-white rounded-2xl">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-sm font-black text-slate-700 leading-tight uppercase">
                  {producto.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-4 flex justify-between items-center mt-auto border-t border-slate-50 mt-4">
                <span className="font-black text-xl text-slate-900">${producto.price.toFixed(2)}</span>
                <Button 
                  onClick={() => handleAdd(producto.id, producto.price)}
                  disabled={addingId === producto.id}
                  size="sm" 
                  className="rounded-xl h-10 w-12 font-black bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                >
                  {addingId === producto.id ? <Loader2 className="h-5 w-5 animate-spin" /> : "+"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}