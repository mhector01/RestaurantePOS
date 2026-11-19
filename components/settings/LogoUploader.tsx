"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { removeRestaurantLogo, setRestaurantLogo } from "@/app/auth-actions";
import { callAction } from "@/lib/client-action";
import { resizeLogo } from "@/lib/resize-image";
import { Button } from "@/components/ui/button";

/** Logo del restaurante para recibos y facturas, con vista previa de cómo sale impreso. */
export function LogoUploader({ logo, name }: { logo: string | null; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    try {
      const blob = await resizeLogo(file);
      const form = new FormData();
      form.append("file", blob, "logo");
      const res = await callAction(() => setRestaurantLogo(form));
      if (!res.success) return void toast.error(res.error ?? "No se pudo guardar el logo");
      toast.success("Logo guardado. Ya sale en los recibos y facturas.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la imagen");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    const res = await callAction(() => removeRestaurantLogo());
    setBusy(null);
    if (!res.success) return void toast.error(res.error ?? "No se pudo quitar");
    toast.success("Logo quitado");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4 max-w-3xl mb-5">
      <div>
        <h2 className="font-semibold">Logo para recibos y facturas</h2>
        <p className="text-sm text-muted-foreground">
          Sale arriba del ticket y de la factura. Las impresoras de tickets imprimen en blanco y negro: un logo sencillo, oscuro y sobre
          fondo blanco o transparente es el que mejor sale.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Vista previa: así se ve el encabezado del ticket impreso */}
        <div className="w-full sm:w-64 shrink-0 rounded-xl bg-white text-black font-mono text-[11px] leading-snug p-4 text-center shadow-inner">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo del restaurante" className="mx-auto mb-1.5 max-h-20 max-w-[70%] object-contain grayscale contrast-125" />
          ) : (
            <div className="mx-auto mb-1.5 h-14 w-28 rounded border border-dashed border-black/30 grid place-items-center text-[10px] text-black/50">
              Sin logo
            </div>
          )}
          <p className="text-sm font-bold uppercase">{name}</p>
          <p className="text-black/60">Así se ve en el ticket</p>
        </div>
        <div className="space-y-2">
          <label className="inline-flex">
            <span
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-medium cursor-pointer bg-primary text-primary-foreground hover:opacity-90 ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {logo ? "Cambiar logo" : "Subir logo"}
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Logo del restaurante" />
          </label>
          {logo && (
            <div>
              <Button type="button" variant="ghost" className="h-10 rounded-xl text-muted-foreground hover:text-destructive" disabled={!!busy} onClick={remove}>
                {busy === "remove" ? <Loader2 className="animate-spin" /> : <ImageOff />} Quitar logo
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">PNG o JPG. Se ajusta solo de tamaño; no se recorta.</p>
        </div>
      </div>
    </section>
  );
}
