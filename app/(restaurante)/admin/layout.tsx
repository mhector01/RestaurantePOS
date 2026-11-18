import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminNav";
import { getBusiness } from "@/lib/tenant";
import { requireAdmin } from "@/lib/session";
import { lowStockCount } from "@/lib/stock";
import { fiscalStatus } from "@/lib/invoicing";
import { getSubscription } from "@/lib/subscription";
import { SubscriptionBanner } from "@/components/settings/SubscriptionBanner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [me, stockAlerts, fiscal, business, sub] = await Promise.all([
    requireAdmin(undefined, { allowTemporary: true }),
    lowStockCount(),
    fiscalStatus(),
    getBusiness(),
    getSubscription(),
  ]);
  const account = { name: me.name, role: me.role };
  const fiscalAlerts = fiscal.alerts.length;
  return (
    <div className="min-h-dvh flex">
      <AdminSidebar business={business.name} account={account} stockAlerts={stockAlerts} fiscalAlerts={fiscalAlerts} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminMobileNav business={business.name} account={account} stockAlerts={stockAlerts} fiscalAlerts={fiscalAlerts} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">
          <SubscriptionBanner billing={sub.billing} trial={sub.trial} />
          {children}
        </main>
      </div>
    </div>
  );
}
