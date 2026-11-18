"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, UserRoundCog, UsersRound } from "lucide-react";
import { logoutPlatform } from "@/app/platform-actions";
import { BrandMark } from "@/components/Brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/plataforma", label: "Restaurantes", Icon: Building2 },
  { href: "/plataforma/equipo", label: "Equipo", Icon: UsersRound },
  { href: "/plataforma/cuenta", label: "Mi cuenta", Icon: UserRoundCog },
];

export function PlatformNav({ name, locked }: { name: string; locked: boolean }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/plataforma" ? pathname === href || pathname.startsWith("/plataforma/r/") : pathname.startsWith(href);
  const items = locked ? NAV.filter((n) => n.href === "/plataforma/cuenta") : NAV;
  return (
    <header className="sticky top-0 z-20 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
        <BrandMark className="h-8" />
        <p className="font-semibold text-white">Plataforma</p>
        <nav className="flex-1 flex items-center gap-1 ml-2 overflow-x-auto [scrollbar-width:none]">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "h-9 px-3 rounded-xl text-sm font-medium inline-flex items-center gap-2 shrink-0",
                active(href) ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <Icon className={cn("size-4", active(href) && "text-primary")} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <span className="hidden md:block text-sm text-sidebar-foreground/70 truncate max-w-40">{name}</span>
        <form action={logoutPlatform}>
          <button type="submit" aria-label="Cerrar sesión" className="size-9 grid place-items-center rounded-full hover:bg-white/10">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
