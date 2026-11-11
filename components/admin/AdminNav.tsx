"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, ChefHat, LayoutDashboard, LogOut, Store, UsersRound, UtensilsCrossed, Wallet } from "lucide-react";
import { logoutAdmin } from "@/app/actions";
import { cn } from "@/lib/utils";
import { BrandLogo, BrandMark } from "@/components/Brand";

const NAV = [
  { href: "/admin", label: "Resumen", Icon: LayoutDashboard },
  { href: "/admin/reportes", label: "Caja", Icon: Wallet },
  { href: "/admin/productos", label: "Menú", Icon: UtensilsCrossed },
  { href: "/admin/mesas", label: "Plano", Icon: Armchair },
  { href: "/admin/usuarios", label: "Personal", Icon: UsersRound },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
}

/** Menú lateral (tablet/escritorio). */
export function AdminSidebar({ business }: { business: string }) {
  const isActive = useActive();
  return (
    <aside className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground h-dvh sticky top-0">
      <div className="px-5 pt-5 pb-4 border-b border-sidebar-border">
        <BrandLogo className="h-11" priority />
        <p className="mt-3 text-xs text-sidebar-foreground/60 truncate">
          Administración · <span className="text-sidebar-foreground font-medium">{business}</span>
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
            )}
          >
            <Icon className={cn("size-5", isActive(href) && "text-primary")} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 space-y-1 border-t border-sidebar-border">
        <Link
          href="/"
          className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
        >
          <Store className="size-5" /> Ir al punto de venta
        </Link>
        <Link
          href="/cocina"
          className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
        >
          <ChefHat className="size-5" /> Pantalla de cocina
        </Link>
        <form action={logoutAdmin}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut className="size-5" /> Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Barra superior + navegación inferior (celular). */
export function AdminMobileNav({ business }: { business: string }) {
  const isActive = useActive();
  return (
    <>
      <header className="md:hidden sticky top-0 z-20 h-14 bg-sidebar text-sidebar-foreground flex items-center gap-3 px-4">
        <BrandMark className="h-8" />
        <p className="font-semibold flex-1 truncate">{business}</p>
        <Link href="/" aria-label="Ir al punto de venta" className="size-10 grid place-items-center rounded-full hover:bg-white/10">
          <Store className="size-5" />
        </Link>
        <form action={logoutAdmin}>
          <button type="submit" aria-label="Cerrar sesión" className="size-10 grid place-items-center rounded-full hover:bg-white/10">
            <LogOut className="size-5" />
          </button>
        </form>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isActive(href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
