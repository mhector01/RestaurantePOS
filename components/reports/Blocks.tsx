import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminNav";
import { PeriodFilter, ReportActions } from "@/components/reports/ReportControls";
import { isoDay, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Título del reporte, acciones (descargar / imprimir) y la fila de periodos. */
export function ReportHeader({
  title,
  period,
  csvHref,
  csvLabel,
  children,
}: {
  title: string;
  period: Period;
  csvHref?: string;
  csvLabel?: string;
  children?: React.ReactNode;
}) {
  const last = new Date(period.end.getTime() - 86_400_000);
  return (
    <div className="mb-6 space-y-4">
      <PageHeader title={title} description={period.label}>
        {children}
        <ReportActions csvHref={csvHref} csvLabel={csvLabel} />
      </PageHeader>
      <PeriodFilter current={period.key} desde={isoDay(period.start)} hasta={isoDay(last)} />
    </div>
  );
}

/** Indicador con variación contra el periodo anterior. upIsGood define el color de la flecha. */
export function StatTile({
  label,
  value,
  delta,
  vs,
  hint,
  upIsGood = true,
  hero = false,
}: {
  label: string;
  value: string;
  delta?: number | null;
  vs?: string;
  hint?: string;
  upIsGood?: boolean;
  hero?: boolean;
}) {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const flat = hasDelta && Math.abs(delta!) < 0.005;
  const good = hasDelta && !flat && (delta! > 0) === upIsGood;
  const Icon = !hasDelta || flat ? Minus : delta! > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "rounded-2xl p-4 sm:p-5 min-w-0 break-inside-avoid",
        hero ? "bg-gradient-to-br from-primary to-orange-700 text-primary-foreground shadow-lg shadow-primary/20" : "border bg-card"
      )}
    >
      <p className={cn("text-sm truncate", hero ? "text-white/80" : "text-muted-foreground")}>{label}</p>
      <p className="text-2xl sm:text-3xl font-semibold mt-1.5 truncate">{value}</p>
      {hasDelta ? (
        <p
          className={cn(
            "mt-1 text-xs inline-flex items-center gap-1 font-medium",
            hero ? "text-white/90" : flat ? "text-muted-foreground" : good ? "text-success" : "text-red-300"
          )}
          title={vs ? `Comparado con ${vs}` : undefined}
        >
          <Icon className="size-3.5" />
          {flat ? "Igual" : `${delta! > 0 ? "+" : ""}${Math.round(delta! * 1000) / 10}%`}
          {vs && <span className={hero ? "text-white/70 font-normal" : "text-muted-foreground font-normal"}>vs {vs}</span>}
        </p>
      ) : (
        hint && <p className={cn("mt-1 text-xs truncate", hero ? "text-white/80" : "text-muted-foreground")}>{hint}</p>
      )}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 sm:p-5 break-inside-avoid min-w-0", className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
