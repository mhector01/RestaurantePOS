import { Headset, LogOut } from "lucide-react";
import { exitSupport } from "@/app/auth-actions";

/** Aviso fijo mientras alguien de la plataforma está en el panel como soporte. */
export function SupportBanner({ name }: { name: string }) {
  return (
    <div className="mb-5 rounded-2xl border border-sky-400/40 bg-sky-400/10 p-4 text-sm text-sky-100 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
      <Headset className="size-5 shrink-0" />
      <p className="flex-1">
        <b>Modo soporte.</b> Estás en el panel de este restaurante como {name}, con permisos de dueño. La sesión se cierra sola en 2
        horas.
      </p>
      <form action={exitSupport}>
        <button type="submit" className="inline-flex items-center gap-2 font-semibold underline underline-offset-4">
          <LogOut className="size-4" /> Salir del modo soporte
        </button>
      </form>
    </div>
  );
}
