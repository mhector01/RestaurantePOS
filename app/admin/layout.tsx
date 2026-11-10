import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminNav";
import { BUSINESS } from "@/lib/config";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      <AdminSidebar business={BUSINESS.name} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminMobileNav business={BUSINESS.name} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
