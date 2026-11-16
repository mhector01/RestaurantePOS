import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminNav";
import { FiscalTabs } from "@/components/fiscal/FiscalTabs";
import { fiscalStatus } from "@/lib/invoicing";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FacturacionLayout({ children }: { children: React.ReactNode }) {
  const status = await fiscalStatus();
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Facturación" description="Facturas con CAI según el Régimen de Facturación de la SAR." />
      </div>
      <FiscalTabs />
      {!status.enabled ? (
        <p className="mb-5 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground print:hidden">
          La facturación con CAI está <b>apagada</b>: los cobros imprimen un comprobante sin valor fiscal. Actívala en{" "}
          <b>Datos fiscales</b> después de registrar tu rango CAI.
        </p>
      ) : (
        status.alerts.map((a) => (
          <p
            key={a.message}
            className={cn(
              "mb-3 rounded-2xl border p-4 text-sm flex gap-2 print:hidden",
              a.level === "error" ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-amber-400/40 bg-amber-400/10 text-amber-100"
            )}
          >
            <AlertTriangle className="size-4 shrink-0 mt-0.5" /> {a.message}
          </p>
        ))
      )}
      {children}
    </>
  );
}
