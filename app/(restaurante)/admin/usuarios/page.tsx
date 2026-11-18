import { Trash2 } from "lucide-react";
import prisma from "@/lib/prisma";
import { deleteUser } from "@/app/actions";
import { UserModal } from "@/components/UserModal";
import { PageHeader } from "@/components/admin/AdminNav";
import { PinReveal } from "@/components/admin/PinReveal";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function UsuariosPage() {
  const usuarios = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { orders: true } } },
  });

  return (
    <>
      <PageHeader title="Personal" description="Quién puede tomar pedidos y cobrar.">
        <UserModal />
      </PageHeader>

      {usuarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Aún no hay personal registrado</p>
          <p className="text-sm text-muted-foreground mt-1">Agrega a tus meseros para que puedan entrar con su PIN.</p>
        </div>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center gap-4 pl-5 pr-2 py-3">
              <span className="size-11 rounded-full bg-accent text-accent-foreground grid place-items-center font-semibold shrink-0">
                {initials(u.name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u._count.orders} cuenta{u._count.orders === 1 ? "" : "s"} atendida{u._count.orders === 1 ? "" : "s"}
                </p>
              </div>
              <PinReveal pin={u.pin} />
              <div className="flex">
                <UserModal user={{ id: u.id, name: u.name, pin: u.pin }} />
                <ConfirmAction
                  title={`¿Eliminar a ${u.name}?`}
                  description="Ya no podrá entrar con su PIN. Si tiene ventas registradas no se podrá eliminar."
                  confirmLabel="Eliminar"
                  successMessage="Persona eliminada"
                  action={async () => {
                    "use server";
                    return deleteUser(u.id);
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-xl text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar ${u.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
