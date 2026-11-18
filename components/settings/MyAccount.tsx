"use client";

import { callAction, PASSWORD_LOST } from "@/lib/client-action";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MonitorSmartphone } from "lucide-react";
import { changePassword, closeOtherSessions, updateProfile } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/components/settings/roles";

interface Me {
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

interface SessionRow {
  current: boolean;
  device: string;
  lastSeen: string;
}

export function MyAccount({ me, sessions }: { me: Me; sessions: SessionRow[] }) {
  const router = useRouter();
  const [profile, setProfile] = useState({ name: me.name, email: me.email });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState<"profile" | "password" | "sessions" | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("profile");
    const res = await callAction(() => updateProfile(profile));
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Datos actualizados");
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast.error("Las contraseñas nuevas no coinciden");
    setBusy("password");
    const res = await callAction(() => changePassword({ current: pw.current, next: pw.next }), PASSWORD_LOST);
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Contraseña cambiada. Se cerraron tus otras sesiones.");
    if (me.mustChangePassword) router.push("/admin");
    else router.refresh();
  };

  const closeOthers = async () => {
    setBusy("sessions");
    const res = await callAction(() => closeOtherSessions());
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Se cerraron las demás sesiones");
    router.refresh();
  };

  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-5 max-w-3xl">
      {me.mustChangePassword && (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100 flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          Entraste con una contraseña temporal. Pon una propia para seguir usando el panel.
        </p>
      )}

      {!me.mustChangePassword && (
        <form method="post" onSubmit={saveProfile} className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Tus datos</h2>
            <span className="text-xs font-medium rounded-full bg-accent text-accent-foreground px-2.5 py-1">
              {ROLE_LABEL[me.role] ?? me.role}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="me-name">Nombre</Label>
              <Input id="me-name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-email">Correo (con este entras)</Label>
              <Input id="me-email" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} className="h-12 rounded-xl" />
            </div>
          </div>
          <Button type="submit" className="h-11 rounded-xl" disabled={busy !== null}>
            {busy === "profile" && <Loader2 className="animate-spin" />} Guardar datos
          </Button>
        </form>
      )}

      <form method="post" onSubmit={savePassword} className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">{me.mustChangePassword ? "Pon tu contraseña" : "Cambiar contraseña"}</h2>
          <p className="text-sm text-muted-foreground">Mínimo 8 caracteres. Al cambiarla se cierran tus sesiones en otros aparatos.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">{me.mustChangePassword ? "Contraseña temporal" : "Contraseña actual"}</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-next">Nueva contraseña</Label>
            <Input id="pw-next" type="password" autoComplete="new-password" required minLength={8} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Repítela</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className="h-12 rounded-xl" />
          </div>
        </div>
        <Button type="submit" className="h-11 rounded-xl" disabled={busy !== null}>
          {busy === "password" && <Loader2 className="animate-spin" />} {me.mustChangePassword ? "Guardar y entrar al panel" : "Cambiar contraseña"}
        </Button>
      </form>

      {!me.mustChangePassword && (
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Sesiones abiertas</h2>
              <p className="text-sm text-muted-foreground">Aparatos donde tu cuenta está abierta. Se cierran solas tras 7 días sin uso.</p>
            </div>
            {others > 0 && (
              <Button variant="outline" className="h-10 rounded-xl" onClick={closeOthers} disabled={busy !== null}>
                {busy === "sessions" && <Loader2 className="animate-spin" />} Cerrar las demás ({others})
              </Button>
            )}
          </div>
          <ul className="divide-y rounded-xl border">
            {sessions.map((s, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <MonitorSmartphone className="size-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.device}</p>
                  <p className="text-xs text-muted-foreground">
                    Último uso: {new Date(s.lastSeen).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {s.current && <span className="text-xs font-medium text-primary">Este aparato</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
