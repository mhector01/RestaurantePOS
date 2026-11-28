import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getBusiness, getRestaurant } from "@/lib/tenant";
import { BusinessProvider } from "@/components/BusinessProvider";
import { TenantNotice } from "@/components/TenantNotice";
import { billingOf, getPlatformSettings } from "@/lib/billing";
import { rootPrisma } from "@/lib/prisma-base";
import { canPayByCard, cardQuotes } from "@/lib/card-checkout";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [restaurant, business] = await Promise.all([getRestaurant(), getBusiness()]);
  return {
    title: restaurant ? `${business.name} · Ristemo` : "Ristemo",
    description: "Ristemo — Sistema para restaurantes by IMZA",
    applicationName: "Ristemo",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#021026",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [restaurant, business, settings] = await Promise.all([getRestaurant(), getBusiness(), getPlatformSettings()]);
  // Dirección sin restaurante, restaurante suspendido o con la suscripción vencida: no se muestra nada de la app.
  const blocked = !restaurant
    ? "missing"
    : restaurant.status !== "ACTIVE"
      ? "suspended"
      : billingOf(restaurant.paidUntil, settings.graceDays).state === "EXPIRED"
        ? "expired"
        : null;
  // Vencida: el dueño puede pagar con tarjeta desde la misma pantalla de bloqueo (no se desbloquea nada más).
  const plan = blocked === "expired" && restaurant?.planId ? await rootPrisma.plan.findUnique({ where: { id: restaurant.planId } }) : null;
  const cardPayment =
    restaurant && plan && canPayByCard({ status: restaurant.status, plan }) ? { planName: plan.name, quotes: cardQuotes(plan.price) } : null;
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {blocked ? (
          <TenantNotice
            kind={blocked}
            support={{
              instructions: settings.paymentInstructions,
              phone: settings.supportPhone,
              email: settings.supportEmail,
            }}
            cardPayment={cardPayment}
          />
        ) : (
          <BusinessProvider value={business}>{children}</BusinessProvider>
        )}
        <Toaster position="top-center" richColors closeButton duration={2500} />
      </body>
    </html>
  );
}
