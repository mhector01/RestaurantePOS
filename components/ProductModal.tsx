"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveProduct, createCategory } from "@/app/actions";
import { Edit, PlusCircle, Plus, X, Loader2 } from "lucide-react";

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
  product?: Product; 
  categories: Category[]; // Ahora recibimos las categorías disponibles
}

export function ProductModal({ product, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados del producto
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product?.price.toString() || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId.toString() || "");

  // Estados para crear categoría rápida
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Manejar creación rápida de categoría
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const cat = await createCategory(newCategoryName);
      categories.push(cat); // Lo agregamos localmente para evitar recargar de golpe
      setCategoryId(cat.id.toString()); // La seleccionamos
      setIsCreatingCategory(false);
      setNewCategoryName("");
    } catch (error) {
      console.error(error);
      alert("Error al crear categoría. Quizás ya existe.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return alert("Selecciona una categoría");
    
    setLoading(true);
    try {
      await saveProduct(product?.id || null, name, parseFloat(price), parseInt(categoryId));
      setOpen(false);
      if (!product) {
        setName("");
        setPrice("");
        setCategoryId("");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) setIsCreatingCategory(false);
    }}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
            <Edit size={16} />
          </Button>
        ) : (
          <Button className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
            <PlusCircle className="mr-2 h-5 w-5" /> Nuevo Producto
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-black italic uppercase text-xl">
            {product ? "Editar Producto" : "Agregar Producto"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nombre del Plato/Bebida</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Hamburguesa Doble" required className="h-12 font-medium" />
          </div>

          {/* SELECTOR O CREADOR DE CATEGORÍA */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Categoría</Label>
            
            {isCreatingCategory ? (
              <div className="flex gap-2">
                <Input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nueva Categoría..." className="h-12" />
                <Button type="button" onClick={handleCreateCategory} disabled={savingCategory} className="h-12 w-12 bg-green-600 hover:bg-green-700 text-white">
                  {savingCategory ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreatingCategory(false)} className="h-12 w-12">
                  <X className="h-5 w-5 text-red-500" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select 
                  value={categoryId} 
                  onChange={(e) => setCategoryId(e.target.value)} 
                  required 
                  className="flex flex-1 h-12 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                >
                  <option value="" disabled>Selecciona...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button type="button" onClick={() => setIsCreatingCategory(true)} variant="outline" className="h-12 px-3 border-dashed border-2 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50">
                  <Plus className="h-5 w-5 mr-1" /> Nueva
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500">Precio ($)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required className="h-12 font-black text-lg" />
          </div>
          
          <Button type="submit" className="w-full h-12 font-black tracking-widest uppercase bg-blue-600 hover:bg-blue-700 mt-4" disabled={loading || isCreatingCategory}>
            {loading ? "Guardando..." : "Guardar Producto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}