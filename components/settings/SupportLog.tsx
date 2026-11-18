"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Headset, Loader2 } from "lucide-react";
import { closeSupportSessions } from "@/app/auth-actions";
import { callAction } from "@/lib/client-action";
import { Button } from "@/components/ui/button";

interface Access {
  id: number;
  userName: string;
  reason: string;
  createdAt: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" });

/** Transparencia para el dueño: cuándo entró el soporte de la plataforma y para qué. */
export function SupportLog({ accesses, openSessions, canClose }: { accesses: Access[]; openSessions: number; canClose: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (accesses.length === 0 && openSessions === 0) return null;
  return (
    <section className="max-w-3xl mt-6 rounded-2xl border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Headset className="size-4 text-primary" /> Accesos de soporte
          </h2>
          <p className="text-sm text-muted-foreground">
            Veces que el equipo de Ristemo entró a tu panel para ayudarte. Cada acceso dura como máximo 2 horas.
          </p>
        </div>
        {canClose && openSessions > 0 && (
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await callAction(() => closeSupportSessions());
                if (!res.success) return void toast.error(res.error);
                toast.success("Se cerró el acceso de soporte");
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} Cerrar acceso abierto ({openSessions})
          </Button>
        )}
      </div>
      {accesses.length > 0 && (
        <ul className="divide-y rounded-xl border text-sm">
          {accesses.map((a) => (
            <li key={a.id} className="px-4 py-2.5">
              <p className="font-medium">{a.reason || "Sin motivo"}</p>
              <p className="text-xs text-muted-foreground">
                {a.userName} · {when(a.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
