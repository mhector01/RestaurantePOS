import { BrandLogo, SYSTEM } from "@/components/Brand";

/** Pantalla para una dirección sin restaurante o un restaurante suspendido. */
export function TenantNotice({ kind }: { kind: "missing" | "suspended" }) {
  const title = kind === "missing" ? "Restaurante no encontrado" : "Cuenta suspendida";
  const text =
    kind === "missing"
      ? "Esta dirección no corresponde a ningún restaurante. Revisa que esté bien escrita."
      : `El acceso a este restaurante está pausado. Comunícate con ${SYSTEM.vendor} para reactivarlo.`;
  return (
    <main className="min-h-dvh bg-ink-950 grid place-items-center p-4">
      <div className="bg-card border w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/40 text-center">
        <BrandLogo className="h-16 mx-auto mb-6" priority />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2">{text}</p>
      </div>
    </main>
  );
}
