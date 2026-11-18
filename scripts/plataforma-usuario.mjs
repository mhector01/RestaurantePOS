// Crea un usuario del equipo de la plataforma (o le asigna una contraseña temporal nueva si ya existe).
// Así se crea el primero; los demás se pueden dar de alta desde /plataforma/equipo.
//
//   node scripts/plataforma-usuario.mjs <correo> "<Nombre>"
import { connect, hashPassword, normalizeEmail, temporaryPassword } from "./_comun.mjs";

const [rawEmail, rawName] = process.argv.slice(2);
const email = normalizeEmail(rawEmail);
const name = (rawName ?? "").replace(/\s+/g, " ").trim() || "Equipo Ristemo";
if (!email) {
  console.error('Uso: node scripts/plataforma-usuario.mjs <correo> "<Nombre>"');
  process.exit(1);
}

const client = await connect();
try {
  const password = temporaryPassword();
  const { rows } = await client.query(
    `INSERT INTO "PlatformUser" (name, email, "passwordHash", "mustChangePassword", "updatedAt")
     VALUES ($1, $2, $3, true, now())
     ON CONFLICT (email) DO UPDATE
       SET "passwordHash" = EXCLUDED."passwordHash", "mustChangePassword" = true, active = true, "updatedAt" = now()
     RETURNING id, (xmax = 0) AS created`,
    [name, email, await hashPassword(password)]
  );
  await client.query(`DELETE FROM "PlatformSession" WHERE "userId" = $1`, [rows[0].id]);
  const root = process.env.PLATFORM_HOST || process.env.ROOT_DOMAIN || "localhost:3000";
  console.log(rows[0].created ? `Usuario de plataforma creado: ${email}` : `Contraseña temporal nueva para ${email}`);
  console.log(`Entra en:            http${root.startsWith("localhost") ? "" : "s"}://${root}/plataforma`);
  console.log(`Contraseña temporal: ${password}   (al entrar pondrá una propia)`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
