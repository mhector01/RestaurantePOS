"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Headset, Loader2, LogIn } from "lucide-react";
import { enterAsSupport } from "@/app/platform-actions";
import { callAction } from "@/lib/client-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Access {
  id: number;
  userName: string;
  reason: string;
  createdAt: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" });

/** Entrar al panel del restaurante como soporte, con el historial de accesos. */
export function SupportEntry({ restaurantId, active, accesses }: { restaurantId: number; active: boolean; accesses: Access[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // La pestaña se abre ya (en el clic), si no el navegador la bloquea por ser ventana emergente
    const tab = window.open("about:blank", "_blank");
    setLoading(true);
    const res = await callAction(() => enterAsSupport(restaurantId, reason));
    setLoading(false);
    if (!("url" in res) || !res.url) {
      tab?.close();
      return toast.error(("error" in res && res.error) || "No se pudo entrar");
    }
    if (tab) tab.location.href = res.url;
    else window.location.href = res.url;
    setOpen(false);
    setReason("");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Headset className="size-4 text-primary" /> Soporte
          </h2>
          <p className="text-sm text-muted-foreground">
            Entra a su panel con permisos de dueño para ayudarle, sin pedirle su contraseña. La sesión dura 2 horas y el dueño ve
            cada acceso.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-10 rounded-xl" disabled={!active}>
              <LogIn /> Entrar como soporte
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>Entrar como soporte</DialogTitle>
              <DialogDescription>
                Se abre su panel en otra pestaña. El motivo queda registrado y el dueño lo ve en Ajustes → Acceso al panel.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium">Motivo</span>
                <Input
                  required
                  autoFocus
                  minLength={3}
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Ayudar a configurar el menú"
                  className="h-11 rounded-xl"
                />
              </label>
              <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />} Entrar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {!active && <p className="text-sm text-amber-200">El restaurante está suspendido: reactívalo para poder entrar.</p>}
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
