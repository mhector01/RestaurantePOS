import { FiscalSettingsForm } from "@/components/fiscal/FiscalSettingsForm";
import { getFiscalSettings, usableRanges } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

export default async function DatosFiscalesPage() {
  const [s, ranges] = await Promise.all([getFiscalSettings(), usableRanges()]);
  return (
    <FiscalSettingsForm
      hasRange={ranges.some((r) => r.nextNumber <= r.rangeTo)}
      initial={{
        enabled: s.enabled,
        legalName: s.legalName,
        tradeName: s.tradeName,
        rtn: s.rtn,
        address: s.address,
        phone: s.phone,
        email: s.email,
        footer: s.footer,
      }}
    />
  );
}
