"use server";

// Registro público: un restaurante nuevo se da de alta solo con su prueba gratis.
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { rootPrisma } from "@/lib/prisma-base";
import { restaurantUrl } from "@/lib/platform";
import { isPlatformHost, normalizeSlug } from "@/lib/tenant-host";
import { addDays, getPlatformSettings, startOfDay } from "@/lib/billing";
import { hashPassword, normalizeEmail, passwordProblem } from "@/lib/password";
import { blockedMinutes, registerFailure } from "@/lib/rate-limit";

const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const SIGNUP_LIMIT = { max: 3, windowMs: 60 * 60_000, blockMs: 60 * 60_000 }; // 3 registros por hora y por IP
const TICKET_MINUTES = 10;

async function guard() {
  const h = await headers();
  if (!isPlatformHost(h.get("host"))) return { error: "No disponible en esta dirección" };
  const settings = await getPlatformSettings();
  if (!settings.signupEnabled) return { error: "El registro no está disponible por ahora" };
  return { settings, ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local" };
}

/** ¿Está libre este subdominio? (para avisar mientras se escribe) */
export async function checkSlug(value: string): Promise<{ slug: string | null; available: boolean }> {
  const g = await guard();
  if ("error" in g) return { slug: null, available: false };
  const slug = normalizeSlug(value);
  if (!slug) return { slug: null, available: false };
  return { slug, available: !(await rootPrisma.restaurant.findUnique({ where: { slug }, select: { id: true } })) };
}

export interface SignupInput {
  restaurant: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  website: string; // campo trampa: las personas no lo ven, los bots lo llenan
}

export async function registerRestaurant(input: SignupInput): Promise<{ error?: string; redirectTo?: string }> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const key = `signup:${g.ip}`;
  const wait = blockedMinutes(key);
  if (wait) return { error: `Ya se registraron varios restaurantes desde esta conexión. Intenta en ${wait} min.` };
  if (input.website) return { error: "No se pudo completar el registro" };

  const restaurant = clean(input.restaurant, 80);
  const slug = normalizeSlug(input.slug || input.restaurant);
  const name = clean(input.name);
  const email = normalizeEmail(input.email);
  const phone = clean(input.phone, 40);
  if (restaurant.length < 2) return { error: "Escribe el nombre de tu restaurante" };
  if (!slug) return { error: "Elige una dirección con al menos 2 letras o números" };
  if (name.length < 2) return { error: "Escribe tu nombre" };
  if (!email) return { error: "Escribe un correo válido" };
  if (phone.replace(/\D/g, "").length < 8) return { error: "Escribe un teléfono o WhatsApp para contactarte" };
  const problem = passwordProblem(input.password, email);
  if (problem) return { error: problem };
  const base = restaurantUrl(slug);
  if (!base) return { error: "El registro no está disponible por ahora" };
  if (await rootPrisma.restaurant.findUnique({ where: { slug } })) return { error: `La dirección "${slug}" ya está en uso. Prueba otra.` };

  const { settings } = g;
  const token = randomBytes(32).toString("base64url");
  const passwordHash = await hashPassword(input.password);
  try {
    await rootPrisma.$transaction(async (tx) => {
      const r = await tx.restaurant.create({
        data: {
          name: restaurant,
          slug,
          phone,
          source: "REGISTRO",
          planId: settings.signupPlanId,
          paidUntil: addDays(startOfDay(new Date()), Math.max(0, settings.trialDays - 1)),
          notes: `Se registró solo. Contacto: ${name}, ${phone}, ${email}.`,
        },
      });
      const account = await tx.account.create({
        data: { restaurantId: r.id, name, email, passwordHash, role: "OWNER", lastLoginAt: new Date() },
      });
      await tx.loginTicket.create({
        data: {
          id: createHash("sha256").update(token).digest("hex"),
          restaurantId: r.id,
          accountId: account.id,
          expiresAt: new Date(Date.now() + TICKET_MINUTES * 60_000),
        },
      });
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { error: `La dirección "${slug}" ya está en uso. Prueba otra.` };
    throw e;
  }
  registerFailure(key, SIGNUP_LIMIT); // cuenta registros por IP
  return { redirectTo: `${base}/entrar?t=${token}` };
}
