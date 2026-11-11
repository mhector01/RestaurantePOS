"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BellRing,
  ChefHat,
  ChevronUp,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Split,
  Trash2,
  X,
} from "lucide-react";
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
/** Estado en cocina por producto de esta cuenta. */
export type KitchenStatus = Record<number, { pending: number; ready: number }>;

interface Props {
  mesaId: number;
  label: string; // "Mesa 4" o "Para llevar"
  orderId: number | null;
  products: MenuProduct[];
  categories: MenuCategory[];
  items: OrderLine[];
  paid: number;
  kitchen?: KitchenStatus;
}

type OptimisticAction =
  | { type: "add"; product: MenuProduct }
  | { type: "inc"; id: number }
  | { type: "dec"; id: number };

// Paleta para distinguir categorías de un vistazo
const CAT_STYLES = [
  { bar: "bg-orange-500", soft: "bg-orange-500/15 text-orange-300", ring: "ring-orange-500/40" },
  { bar: "bg-sky-500", soft: "bg-sky-500/15 text-sky-300", ring: "ring-sky-500/40" },
  { bar: "bg-emerald-500", soft: "bg-emerald-500/15 text-emerald-300", ring: "ring-emerald-500/40" },
  { bar: "bg-violet-500", soft: "bg-violet-500/15 text-violet-300", ring: "ring-violet-500/40" },
  { bar: "bg-rose-500", soft: "bg-rose-500/15 text-rose-300", ring: "ring-rose-500/40" },
  { bar: "bg-amber-400", soft: "bg-amber-400/15 text-amber-200", ring: "ring-amber-400/40" },
  { bar: "bg-teal-400", soft: "bg-teal-400/15 text-teal-200", ring: "ring-teal-400/40" },
  { bar: "bg-fuchsia-500", soft: "bg-fuchsia-500/15 text-fuchsia-300", ring: "ring-fuchsia-500/40" },
];
type CatStyle = (typeof CAT_STYLES)[number];
const NEUTRAL: CatStyle = { bar: "bg-ink-500", soft: "bg-ink-500/15 text-ink-300", ring: "ring-ink-500/40" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || name.slice(0, 2).toUpperCase();
}

