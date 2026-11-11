import Image from "next/image";
import { cn } from "@/lib/utils";

// Identidad del sistema (no confundir con BUSINESS, que es el restaurante que lo usa).
export const SYSTEM = {
  name: "Ristemo",
  tagline: "Sistema para restaurantes",
  vendor: "IMZA",
};

/** Isotipo (R con gorro de chef) para fondos oscuros. */
export function BrandMark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/ristemo-mark-dark.png"
      alt={SYSTEM.name}
      width={400}
      height={566}
      priority={priority}
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}

/** Logotipo horizontal completo (Ristemo · Sistema para restaurantes · by IMZA) para fondos oscuros. */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/ristemo-logo-dark.png"
      alt={`${SYSTEM.name} — ${SYSTEM.tagline} by ${SYSTEM.vendor}`}
      width={1200}
      height={442}
      priority={priority}
      className={cn("h-12 w-auto object-contain", className)}
    />
  );
}

/** Encabezado compacto: isotipo + nombre del restaurante + subtítulo. */
export function BrandHeader({ business, subtitle }: { business: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <BrandMark className="h-10 shrink-0" priority />
      <div className="min-w-0">
        <p className="font-semibold leading-tight truncate">{business}</p>
        <p className="text-xs text-muted-foreground truncate">
          {subtitle} · <span className="text-primary font-medium">{SYSTEM.name}</span>
        </p>
      </div>
    </div>
  );
}
