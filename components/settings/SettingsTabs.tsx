"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, Store, UserRoundCog } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/ajustes", label: "Negocio", Icon: Store },
  { href: "/admin/ajustes/cuentas", label: "Acceso al panel", Icon: KeyRound },
  { href: "/admin/ajustes/mi-cuenta", label: "Mi cuenta", Icon: UserRoundCog },
];

export function SettingsTabs({ locked }: { locked?: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin/ajustes" ? pathname === href : pathname.startsWith(href));
  // Con contraseña temporal solo se puede estar en "Mi cuenta"
  const tabs = locked ? TABS.filter((t) => t.href === "/admin/ajustes/mi-cuenta") : TABS;
  return (
    <nav className="-mx-4 sm:mx-0 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
        {tabs.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
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
