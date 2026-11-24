// Pantallas de muestra de Ristemo dibujadas con HTML (sin capturas), para la página de venta.
import { BellRing, Check, ChefHat, Clock, Flame, Percent, TriangleAlert, Users } from "lucide-react";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Marco de aparato (tablet / pantalla) con barra superior. */
export function DeviceFrame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border border-white/10 bg-ink-900/80 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 h-10 border-b border-white/8 bg-white/[0.02]">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 text-[11px] text-ink-400 font-medium truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

type TableState = "free" | "busy" | "ready";
const TABLES: { n: number; s: TableState; total?: number; min?: number; shape?: "round" | "wide"; name?: string }[] = [
  { n: 1, s: "busy", total: 845, min: 32 },
  { n: 2, s: "free", shape: "round" },
  { n: 3, s: "ready", total: 1210, min: 18 },
  { n: 4, s: "busy", total: 390, min: 7, shape: "round" },
  { n: 5, s: "free" },
  { n: 6, s: "busy", total: 2380, min: 54, shape: "wide", name: "Familia López" },
  { n: 7, s: "free", shape: "round" },
  { n: 8, s: "ready", total: 615, min: 22 },
];

function TableCard({ t }: { t: (typeof TABLES)[number] }) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between p-2.5 border text-left min-h-[4.6rem]",
        t.shape === "round" ? "rounded-full items-center justify-center text-center aspect-square min-h-0" : "rounded-xl",
        t.shape === "wide" && "col-span-2",
        t.s === "free" && "border-white/10 bg-white/[0.03]",
        t.s === "busy" && "border-primary/50 bg-primary/12",
        t.s === "ready" && "border-sky-400/60 bg-sky-400/12",
      )}
    >
      {t.s === "ready" && (
        <span className="absolute -top-1.5 -right-1.5 flex size-4">
          <span className="absolute inline-flex size-full rounded-full bg-sky-400 opacity-60 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex size-4 rounded-full bg-sky-400 items-center justify-center">
            <BellRing className="size-2.5 text-ink-950" />
          </span>
        </span>
      )}
      <span className="text-[11px] font-semibold text-white">Mesa {t.n}</span>
      {t.s === "free" ? (
        <span className="text-[10px] text-ink-400">Libre</span>
      ) : (
        <span className="leading-tight">
          {t.name && <span className="block text-[9px] text-ink-300 truncate">{t.name}</span>}
          <span className="block text-[11px] font-semibold text-white tabular">{formatMoney(t.total!)}</span>
          <span className={cn("block text-[9px]", t.s === "ready" ? "text-sky-300" : "text-ink-300")}>
            {t.s === "ready" ? "Listo en cocina" : `${t.min} min`}
          </span>
        </span>
      )}
    </div>
  );
}

