"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Boxes, ClipboardCheck, CookingPot, ShoppingCart, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/inventario", label: "Stock", Icon: Boxes },
  { href: "/admin/inventario/compras", label: "Compras", Icon: ShoppingCart },
  { href: "/admin/inventario/proveedores", label: "Proveedores", Icon: Truck },
  { href: "/admin/inventario/recetas", label: "Recetas", Icon: CookingPot },
  { href: "/admin/inventario/conteo", label: "Conteo", Icon: ClipboardCheck },
  { href: "/admin/inventario/movimientos", label: "Movimientos", Icon: ArrowLeftRight },
];

/** Pestañas del módulo de inventario. */
export function InventoryTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin/inventario" ? pathname === href : pathname.startsWith(href);
  return (
    <nav className="-mx-4 sm:mx-0 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
      <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
        {TABS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "h-10 px-3.5 rounded-xl text-sm font-medium inline-flex items-center gap-2 border transition-colors",
              active(href)
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Título de cada sección con sus botones a la derecha. */
export function SectionBar({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap print:hidden">{children}</div>}
    </div>
  );
}

/** Indicador pequeño de la parte superior de cada sección. */
export function MiniKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "warn" | "good";
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "text-xl sm:text-2xl font-semibold tabular mt-1 truncate",
          tone === "danger" && "text-red-400",
          tone === "warn" && "text-amber-300",
          tone === "good" && "text-success"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}
