"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronUp, Minus, Plus, ReceiptText, Search, Split, Trash2, X } from "lucide-react";
import {
  addProductToOrder,
  clearOrder,
  incrementOrderItem,
  removeProductFromOrder,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmAction } from "./ConfirmAction";
import { CheckoutDialog } from "./CheckoutDialog";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface MenuProduct {
  id: number;
  name: string;
  price: number;
  categoryId: number;
}
export interface MenuCategory {
  id: number;
  name: string;
}
export interface OrderLine {
  id: number; // id de OrderItem (negativo = optimista, aún no guardado)
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  mesaId: number;
  orderId: number | null;
  products: MenuProduct[];
  categories: MenuCategory[];
  items: OrderLine[];
  paid: number;
}

type OptimisticAction =
  | { type: "add"; product: MenuProduct }
  | { type: "inc"; id: number }
  | { type: "dec"; id: number };

// Colores suaves para distinguir categorías de un vistazo
const CAT_COLORS = [
  "bg-orange-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-fuchsia-500",
];

export function OrderWorkspace({ mesaId, orderId, products, categories, items, paid }: Props) {
  const [, startTransition] = useTransition();
  const [optimisticItems, applyOptimistic] = useOptimistic(items, (state: OrderLine[], action: OptimisticAction) => {
    switch (action.type) {
      case "add": {
        const found = state.find((i) => i.productId === action.product.id && i.price === action.product.price);
        if (found) return state.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i));
        return [
          ...state,
          {
            id: -action.product.id, // temporal y único: una línea por producto
            productId: action.product.id,
            name: action.product.name,
            price: action.product.price,
            quantity: 1,
          },
        ];
      }
      case "inc":
        return state.map((i) => (i.id === action.id ? { ...i, quantity: i.quantity + 1 } : i));
      case "dec":
        return state
          .map((i) => (i.id === action.id ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0);
    }
  });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checkout, setCheckout] = useState<{ open: boolean; mode: "full" | "split" }>({
    open: false,
    mode: "full",
  });

  // Conserva la orden aunque el servidor la cierre, para que el diálogo
  // de cobro pueda mostrar el resultado del pago.
  const [checkoutOrderId, setCheckoutOrderId] = useState(orderId);
  if (orderId && orderId !== checkoutOrderId) setCheckoutOrderId(orderId);

  const catColor = useMemo(() => {
    const m = new Map<number, string>();
    categories.forEach((c, i) => m.set(c.id, CAT_COLORS[i % CAT_COLORS.length]));
    return m;
  }, [categories]);

  const qtyByProduct = useMemo(() => {
    const m = new Map<number, number>();
    optimisticItems.forEach((i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity));
    return m;
  }, [optimisticItems]);

  const filtered = products.filter((p) => {
    const inCat = category === "all" || p.categoryId === category;
    const q = query.trim().toLowerCase();
    return inCat && (!q || p.name.toLowerCase().includes(q));
  });

  const total = optimisticItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = optimisticItems.reduce((s, i) => s + i.quantity, 0);
  const isEmpty = optimisticItems.length === 0;
  const syncing = optimisticItems.some((i) => i.id < 0);

  const add = (p: MenuProduct) =>
    startTransition(async () => {
      applyOptimistic({ type: "add", product: p });
      const res = await addProductToOrder(mesaId, p.id);
      if (res?.error) toast.error(res.error);
    });

  const inc = (line: OrderLine) =>
    startTransition(async () => {
      if (line.id < 0) return;
      applyOptimistic({ type: "inc", id: line.id });
      await incrementOrderItem(line.id, mesaId);
    });

  const dec = (line: OrderLine) =>
    startTransition(async () => {
      if (line.id < 0) return;
      applyOptimistic({ type: "dec", id: line.id });
      await removeProductFromOrder(line.id, mesaId);
    });

  const openCheckout = (mode: "full" | "split") => {
    setSheetOpen(false);
    setCheckout({ open: true, mode });
  };

  // ------------------------------------------------------------------
  // Panel de la cuenta (se reutiliza en escritorio y en la hoja móvil)
  // ------------------------------------------------------------------
  const orderPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Cuenta</h2>
          <p className="text-sm text-muted-foreground">
            {count} producto{count === 1 ? "" : "s"}
          </p>
        </div>
        {!isEmpty && orderId && (
          <ConfirmAction
            title="¿Vaciar la cuenta?"
            description="Se quitarán todos los productos que aún no se han cobrado y la mesa quedará libre."
            confirmLabel="Vaciar cuenta"
            successMessage="Cuenta vaciada"
            action={async () => {
              await clearOrder(orderId, mesaId);
              setSheetOpen(false);
            }}
          >
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-9">
              <Trash2 /> Vaciar
            </Button>
          </ConfirmAction>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3">
        {isEmpty ? (
          <div className="h-full min-h-48 flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
            <ReceiptText className="size-10 mb-3 opacity-40" />
            <p className="font-medium text-foreground">Cuenta vacía</p>
            <p className="text-sm mt-1">Toca un producto del menú para agregarlo.</p>
          </div>
        ) : (
          <ul className="space-y-1 pb-2">
            {optimisticItems.map((line) => (
              <li key={line.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-tight truncate">{line.name}</p>
                  <p className="text-xs text-muted-foreground tabular mt-0.5">
                    {formatMoney(line.price)} c/u
                  </p>
                </div>
                <div className="flex items-center rounded-xl border bg-card">
                  <button
                    type="button"
                    aria-label={`Quitar una unidad de ${line.name}`}
                    onClick={() => dec(line)}
                    className="size-10 grid place-items-center text-muted-foreground hover:text-destructive"
                  >
                    {line.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                  </button>
                  <span className="w-6 text-center font-semibold tabular">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Agregar una unidad de ${line.name}`}
                    onClick={() => inc(line)}
                    className="size-10 grid place-items-center text-muted-foreground hover:text-primary"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <span className="w-20 text-right font-semibold tabular">
                  {formatMoney(line.price * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t p-4 space-y-3 bg-card">
        {paid > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ya abonado</span>
            <span className="text-success font-medium tabular">{formatMoney(paid)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">{paid > 0 ? "Pendiente" : "Total"}</span>
          <span className="text-3xl font-semibold tabular">{formatMoney(total)}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            variant="outline"
            className="h-14 rounded-xl px-4"
            disabled={isEmpty || syncing || !orderId}
            onClick={() => openCheckout("split")}
            title="Dividir cuenta"
          >
            <Split /> Dividir
          </Button>
          <Button
            className="h-14 rounded-xl text-base"
            disabled={isEmpty || syncing || !orderId}
            onClick={() => openCheckout("full")}
          >
            Cobrar {formatMoney(total)}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex">
      {/* ---------------------------- MENÚ ---------------------------- */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-16 z-10 bg-background/90 backdrop-blur px-4 sm:px-6 pt-4 pb-3 space-y-3 border-b lg:border-none">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full h-12 rounded-xl border bg-card pl-11 pr-10 outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
              Todo
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                <span className={cn("size-2 rounded-full", catColor.get(c.id))} />
                {c.name}
              </CategoryChip>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-4 pb-28 lg:pb-8">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              {products.length === 0
                ? "Aún no hay productos. Agrégalos desde el panel de administración."
                : "No se encontraron productos."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const q = qtyByProduct.get(p.id) ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => add(p)}
                    className={cn(
                      "relative text-left rounded-2xl border bg-card p-4 min-h-28 flex flex-col transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.97]",
                      q > 0 && "border-primary/50 ring-1 ring-primary/20"
                    )}
                  >
                    <span className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-r-full", catColor.get(p.categoryId))} />
                    <span className="font-medium leading-snug line-clamp-2 pr-6">{p.name}</span>
                    <span className="mt-auto pt-3 flex items-end justify-between">
                      <span className="text-lg font-semibold tabular">{formatMoney(p.price)}</span>
                      <span className="size-8 rounded-lg bg-muted grid place-items-center text-muted-foreground">
                        <Plus className="size-4" />
                      </span>
                    </span>
                    {q > 0 && (
                      <span className="absolute -top-2 -right-2 min-w-7 h-7 px-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold grid place-items-center shadow-sm tabular">
                        {q}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ------------------- CUENTA (TABLET / ESCRITORIO) ------------------- */}
      <aside className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 border-l bg-card sticky top-16 h-[calc(100dvh-4rem)]">
        {orderPanel}
      </aside>

      {/* -------------------------- BARRA MÓVIL -------------------------- */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-background/0">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full h-16 rounded-2xl bg-foreground text-background flex items-center gap-3 px-4 shadow-lg active:scale-[0.99] transition-transform"
        >
          <span className="min-w-9 h-9 px-2 rounded-xl bg-primary text-primary-foreground grid place-items-center font-semibold tabular">
            {count}
          </span>
          <span className="flex-1 text-left font-medium">Ver cuenta</span>
          <span className="text-lg font-semibold tabular">{formatMoney(total)}</span>
          <ChevronUp className="size-5 opacity-70" />
        </button>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent
          showCloseButton={false}
          className="lg:hidden flex flex-col p-0 gap-0 top-auto bottom-0 left-0 translate-x-0 translate-y-0 max-w-none sm:max-w-none w-full rounded-t-3xl rounded-b-none h-[85dvh] border-x-0 border-b-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        >
          <DialogTitle className="sr-only">Cuenta de la mesa</DialogTitle>
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/25" />
          {orderPanel}
        </DialogContent>
      </Dialog>

      {checkoutOrderId && (
        <CheckoutDialog
          open={checkout.open}
          onOpenChange={(v) => setCheckout((c) => ({ ...c, open: v }))}
          initialMode={checkout.mode}
          orderId={checkoutOrderId}
          mesaId={mesaId}
          items={optimisticItems}
        />
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center gap-2 border transition-colors shrink-0",
        active ? "bg-foreground text-background border-foreground" : "bg-card hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
