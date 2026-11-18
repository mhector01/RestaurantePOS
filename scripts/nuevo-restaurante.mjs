// Crea un restaurante nuevo con la cuenta de su dueño (mientras llega el panel de la plataforma).
//
//   node scripts/nuevo-restaurante.mjs <slug> "<Nombre del restaurante>" <correo-del-dueño>
//
// Queda en https://<slug>.<ROOT_DOMAIN> (o http://<slug>.localhost:3000 en tu compu).
// El dueño entra con la contraseña temporal que se imprime y pone la suya al primer ingreso.
import { connect, normalizeEmail, restaurantUrl, upsertOwner } from "./_comun.mjs";

const [rawSlug, rawName, rawEmail] = process.argv.slice(2);
const name = (rawName ?? "").replace(/\s+/g, " ").trim();
const email = normalizeEmail(rawEmail);
const slug = (rawSlug ?? "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

if (slug.length < 2 || ["www", "app", "admin", "api"].includes(slug) || !name || !email) {
  console.error('Uso: node scripts/nuevo-restaurante.mjs <slug> "<Nombre del restaurante>" <correo-del-dueño>');
  process.exit(1);
}

const client = await connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    `INSERT INTO "Restaurant" (slug, name, "updatedAt") VALUES ($1, $2, now()) RETURNING id`,
    [slug, name]
  );
  const password = await upsertOwner(client, rows[0].id, email, "Dueño");
  await client.query("COMMIT");
  console.log(`Restaurante #${rows[0].id} creado: ${name}`);
  console.log(`Entra en:            ${restaurantUrl(slug)}/login`);
  console.log(`Correo del dueño:    ${email}`);
  console.log(`Contraseña temporal: ${password}   (al entrar pondrá una propia)`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(e.code === "23505" ? `Ya existe un restaurante con el slug "${slug}".` : e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
