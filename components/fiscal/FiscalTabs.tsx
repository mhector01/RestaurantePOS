"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/facturacion", label: "Facturas", Icon: FileText },
  { href: "/admin/facturacion/rangos", label: "Rangos CAI", Icon: KeyRound },
  { href: "/admin/facturacion/datos", label: "Datos fiscales", Icon: Building2 },
];

/** Pestañas del módulo de facturación. */
export function FiscalTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin/facturacion" ? pathname === href : pathname.startsWith(href);
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

