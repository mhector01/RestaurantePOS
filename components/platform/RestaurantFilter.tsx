"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ESTADOS = [
  { key: "", label: "Todos" },
  { key: "activos", label: "Activos" },
  { key: "prueba", label: "En prueba" },
  { key: "por-cobrar", label: "Por cobrar" },
  { key: "bloqueados", label: "Bloqueados" },
];

export function RestaurantFilter({ q, estado }: { q: string; estado: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const go = (next: { q?: string; estado?: string }) => {
    const p = new URLSearchParams();
    const qq = next.q ?? text;
    const ee = next.estado ?? estado;
    if (qq.trim()) p.set("q", qq.trim());
    if (ee) p.set("estado", ee);
    router.replace(`/plataforma${p.size ? `?${p}` : ""}`);
  };
  return (
    <div className="flex flex-col lg:flex-row gap-2 mb-4">
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          go({});
        }}
      >
        <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== q && go({})}
          placeholder="Buscar por nombre, subdominio o correo del dueño"
          aria-label="Buscar restaurante"
          className="h-11 rounded-xl pl-10"
        />
      </form>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {ESTADOS.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => go({ estado: e.key })}
            className={cn(
              "h-11 px-3.5 rounded-xl text-sm font-medium border shrink-0",
              estado === e.key ? "bg-primary/15 border-primary/40 text-primary" : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {e.label}
          </button>
        ))}
      </div>
    </div>
  );
}
