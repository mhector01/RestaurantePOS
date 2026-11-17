import { Suspense } from "react";
import { ReportTabs } from "@/components/reports/ReportTabs";

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <ReportTabs />
      </Suspense>
      {children}
    </>
  );
}
