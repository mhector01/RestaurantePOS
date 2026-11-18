import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, PartyPopper } from "lucide-react";
import prisma from "@/lib/prisma";
import { getRestaurant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

/**
 * Primeros pasos de un restaurante nuevo. Cada paso se marca solo cuando ya está hecho
 * y la tarjeta desaparece cuando el restaurante hizo su primera venta con todo configurado.
 */
export async function GettingStarted({ welcome }: { welcome?: boolean }) {
  const [restaurant, tables, products, waiters, payments, fiscal] = await Promise.all([
    getRestaurant(),
    prisma.table.count({ where: { number: { gt: 0 } } }),
    prisma.product.count(),
    prisma.user.count(),
    prisma.payment.count(),
    prisma.fiscalSettings.findFirst({ select: { enabled: true } }),
  ]);
  const steps = [
    { done: !!restaurant?.name && !!restaurant.address, title: "Datos del negocio", text: "Nombre, dirección, teléfono y RTN del ticket.", href: "/admin/ajustes" },
    { done: tables > 0, title: "Dibuja tus mesas", text: "Salas y mesas del local en el plano.", href: "/admin/mesas" },
    { done: products > 0, title: "Arma tu menú", text: "Categorías, productos, precios y combos.", href: "/admin/productos" },
    { done: waiters > 0, title: "Agrega a tu personal", text: "Cada mesero entra con su PIN de 4 dígitos.", href: "/admin/usuarios" },
    { done: !!fiscal?.enabled, title: "Facturación SAR (opcional)", text: "Datos fiscales y rango CAI para facturar.", href: "/admin/facturacion/datos", optional: true },
    { done: payments > 0, title: "Haz tu primera venta", text: "Abre una mesa desde el punto de venta y cóbrala.", href: "/" },
  ];
  const required = steps.filter((s) => !s.optional);
  if (required.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {welcome && <PartyPopper className="size-5 text-primary" />}
            {welcome ? "¡Bienvenido a Ristemo!" : "Primeros pasos"}
          </h2>
          <p className="text-sm text-muted-foreground">Configura lo básico y empieza a vender. Cada paso se marca solo al terminarlo.</p>
        </div>
        <span className="text-sm font-medium tabular text-primary">
          {doneCount} de {steps.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {steps.map((s) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className={cn(
                "h-full flex items-start gap-3 rounded-xl border bg-card p-3 hover:border-primary/40 transition-colors",
                s.done && "opacity-60"
              )}
            >
              {s.done ? <CheckCircle2 className="size-5 text-emerald-400 shrink-0" /> : <Circle className="size-5 text-muted-foreground shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className={cn("block text-sm font-medium", s.done && "line-through")}>{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.text}</span>
              </span>
              {!s.done && <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
