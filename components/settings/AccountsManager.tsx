"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, MoreVertical, Power, Trash2, UserPlus } from "lucide-react";
import { createAccount, deleteAccount, resetAccountPassword, updateAccount } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { ROLE_HELP, ROLE_LABEL } from "@/components/settings/roles";
import { cn } from "@/lib/utils";

interface Row {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  pending: boolean; // aún con contraseña temporal
  lastLogin: string | null;
}

/** Lo que el dueño le pasa a la persona: dónde entrar, con qué correo y su contraseña temporal. */
interface Handoff {
  name: string;
  email: string;
  password: string;
}

export function AccountsManager({ accounts, meId }: { accounts: Row[]; meId: number }) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Acceso al panel</h2>
          <p className="text-sm text-muted-foreground">
            Personas que entran a la administración con su correo. Los meseros entran con PIN desde{" "}
            <Link href="/admin/usuarios" className="text-primary font-medium">
              Personal
            </Link>
            .
          </p>
        </div>
        <NewAccountDialog onCreated={setHandoff} />
      </div>

      <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} isMe={a.id === meId} onReset={setHandoff} />
        ))}
      </ul>

      <HandoffDialog handoff={handoff} onClose={() => setHandoff(null)} />
    </div>
  );
}

function AccountRow({ account: a, isMe, onReset }: { account: Row; isMe: boolean; onReset: (h: Handoff) => void }) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.success) toast.error(res.error ?? "No se pudo completar");
      else toast.success(ok);
      setMenu(false);
    });

  return (
    <li className={cn("flex items-center gap-4 pl-5 pr-2 py-3", !a.active && "opacity-60")}>
      <span className="size-11 rounded-full bg-accent text-accent-foreground grid place-items-center font-semibold shrink-0">
        {a.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("")}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {a.name} {isMe && <span className="text-xs text-muted-foreground font-normal">(tú)</span>}
        </p>
        <p className="text-xs text-muted-foreground truncate">{a.email}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {!a.active
            ? "Desactivada"
            : a.pending
              ? "Aún no entra con su propia contraseña"
              : a.lastLogin
                ? `Último ingreso: ${new Date(a.lastLogin).toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" })}`
                : "Nunca ha entrado"}
        </p>
      </div>
      <span
        className={cn(
          "text-xs font-medium rounded-full px-2.5 py-1 shrink-0",
          a.role === "OWNER" ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground"
        )}
      >
        {ROLE_LABEL[a.role] ?? a.role}
      </span>

      {isMe ? (
        <span className="size-10" />
      ) : (
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-xl"
            aria-label={`Opciones de ${a.name}`}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <MoreVertical className="size-4" />}
          </Button>
          {menu && (
            <>
              <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-11 z-20 w-60 rounded-xl border bg-popover p-1 shadow-xl text-sm">
                <MenuItem
                  onClick={() =>
                    start(async () => {
                      const res = await resetAccountPassword(a.id);
                      setMenu(false);
                      if (!res.success || !res.password) return void toast.error(res.error ?? "No se pudo");
                      onReset({ name: a.name, email: a.email, password: res.password });
                    })
                  }
                >
                  <KeyRound className="size-4" /> Nueva contraseña temporal
                </MenuItem>
                {a.active && (
                  <MenuItem onClick={() => run(() => updateAccount(a.id, { role: a.role === "OWNER" ? "ADMIN" : "OWNER" }), "Rol actualizado")}>
                    <Check className="size-4" /> Cambiar a {a.role === "OWNER" ? "administrador" : "dueño"}
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => run(() => updateAccount(a.id, { active: !a.active }), a.active ? "Cuenta desactivada" : "Cuenta activada")}
                >
                  <Power className="size-4" /> {a.active ? "Desactivar (bloquear acceso)" : "Activar"}
                </MenuItem>
                <ConfirmAction
                  title={`¿Eliminar la cuenta de ${a.name}?`}
                  description="Ya no podrá entrar al panel. Esto no borra ventas ni nada de lo que haya registrado."
                  confirmLabel="Eliminar"
                  successMessage="Cuenta eliminada"
                  action={() => deleteAccount(a.id)}
                >
                  <MenuItem className="text-red-300 hover:bg-red-500/15">
                    <Trash2 className="size-4" /> Eliminar cuenta
                  </MenuItem>
                </ConfirmAction>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function MenuItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("w-full flex items-center gap-2.5 h-10 px-3 rounded-lg text-left hover:bg-accent", className)}
      {...props}
    />
  );
}

function NewAccountDialog({ onCreated }: { onCreated: (h: Handoff) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "ADMIN" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createAccount(form);
    setLoading(false);
    if (!res.success || !res.password) return toast.error(res.error ?? "No se pudo crear");
    setOpen(false);
    onCreated({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: res.password });
    setForm({ name: "", email: "", role: "ADMIN" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-xl">
          <UserPlus /> Dar acceso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Dar acceso al panel</DialogTitle>
          <DialogDescription>Se crea con una contraseña temporal; la persona pone la suya al entrar por primera vez.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="a-name">Nombre</Label>
            <Input id="a-name" required autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-email">Correo</Label>
            <Input id="a-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-12 rounded-xl" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-1.5">Rol</legend>
            {(["ADMIN", "OWNER"] as const).map((r) => (
              <label
                key={r}
                className={cn(
                  "flex gap-3 rounded-xl border p-3 cursor-pointer",
                  form.role === r ? "border-primary/50 bg-primary/10" : "hover:bg-accent/50"
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={form.role === r}
                  onChange={() => setForm((f) => ({ ...f, role: r }))}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium text-sm">{ROLE_LABEL[r]}</span>
                  <span className="block text-xs text-muted-foreground">{ROLE_HELP[r]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Crear acceso
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HandoffDialog({ handoff, onClose }: { handoff: Handoff | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/login`;
  const text = handoff
    ? `Hola ${handoff.name}, ya tienes acceso al panel.\nEntra en: ${url}\nCorreo: ${handoff.email}\nContraseña temporal: ${handoff.password}\nAl entrar te pedirá poner una contraseña propia.`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar; selecciona el texto a mano");
    }
  };

  return (
    <Dialog open={!!handoff} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Contraseña temporal lista</DialogTitle>
          <DialogDescription>
            Pásale estos datos a {handoff?.name}. Por seguridad la contraseña no se vuelve a mostrar.
          </DialogDescription>
        </DialogHeader>
        {handoff && (
          <div className="space-y-4">
            <dl className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Entrar en</dt>
                <dd className="font-medium truncate">{url}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Correo</dt>
                <dd className="font-medium truncate">{handoff.email}</dd>
              </div>
              <div className="flex justify-between gap-3 items-center">
                <dt className="text-muted-foreground">Contraseña temporal</dt>
                <dd className="font-mono text-lg font-semibold tracking-wider">{handoff.password}</dd>
              </div>
            </dl>
            <Button type="button" variant="outline" className="w-full h-11 rounded-xl" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar mensaje para enviar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
