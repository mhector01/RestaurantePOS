import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminNav";
import { getBusiness } from "@/lib/tenant";
import { lowStockCount } from "@/lib/stock";
import { fiscalStatus } from "@/lib/invoicing";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [stockAlerts, fiscal, business] = await Promise.all([lowStockCount(), fiscalStatus(), getBusiness()]);
  const fiscalAlerts = fiscal.alerts.length;
  return (
    <div className="min-h-dvh flex">
      <AdminSidebar business={business.name} stockAlerts={stockAlerts} fiscalAlerts={fiscalAlerts} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminMobileNav business={business.name} stockAlerts={stockAlerts} fiscalAlerts={fiscalAlerts} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
