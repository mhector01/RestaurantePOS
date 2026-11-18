import { Mail, Phone } from "lucide-react";
import { BrandLogo, SYSTEM } from "@/components/Brand";

interface Support {
  instructions: string;
  phone: string;
  email: string;
}

const TEXT = {
  missing: {
    title: "Restaurante no encontrado",
    text: "Esta dirección no corresponde a ningún restaurante. Revisa que esté bien escrita.",
  },
  suspended: {
    title: "Cuenta suspendida",
    text: `El acceso a este restaurante está pausado. Comunícate con ${SYSTEM.vendor} para reactivarlo.`,
  },
  expired: {
    title: "Suscripción vencida",
    text: "El periodo pagado y los días de gracia terminaron. Tus datos están guardados: en cuanto se registre el pago, el sistema vuelve a funcionar.",
  },
};

/** Pantalla para una dirección sin restaurante, un restaurante suspendido o con la suscripción vencida. */
export function TenantNotice({ kind, support }: { kind: keyof typeof TEXT; support?: Support }) {
  const { title, text } = TEXT[kind];
  const showSupport = kind !== "missing" && support && (support.instructions || support.phone || support.email);
  return (
    <main className="min-h-dvh bg-ink-950 grid place-items-center p-4">
      <div className="bg-card border w-full max-w-md rounded-3xl p-8 shadow-2xl shadow-black/40 text-center">
        <BrandLogo className="h-16 mx-auto mb-6" priority />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2">{text}</p>
        {showSupport && (
          <div className="mt-6 text-left rounded-2xl border bg-muted/30 p-4 space-y-3 text-sm">
            {kind === "expired" && support.instructions && (
              <div>
                <p className="font-medium mb-1">Cómo pagar</p>
                <p className="text-muted-foreground whitespace-pre-line">{support.instructions}</p>
              </div>
            )}
            {support.phone && (
              <a href={`https://wa.me/${support.phone.replace(/\D/g, "")}`} className="flex items-center gap-2 text-primary font-medium">
                <Phone className="size-4" /> {support.phone}
              </a>
            )}
            {support.email && (
              <a href={`mailto:${support.email}`} className="flex items-center gap-2 text-primary font-medium">
                <Mail className="size-4" /> {support.email}
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
