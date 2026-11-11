"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { createCategory, saveProduct } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BUSINESS } from "@/lib/config";
import { cn } from "@/lib/utils";

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

export function ProductModal({
  product,
  categories,
  defaultCategoryId,
  compact = false,
}: {
  product?: Product;
  categories: Category[];
  defaultCategoryId?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [newCat, setNewCat] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  const reset = () => {
    setName(product?.name ?? "");
    setPrice(product ? String(product.price) : "");
    setCategoryId(product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? null);
    setLocalCats(categories);
    setNewCat("");
    setCreatingCat(false);
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const cat = await createCategory(newCat);
    setLocalCats((c) => (c.some((x) => x.id === cat.id) ? c : [...c, cat]));
    setCategoryId(cat.id);
    setNewCat("");
    setCreatingCat(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(price);
    if (!categoryId) return toast.error("Elige una categoría");
    if (Number.isNaN(value) || value < 0) return toast.error("Precio no válido");
    setLoading(true);
    try {
      await saveProduct(product?.id ?? null, name, value, categoryId);
      toast.success(product ? "Producto actualizado" : "Producto agregado");
      setOpen(false);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {product ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${product.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : compact ? (
          <Button variant="ghost" size="sm" className="h-10 rounded-xl text-primary hover:text-primary">
            <Plus /> Agregar
          </Button>
        ) : (
          <Button className="h-11 rounded-xl">
            <Plus /> Nuevo producto
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>Así aparecerá en el menú de los meseros.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Hamburguesa doble"
              required
              autoFocus
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-price">Precio</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{BUSINESS.currency}</span>
              <Input
                id="p-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
                required
                className="h-12 rounded-xl pl-9 text-lg font-semibold tabular"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {localCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "h-10 px-4 rounded-full border text-sm font-medium transition-colors",
                    categoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {c.name}
                </button>
              ))}
              {!creatingCat && (
                <button
                  type="button"
                  onClick={() => setCreatingCat(true)}
                  className="h-10 px-4 rounded-full border border-dashed text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center gap-1"
                >
                  <Plus className="size-4" /> Nueva
                </button>
              )}
            </div>
            {creatingCat && (
              <div className="flex gap-2 pt-1">
                <Input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                  placeholder="Nombre de la categoría"
                  className="h-11 rounded-xl"
                />
                <Button type="button" className="h-11 rounded-xl" onClick={addCategory}>
                  Crear
                </Button>
                <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={() => setCreatingCat(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading || creatingCat}>
            {loading && <Loader2 className="animate-spin" />}
            {product ? "Guardar cambios" : "Agregar al menú"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
