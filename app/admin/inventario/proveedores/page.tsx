import Link from "next/link";
import { Archive, Mail, MessageCircle, Phone, ShoppingCart, UserRound } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatMoney } from "@/lib/config";
import { SectionBar } from "@/components/inventory/InventoryTabs";
import { SupplierDialog } from "@/components/inventory/SupplierDialog";
import { RestoreSupplierButton } from "@/components/inventory/RestoreSupplierButton";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { Button } from "@/components/ui/button";
import { deleteSupplier } from "@/app/inventory-actions";

export const dynamic = "force-dynamic";

/** Número para wa.me: solo dígitos; si tiene 8 dígitos se asume Honduras (504). */
function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length === 8 ? `504${d}` : d;
}

export default async function ProveedoresPage() {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const suppliers = await prisma.supplier.findMany({
    include: {
      _count: { select: { ingredients: { where: { active: true } } } },
      purchases: { where: { status: "RECEIVED" }, select: { total: true, paid: true, date: true }, orderBy: { date: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  const active = suppliers.filter((s) => s.active);
  const archived = suppliers.filter((s) => !s.active);

  return (
    <>
      <SectionBar title="Proveedores" description="A quién le compras, cuánto le compras y cuánto le debes.">
        <SupplierDialog />
      </SectionBar>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Aún no tienes proveedores</p>
          <p className="text-sm text-muted-foreground mt-1">
            Agrégalos para registrar sus facturas, saber cuánto les debes y armarles la lista de pedido.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((s) => {
            const month = s.purchases.filter((p) => p.date >= since).reduce((a, p) => a + p.total, 0);
            const owed = s.purchases.filter((p) => !p.paid).reduce((a, p) => a + p.total, 0);
            const last = s.purchases[0]?.date;
            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="size-11 rounded-xl bg-primary/15 text-primary grid place-items-center font-bold shrink-0">
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s._count.ingredients} insumo{s._count.ingredients === 1 ? "" : "s"}
                      {s.taxId && ` · RTN ${s.taxId}`}
                      {last && ` · última compra ${last.toLocaleDateString("es", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  <SupplierDialog
                    supplier={{
                      id: s.id,
                      name: s.name,
                      contact: s.contact ?? "",
                      phone: s.phone ?? "",
                      email: s.email ?? "",
                      taxId: s.taxId ?? "",
                      notes: s.notes ?? "",
                    }}
                  />
                  <ConfirmAction
                    title={`¿Quitar a "${s.name}"?`}
                    description={
                      s.purchases.length > 0
                        ? "Tiene compras registradas, así que se archiva y su historial se conserva."
                        : "Se eliminará de la lista de proveedores."
                    }
                    confirmLabel="Quitar"
                    successMessage="Proveedor quitado"
                    action={deleteSupplier.bind(null, s.id)}
                  >
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl text-muted-foreground hover:text-destructive" aria-label={`Quitar ${s.name}`}>
                      <Archive className="size-4" />
                    </Button>
                  </ConfirmAction>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {s.contact && (
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="size-3.5" /> {s.contact}
                    </span>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                      <Phone className="size-3.5" /> {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground truncate">
                      <Mail className="size-3.5" /> {s.email}
                    </a>
                  )}
                </div>
                {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}

                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Comprado este mes</p>
                    <p className="font-semibold tabular">{formatMoney(month)}</p>
                  </div>
                  <div className={owed > 0 ? "rounded-xl bg-amber-400/10 px-3 py-2" : "rounded-xl bg-muted/50 px-3 py-2"}>
                    <p className="text-[11px] text-muted-foreground">Le debes</p>
                    <p className={owed > 0 ? "font-semibold tabular text-amber-300" : "font-semibold tabular"}>{formatMoney(owed)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="h-10 rounded-xl">
                    <Link href={`/admin/inventario/compras/nueva?proveedor=${s.id}`}>
                      <ShoppingCart className="size-4" /> Registrar compra
                    </Link>
                  </Button>
                  {s.phone && (
                    <Button asChild variant="outline" size="sm" className="h-10 rounded-xl">
                      <a href={`https://wa.me/${waNumber(s.phone)}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" /> WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Archivados</h3>
          <ul className="rounded-2xl border bg-card divide-y">
            {archived.map((s) => (
              <li key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="flex-1 truncate text-muted-foreground">{s.name}</span>
                <RestoreSupplierButton id={s.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
