"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Landmark, LineChart, PiggyBank, UtensilsCrossed, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/reportes", label: "Ventas", Icon: LineChart, keep: true },
  { href: "/admin/reportes/productos", label: "Productos", Icon: UtensilsCrossed, keep: true },
  { href: "/admin/reportes/ganancias", label: "Ganancias", Icon: PiggyBank, keep: true },
  { href: "/admin/reportes/impuestos", label: "Impuestos SAR", Icon: Landmark, keep: true },
  { href: "/admin/reportes/caja", label: "Cierre de caja", Icon: Wallet, keep: false },
];

/** Pestañas de reportes. El periodo elegido se conserva al cambiar de pestaña. */
export function ReportTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();
  const active = (href: string) => (href === "/admin/reportes" ? pathname === href : pathname.startsWith(href));
  return (
    <nav className="-mx-4 sm:mx-0 mb-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
      <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
        {TABS.map(({ href, label, Icon, keep }) => (
          <Link
            key={href}
            href={keep && qs ? `${href}?${qs}` : href}
            className={cn(
              "h-10 px-3.5 rounded-xl text-sm font-medium inline-flex items-center gap-2 border transition-colors",
              active(href) ? "bg-primary/15 border-primary/40 text-primary" : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
