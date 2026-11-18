"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Power, UserPlus } from "lucide-react";
import { createPlatformUser, resetPlatformUser, setPlatformUserActive } from "@/app/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandoffDialog, type HandoffData } from "@/components/platform/Handoff";
import { cn } from "@/lib/utils";

interface Row {
  id: number;
  name: string;
  email: string;
  active: boolean;
  pending: boolean;
  lastLogin: string | null;
}

function teamHandoff(name: string, email: string, password: string): HandoffData {
  const url = `${window.location.origin}/plataforma`;
  return {
    title: "Contraseña temporal lista",
    description: `Pásale estos datos a ${name}. No se vuelve a mostrar; al entrar pondrá una propia.`,
    rows: [
      { label: "Entrar en", value: url },
      { label: "Correo", value: email },
      { label: "Contraseña temporal", value: password, mono: true },
    ],
    message: `Hola ${name}, ya tienes acceso a la plataforma de Ristemo.\nEntra en: ${url}\nCorreo: ${email}\nContraseña temporal: ${password}\nAl entrar te pedirá poner una contraseña propia.`,
  };
}

export function TeamManager({ users, meId }: { users: Row[]; meId: number }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "" });
  const [handoff, setHandoff] = useState<HandoffData | null>(null);
  const [pending, start] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await createPlatformUser(form);
      if (!res.success || !res.password) return void toast.error(res.error ?? "No se pudo");
      setHandoff(teamHandoff(form.name.trim(), form.email.trim().toLowerCase(), res.password));
      setForm({ name: "", email: "" });
      router.refresh();
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
        {users.map((u) => (
          <li key={u.id} className={cn("flex items-center gap-3 pl-5 pr-2 py-3", !u.active && "opacity-60")}>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {u.name} {u.id === meId && <span className="text-xs text-muted-foreground font-normal">(tú)</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              <p className="text-xs text-muted-foreground">
                {!u.active
                  ? "Desactivado"
                  : u.pending
                    ? "Con contraseña temporal"
                    : u.lastLogin
                      ? `Último ingreso: ${new Date(u.lastLogin).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })}`
                      : "Nunca ha entrado"}
              </p>
            </div>
            {u.id !== meId && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl"
                  title="Contraseña temporal nueva"
                  aria-label={`Contraseña temporal nueva para ${u.name}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await resetPlatformUser(u.id);
                      if (!res.success || !res.password) return void toast.error(res.error ?? "No se pudo");
                      setHandoff(teamHandoff(u.name, u.email, res.password));
                      router.refresh();
                    })
                  }
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl"
                  title={u.active ? "Desactivar" : "Activar"}
                  aria-label={u.active ? `Desactivar a ${u.name}` : `Activar a ${u.name}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await setPlatformUserActive(u.id, !u.active);
                      if (!res.success) return void toast.error(res.error);
                      toast.success(u.active ? "Usuario desactivado" : "Usuario activado");
                      router.refresh();
                    })
                  }
                >
                  <Power className="size-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Agregar al equipo</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input required placeholder="Nombre" aria-label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-11 rounded-xl" />
          <Input required type="email" placeholder="Correo" aria-label="Correo" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-xl" />
        </div>
        <Button type="submit" className="h-11 rounded-xl" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Dar acceso
        </Button>
      </form>

      <HandoffDialog data={handoff} onClose={() => setHandoff(null)} />
    </div>
  );
}
