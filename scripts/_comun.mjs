// Utilidades compartidas por los scripts de la plataforma (mismo formato que lib/password.ts).
import { randomBytes, randomInt, scrypt as scryptCb } from "node:crypto";
import pg from "pg";

// En tu compu lee el .env; en el contenedor las variables ya vienen del entorno.
await import("dotenv/config").catch(() => {});

export async function connect() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

export function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`)
    )
  );
}

export function temporaryPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[randomInt(chars.length)];
  return out;
}

export function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function restaurantUrl(slug) {
  const root = process.env.ROOT_DOMAIN || "localhost:3000";
  return `http${root.startsWith("localhost") ? "" : "s"}://${slug}.${root}`;
}

/**
 * Crea la cuenta de dueño con contraseña temporal, o le asigna una nueva si ya existe
 * (y cierra sus sesiones). Devuelve la contraseña temporal.
 */
export async function upsertOwner(client, restaurantId, email, name) {
  const password = temporaryPassword();
  const hash = await hashPassword(password);
  const { rows } = await client.query(
    `INSERT INTO "Account" ("restaurantId", name, email, "passwordHash", role, "mustChangePassword", "updatedAt")
     VALUES ($1, $2, $3, $4, 'OWNER', true, now())
     ON CONFLICT ("restaurantId", email) DO UPDATE
       SET "passwordHash" = EXCLUDED."passwordHash", "mustChangePassword" = true, active = true, role = 'OWNER', "updatedAt" = now()
     RETURNING id`,
    [restaurantId, name, email, hash]
  );
  await client.query(`DELETE FROM "Session" WHERE "accountId" = $1`, [rows[0].id]);
  return password;
}