export function OrderWorkspace({ mesaId, label, orderId, products, categories, items, paid, kitchen = {} }: Props) {
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

  const catStyle = useMemo(() => {
    const m = new Map<number, CatStyle>();
    categories.forEach((c, i) => m.set(c.id, CAT_STYLES[i % CAT_STYLES.length]));
    return m;
  }, [categories]);
  const styleOf = (categoryId: number) => catStyle.get(categoryId) ?? NEUTRAL;
  const categoryOfProduct = useMemo(() => new Map(products.map((p) => [p.id, p.categoryId])), [products]);

  const qtyByProduct = useMemo(() => {
    const m = new Map<number, number>();
    optimisticItems.forEach((i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity));
    return m;
  }, [optimisticItems]);

  const countByCategory = useMemo(() => {
    const m = new Map<number, number>();
    products.forEach((p) => m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1));
    return m;
  }, [products]);

  const q = query.trim().toLowerCase();
  const filtered = products.filter((p) => {
    const inCat = q ? true : category === "all" || p.categoryId === category;
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

  const decProduct = (productId: number) => {
    const line = optimisticItems.find((i) => i.productId === productId && i.id > 0);
    if (line) dec(line);
  };

  const openCheckout = (mode: "full" | "split") => {
    setSheetOpen(false);
    setCheckout({ open: true, mode });
  };

  // ------------------------------------------------------------------
  // Panel de la cuenta (se reutiliza en escritorio y en la hoja móvil)
  // ------------------------------------------------------------------
  const orderPanel = (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b">
        <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          {label === "Para llevar" ? <ShoppingBag className="size-5" /> : <ReceiptText className="size-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Cuenta · {label}</h2>
          <p className="text-sm text-muted-foreground">
            {count === 0 ? "Sin productos" : `${count} producto${count === 1 ? "" : "s"}`}
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

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {isEmpty ? (
          <div className="h-full min-h-48 flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
            <span className="size-16 rounded-2xl bg-muted grid place-items-center mb-4">
              <ReceiptText className="size-8 opacity-60" />
            </span>
            <p className="font-medium text-foreground">La cuenta está vacía</p>
            <p className="text-sm mt-1">Toca un producto del menú para agregarlo.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {optimisticItems.map((line) => {
              const st = styleOf(categoryOfProduct.get(line.productId) ?? -1);
              const k = kitchen[line.productId];
              return (
                <li key={line.id} className="flex gap-3 px-2 py-3">
                  <span className={cn("w-1 rounded-full shrink-0", st.bar)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 font-medium leading-snug">{line.name}</p>
                      <span className="font-semibold tabular">{formatMoney(line.price * line.quantity)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular">{formatMoney(line.price)} c/u</span>
                      {k && k.ready > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-medium px-2 py-0.5">
                          <BellRing className="size-3" /> {k.ready} listo{k.ready === 1 ? "" : "s"}
                        </span>
                      )}
                      {k && k.pending > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 text-amber-200 text-[11px] font-medium px-2 py-0.5">
                          <ChefHat className="size-3" /> {k.pending} en cocina
                        </span>
                      )}
                      <div className="ml-auto flex items-center rounded-xl bg-muted">
                        <button
                          type="button"
                          aria-label={`Quitar una unidad de ${line.name}`}
                          onClick={() => dec(line)}
                          className="size-9 grid place-items-center text-muted-foreground hover:text-destructive"
                        >
                          {line.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                        </button>
                        <span className="w-7 text-center font-semibold tabular">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Agregar una unidad de ${line.name}`}
                          onClick={() => inc(line)}
                          className="size-9 grid place-items-center text-muted-foreground hover:text-primary"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t p-4 space-y-3 bg-ink-950/40">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Productos</span>
            <span className="tabular">{count}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ya abonado</span>
              <span className="text-success font-medium tabular">{formatMoney(paid)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">{paid > 0 ? "Pendiente" : "Total"}</span>
          <span className="text-3xl font-bold tabular tracking-tight">{formatMoney(total)}</span>
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
            className="h-14 rounded-xl text-base font-semibold shadow-lg shadow-primary/25"
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
        <div className="sticky top-16 z-10 bg-background/90 backdrop-blur px-4 sm:px-6 pt-4 pb-3 space-y-3 border-b">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el menú…"
              className="w-full h-12 rounded-xl border bg-card pl-11 pr-10 outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/20"
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
            <CategoryChip active={!q && category === "all"} onClick={() => setCategory("all")} count={products.length}>
              Todo
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                active={!q && category === c.id}
                onClick={() => {
                  setCategory(c.id);
                  setQuery("");
                }}
                count={countByCategory.get(c.id) ?? 0}
              >
                <span className={cn("size-2.5 rounded-full", styleOf(c.id).bar)} />
                {c.name}
              </CategoryChip>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-4 pb-28 lg:pb-8">
          {q && (
            <p className="text-sm text-muted-foreground mb-3">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"} para “{query.trim()}”
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              {products.length === 0
                ? "Aún no hay productos. Agrégalos desde el panel de administración."
                : "No se encontraron productos."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map((p) => {
                const qty = qtyByProduct.get(p.id) ?? 0;
                const st = styleOf(p.categoryId);
                return (
                  <div key={p.id} className="relative">
                    <button
                      type="button"
                      onClick={() => add(p)}
                      className={cn(
                        "w-full text-left rounded-2xl border bg-card overflow-hidden min-h-36 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:border-primary/40 active:scale-[0.97]",
                        qty > 0 && "border-primary/70 ring-2 ring-primary/25"
                      )}
                    >
                      <span className={cn("h-1.5 w-full", st.bar)} />
                      <span className="p-3.5 flex-1 flex flex-col">
                        <span className={cn("size-10 rounded-xl grid place-items-center text-sm font-bold", st.soft)}>
                          {initials(p.name)}
                        </span>
                        <span className="mt-2.5 font-medium leading-snug line-clamp-2">{p.name}</span>
                        <span className="mt-auto pt-2 flex items-end justify-between gap-2">
                          <span className="text-lg font-bold tabular">{formatMoney(p.price)}</span>
                          <span className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/30">
                            <Plus className="size-5" />
                          </span>
                        </span>
                      </span>
                    </button>
                    {qty > 0 && (
                      <>
                        <span className="pointer-events-none absolute -top-2 -right-2 min-w-7 h-7 px-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold grid place-items-center shadow-md tabular ring-2 ring-background">
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Quitar una unidad de ${p.name}`}
                          onClick={() => decProduct(p.id)}
                          className="absolute top-3.5 right-3 size-9 rounded-full bg-muted text-muted-foreground grid place-items-center hover:text-destructive hover:bg-destructive/15"
                        >
                          <Minus className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
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
          className="w-full h-16 rounded-2xl bg-primary text-primary-foreground flex items-center gap-3 px-4 shadow-xl shadow-primary/25 active:scale-[0.99] transition-transform"
        >
          <span className="min-w-9 h-9 px-2 rounded-xl bg-black/20 grid place-items-center font-bold tabular">{count}</span>
          <span className="flex-1 text-left font-semibold">Ver cuenta</span>
          <span className="text-lg font-bold tabular">{formatMoney(total)}</span>
          <ChevronUp className="size-5 opacity-80" />
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
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 pl-4 pr-3 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center gap-2 border transition-colors shrink-0",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
      )}
    >
      {children}
      <span
        className={cn(
          "min-w-5 h-5 px-1 rounded-full text-[11px] grid place-items-center tabular",
          active ? "bg-black/20" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}
