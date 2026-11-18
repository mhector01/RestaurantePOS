"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { changePlatformPassword } from "@/app/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlatformPasswordForm({ temporary }: { temporary: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast.error("Las contraseñas nuevas no coinciden");
    setBusy(true);
    const res = await changePlatformPassword({ current: pw.current, next: pw.next });
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Contraseña cambiada");
    if (temporary) router.push("/plataforma");
    else router.refresh();
  };

  const field = (id: keyof typeof pw, label: string, auto: string) => (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <Input
        type="password"
        required
        autoComplete={auto}
        minLength={id === "current" ? undefined : 8}
        value={pw[id]}
        onChange={(e) => setPw((p) => ({ ...p, [id]: e.target.value }))}
        className="h-12 rounded-xl"
      />
    </label>
  );

  return (
    <div className="max-w-3xl space-y-5">
      {temporary && (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100 flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" /> Entraste con una contraseña temporal. Pon una propia para continuar.
        </p>
      )}
      <form method="post" onSubmit={submit} className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">{temporary ? "Pon tu contraseña" : "Cambiar contraseña"}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("current", temporary ? "Contraseña temporal" : "Contraseña actual", "current-password")}
          {field("next", "Nueva contraseña", "new-password")}
          {field("confirm", "Repítela", "new-password")}
        </div>
        <Button type="submit" className="h-11 rounded-xl" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {temporary ? "Guardar y continuar" : "Cambiar contraseña"}
        </Button>
      </form>
    </div>
  );
}
