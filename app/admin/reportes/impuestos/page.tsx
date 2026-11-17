import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { formatMoney } from "@/lib/config";
import { formatRtn } from "@/lib/fiscal";
import { resolvePeriod } from "@/lib/period";
import { taxSummary } from "@/lib/reports";
import { Panel, ReportHeader, StatTile } from "@/components/reports/Blocks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 py-1.5", strong && "font-semibold border-t pt-2", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular">{formatMoney(value)}</span>
    </div>
  );
}

export default async function ImpuestosReportPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  // La declaración del ISV es mensual: por defecto se muestra el mes anterior
  const period = resolvePeriod(await searchParams, "mesant");
  const t = await taxSummary(period);


  return (
    <>
      <ReportHeader title="Impuestos (SAR)" period={period} csvHref={`/admin/reportes/csv?tipo=impuestos&${period.query}`} csvLabel="Resumen (CSV)">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <a href={`/admin/reportes/csv?tipo=libro-ventas&${period.query}`}>
            <Download /> Libro de ventas
          </a>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <a href={`/admin/reportes/csv?tipo=libro-compras&${period.query}`}>
            <Download /> Libro de compras
          </a>
        </Button>
      </ReportHeader>

      {!t.enabled && (
        <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-amber-100 p-4 text-sm flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            La facturación con CAI está apagada, así que no hay débito fiscal registrado. Actívala en{" "}
            <Link href="/admin/facturacion/datos" className="underline font-medium">
              Facturación → Datos fiscales
            </Link>
            .
          </span>
        </p>
      )}
      {t.unbilledCount > 0 && (
        <p className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-200 p-4 text-sm flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          Hay {t.unbilledCount} cobro{t.unbilledCount === 1 ? "" : "s"} sin factura en el periodo por {formatMoney(t.unbilledTotal)}. Las
          ventas también causan ISV aunque no se haya emitido factura; revísalo con tu contador.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile hero label={t.payable >= 0 ? "ISV a pagar" : "Saldo a favor"} value={formatMoney(Math.abs(t.payable))} hint="Débito fiscal − crédito fiscal" />
        <StatTile label="Débito fiscal (ventas)" value={formatMoney(t.debit)} hint={`${t.count} facturas emitidas`} />
        <StatTile label="Crédito fiscal (compras)" value={formatMoney(t.credit)} hint={`${t.purchasesCount} facturas de compra`} />
        <StatTile label="Ventas facturadas" value={formatMoney(t.total)} hint={t.voided ? `${t.voided} anulada${t.voided === 1 ? "" : "s"}` : "Sin anuladas"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Ventas (débito fiscal)" description="Según las facturas con CAI emitidas en el periodo.">
          <div className="text-sm">
            <Row label="Ventas exentas" value={t.exempt} />
            <Row label="Ventas exoneradas" value={t.exonerated} />
            <Row label="Ventas gravadas 15%" value={t.taxable15} />
            <Row label="Ventas gravadas 18%" value={t.taxable18} />
            <Row label="ISV 15%" value={t.isv15} muted />
            <Row label="ISV 18%" value={t.isv18} muted />
            <Row label="Total débito fiscal" value={t.debit} strong />
            <Row label="Total facturado" value={t.total} strong />
          </div>
          {t.first && (
            <p className="text-xs text-muted-foreground mt-3 font-mono">
              Del {t.first} al {t.last}
            </p>
          )}
        </Panel>

        <Panel title="Compras (crédito fiscal)" description="ISV pagado en las facturas de proveedores registradas en Inventario.">
          <div className="text-sm">
            <Row label="Total de compras" value={t.purchasesTotal} />
            <Row label="ISV pagado en compras" value={t.credit} strong />
          </div>
          {t.purchasesWithoutTax > 0 && (
            <p className="text-xs text-amber-300 mt-2">
              {t.purchasesWithoutTax} compra{t.purchasesWithoutTax === 1 ? "" : "s"} sin ISV registrado. Si su factura traía ISV, edítala para no
              perder el crédito fiscal.
            </p>
          )}
          {t.suppliers.length > 0 && (
            <table className="w-full text-sm mt-4">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left font-medium py-1.5">Proveedor</th>
                  <th className="text-right font-medium">Compras</th>
                  <th className="text-right font-medium">ISV</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular">
                {t.suppliers.map((s) => (
                  <tr key={s.name}>
                    <td className="py-1.5 font-sans">
                      {s.name}
                      {s.rtn && <span className="block text-xs text-muted-foreground">RTN {formatRtn(s.rtn)}</span>}
                    </td>
                    <td className="text-right">{formatMoney(s.total)}</td>
                    <td className="text-right">{formatMoney(s.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Liquidación del ISV" className="mt-4">
        <div className="text-sm max-w-md">
          <Row label="Débito fiscal (ISV cobrado en ventas)" value={t.debit} />
          <Row label="− Crédito fiscal (ISV pagado en compras)" value={-t.credit} muted />
          <Row label={t.payable >= 0 ? "ISV a pagar" : "Saldo a favor para el siguiente periodo"} value={Math.abs(t.payable)} strong />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Es un apoyo para preparar la declaración mensual del ISV; la presentación la valida tu contador. Solo cuentan como crédito
          fiscal las compras con factura a nombre de tu RTN y relacionadas con el negocio.
        </p>
      </Panel>
    </>
  );
}