/** Plano de mesas en vivo. */
export function FloorMock() {
  return (
    <DeviceFrame title="Salón · Ristemo">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          {["Salón", "Terraza", "Barra"].map((r, i) => (
            <span
              key={r}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-medium",
                i === 0 ? "bg-primary text-white" : "bg-white/5 text-ink-300",
              )}
            >
              {r}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-ink-300">
            <span className="size-5 rounded-full bg-gradient-to-br from-primary to-amber-300 grid place-items-center text-[9px] font-bold text-ink-950">
              AM
            </span>
            Ana · mesera
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {TABLES.map((t) => (
            <TableCard key={t.n} t={t} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[10px] text-ink-400">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-white/25" />Libre</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Ocupada</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" />Pedido listo</span>
        </div>
      </div>
    </DeviceFrame>
  );
}

/** Tarjeta flotante: comanda en cocina. */
export function KitchenTicketChip() {
  return (
    <div className="w-56 rounded-2xl border border-white/10 bg-ink-900/95 p-3.5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <ChefHat className="size-3.5 text-primary" /> Mesa 3
        </span>
        <span className="flex items-center gap-1 text-[10px] text-amber-300 tabular">
          <Clock className="size-3" /> 12:40
        </span>
      </div>
      <ul className="mt-2.5 space-y-1.5 text-[11px]">
        <li className="flex items-center gap-2 text-ink-400 line-through">
          <Check className="size-3 text-emerald-400" /> 2× Baleada especial
        </li>
        <li className="flex items-center gap-2 text-white">
          <span className="size-3 rounded border border-white/30" /> 1× Pollo chuco
        </li>
        <li className="flex items-center gap-2 text-white">
          <span className="size-3 rounded border border-white/30" /> 1× Sopa de caracol
        </li>
      </ul>
    </div>
  );
}

/** Tarjeta flotante: ventas de hoy. */
export function SalesChip() {
  const bars = [30, 42, 28, 55, 48, 70, 92, 64, 80, 58];
  return (
    <div className="w-52 rounded-2xl border border-white/10 bg-ink-900/95 p-3.5 shadow-2xl backdrop-blur">
      <p className="text-[10px] uppercase tracking-wider text-ink-400">Ventas de hoy</p>
      <p className="mt-0.5 text-lg font-semibold text-white tabular">{formatMoney(18450)}</p>
      <p className="text-[10px] text-emerald-400">▲ 12% vs. ayer</p>
      <div className="mt-2.5 flex items-end gap-1 h-10">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className={cn("flex-1 rounded-sm", i === 6 ? "bg-primary" : "bg-white/15")}
          />
        ))}
      </div>
    </div>
  );
}

/** Tarjeta flotante: factura emitida. */
export function InvoiceChip() {
  return (
    <div className="w-48 rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-2xl backdrop-blur flex items-center gap-3">
      <span className="size-9 rounded-xl bg-emerald-400/15 grid place-items-center shrink-0">
        <Check className="size-4 text-emerald-400" />
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] font-semibold text-white">Factura emitida</span>
        <span className="block text-[10px] text-ink-400 font-mono">000-001-01-00000482</span>
      </span>
    </div>
  );
}

const ORDERS = [
  { t: "Mesa 6", who: "Familia López", min: 14, late: false, items: ["3× Plato típico", "2× Tajadas con carne", "1× Pupusas mixtas"], done: 1 },
  { t: "Llevar", who: "Carlos · 9988-1122", min: 9, late: false, items: ["2× Hamburguesa clásica", "1× Papas grandes"], done: 0 },
  { t: "Mesa 1", who: "", min: 23, late: true, items: ["1× Churrasco", "1× Pescado frito", "1× Sopa de res"], done: 2 },
];

