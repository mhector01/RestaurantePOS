import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getBusiness, getRestaurant } from "@/lib/tenant";
import { BusinessProvider } from "@/components/BusinessProvider";
import { TenantNotice } from "@/components/TenantNotice";
import "./globals.css";

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
  const [restaurant, business] = await Promise.all([getRestaurant(), getBusiness()]);
  // Dirección sin restaurante, o restaurante suspendido: no se muestra nada de la app.
  const blocked = !restaurant ? "missing" : restaurant.status !== "ACTIVE" ? "suspended" : null;
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {blocked ? (
          <TenantNotice kind={blocked} />
        ) : (
          <BusinessProvider value={business}>{children}</BusinessProvider>
        )}
        <Toaster position="top-center" richColors closeButton duration={2500} />
      </body>
    </html>
  );
}