/** Pantalla de cocina. */
export function KitchenMock() {
  return (
    <DeviceFrame title="Cocina · pedidos pendientes">
      <div className="p-4 grid sm:grid-cols-3 gap-3">
        {ORDERS.map((o) => (
          <div key={o.t} className={cn("rounded-xl border p-3", o.late ? "border-red-400/50 bg-red-400/8" : "border-white/10 bg-white/[0.03]")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{o.t}</span>
              <span className={cn("flex items-center gap-1 text-[10px] tabular", o.late ? "text-red-300" : "text-amber-300")}>
                {o.late ? <Flame className="size-3" /> : <Clock className="size-3" />} {o.min} min
              </span>
            </div>
            {o.who && <p className="text-[10px] text-ink-400 truncate">{o.who}</p>}
            <ul className="mt-2.5 space-y-1.5">
              {o.items.map((it, i) => (
                <li key={it} className={cn("flex items-center gap-2 text-[11px]", i < o.done ? "text-ink-500 line-through" : "text-ink-100")}>
                  {i < o.done ? <Check className="size-3 text-emerald-400" /> : <span className="size-3 rounded border border-white/30" />}
                  {it}
                </li>
              ))}
            </ul>
            <div className="mt-3 h-7 rounded-lg bg-white/8 text-[10px] text-ink-200 grid place-items-center font-medium">Marcar todo listo</div>
          </div>
        ))}
      </div>
    </DeviceFrame>
  );
}

/** Cobro con descuento, propina y factura. */
export function CheckoutMock() {
  const lines = [
    ["2× Baleada especial", 180],
    ["1× Combo pollo + bebida", 245],
    ["2× Licuado de fresa", 130],
  ] as const;
  return (
    <DeviceFrame title="Cobrar · Mesa 4">
      <div className="p-5 grid gap-4">
        <ul className="space-y-2 text-xs">
          {lines.map(([n, v]) => (
            <li key={n} className="flex justify-between text-ink-200">
              <span>{n}</span>
              <span className="tabular">{formatMoney(v)}</span>
            </li>
          ))}
          <li className="flex justify-between text-emerald-300">
            <span className="flex items-center gap-1.5"><Percent className="size-3" /> Descuento · autorizó Encargado</span>
            <span className="tabular">−{formatMoney(41.5)}</span>
          </li>
        </ul>
        <div className="border-t border-dashed border-white/15 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-ink-400"><span>Gravado 15%</span><span className="tabular">{formatMoney(446.52)}</span></div>
          <div className="flex justify-between text-ink-400"><span>ISV 15%</span><span className="tabular">{formatMoney(66.98)}</span></div>
          <div className="flex justify-between text-sm font-semibold text-white"><span>Total</span><span className="tabular">{formatMoney(513.5)}</span></div>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3">
          <p className="text-[11px] text-ink-300">¿Deja propina voluntaria?</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-medium">
            <span className="h-8 rounded-lg bg-white/5 grid place-items-center text-ink-300">No</span>
            <span className="h-8 rounded-lg bg-primary text-white grid place-items-center">Sí · 10%</span>
            <span className="h-8 rounded-lg bg-white/5 grid place-items-center text-ink-300">Otro monto</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
          <span className="h-9 rounded-lg border border-white/12 grid place-items-center text-ink-200">Efectivo</span>
          <span className="h-9 rounded-lg border border-primary/60 bg-primary/10 grid place-items-center text-white">Tarjeta</span>
        </div>
        <div className="h-10 rounded-xl bg-primary text-white text-sm font-semibold grid place-items-center">
          Cobrar {formatMoney(564.85)} y facturar
        </div>
      </div>
    </DeviceFrame>
  );
}

const STOCK = [
  { n: "Pechuga de pollo", u: "lb", q: 42, min: 15, ideal: 60 },
  { n: "Harina de trigo", u: "lb", q: 8, min: 10, ideal: 40 },
  { n: "Frijoles rojos", u: "lb", q: 26, min: 10, ideal: 35 },
  { n: "Queso seco", u: "lb", q: 5, min: 6, ideal: 20 },
  { n: "Aceite", u: "gal", q: 3.5, min: 2, ideal: 6 },
];

/** Inventario con alertas de stock bajo. */
export function InventoryMock() {
  return (
    <DeviceFrame title="Inventario · insumos">
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2 text-[11px] text-amber-200">
          <TriangleAlert className="size-3.5 shrink-0" /> 2 insumos bajo el mínimo · lista de compras lista por proveedor
        </div>
        <ul className="space-y-3">
          {STOCK.map((s) => {
            const low = s.q <= s.min;
            return (
              <li key={s.n}>
                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-100">{s.n}</span>
                  <span className={cn("tabular", low ? "text-amber-300 font-semibold" : "text-ink-400")}>
                    {s.q} {s.u}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/8 relative overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", low ? "bg-amber-400" : "bg-emerald-400/80")}
                    style={{ width: `${Math.min(100, (s.q / s.ideal) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 rounded-xl bg-white/[0.04] border border-white/8 p-3 text-[11px]">
          <p className="text-ink-300">Receta · <span className="text-white font-medium">Baleada especial</span></p>
          <p className="mt-1 text-ink-400">Tortilla, frijoles, queso, mantequilla, huevo, aguacate</p>
          <div className="mt-2 flex justify-between">
            <span className="text-ink-300">Costo del plato <span className="text-white tabular">{formatMoney(24.3)}</span></span>
            <span className="text-emerald-300 font-medium">Margen 73%</span>
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}

/** Factura SAR impresa (papel térmico 80 mm). */
export function InvoicePaper() {
  return (
    <div className="mx-auto w-[17rem] bg-[#fbfaf7] text-[#111] font-mono text-[10px] leading-snug px-5 pt-5 pb-7 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] rotate-[-2deg] [clip-path:polygon(0_0,100%_0,100%_calc(100%-8px),95%_100%,90%_calc(100%-8px),85%_100%,80%_calc(100%-8px),75%_100%,70%_calc(100%-8px),65%_100%,60%_calc(100%-8px),55%_100%,50%_calc(100%-8px),45%_100%,40%_calc(100%-8px),35%_100%,30%_calc(100%-8px),25%_100%,20%_calc(100%-8px),15%_100%,10%_calc(100%-8px),5%_100%,0_calc(100%-8px))]">
      <p className="text-center font-bold text-[12px]">COMEDOR LA CEIBA</p>
      <p className="text-center">RTN 0801-1990-123456</p>
      <p className="text-center">Col. Palmira, Tegucigalpa</p>
      <p className="mt-2 text-center font-bold">FACTURA</p>
      <p>No. 000-001-01-00000482</p>
      <p>CAI 3E5A1C-8B2F4D-9A7C11-04E2B8-6F0D3A-7C</p>
      <p>Rango 00000001 al 00005000</p>
      <p>Fecha límite: 31/12/2026</p>
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="flex justify-between"><span>2 Baleada especial</span><span>{formatMoney(180)}</span></div>
      <div className="flex justify-between"><span>1 Combo pollo</span><span>{formatMoney(245)}</span></div>
      <div className="flex justify-between"><span>2 Licuado fresa</span><span>{formatMoney(130)}</span></div>
      <div className="my-2 border-t border-dashed border-black/40" />
      <div className="flex justify-between"><span>Desc. y rebajas</span><span>{formatMoney(41.5)}</span></div>
      <div className="flex justify-between"><span>Importe gravado 15%</span><span>{formatMoney(446.52)}</span></div>
      <div className="flex justify-between"><span>ISV 15%</span><span>{formatMoney(66.98)}</span></div>
      <div className="flex justify-between font-bold text-[11px]"><span>TOTAL</span><span>{formatMoney(513.5)}</span></div>
      <div className="flex justify-between mt-1"><span>Propina voluntaria</span><span>{formatMoney(51.35)}</span></div>
      <div className="flex justify-between font-bold"><span>Total a pagar</span><span>{formatMoney(564.85)}</span></div>
      <p className="mt-3 text-center">La factura es beneficio de todos. ¡Exíjala!</p>
    </div>
  );
}

/** Reportes y estado de resultados. */
export function ReportsMock() {
  const days = [62, 48, 55, 71, 66, 94, 100];
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <DeviceFrame title="Reportes · últimos 7 días">
      <div className="p-5">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ["Ventas", formatMoney(112840), "▲ 9%", "text-emerald-400"],
            ["Ticket promedio", formatMoney(486), "▲ 4%", "text-emerald-400"],
            ["Utilidad neta", formatMoney(31260), "▲ 14%", "text-emerald-400"],
          ].map(([k, v, d, c]) => (
            <div key={k} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-ink-400">{k}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-white tabular">{v}</p>
              <p className={cn("text-[9px]", c)}>{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-end gap-2.5 h-32">
          {days.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div
                style={{ height: `${h}%` }}
                className={cn("w-full rounded-t-md", i === 6 ? "bg-gradient-to-t from-primary/70 to-primary" : "bg-gradient-to-t from-[#3987e5]/40 to-[#3987e5]/80")}
              />
              <span className="text-[9px] text-ink-400">{labels[i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 text-[11px]">
          <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3">
            <p className="text-ink-400">Más vendido</p>
            <p className="text-white font-medium">Baleada especial · 412</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3">
            <p className="text-ink-400 flex items-center gap-1"><Users className="size-3" /> Mejor mesero</p>
            <p className="text-white font-medium">Ana M. · {formatMoney(28900)}</p>
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}
