// Crea un restaurante nuevo (mientras llega el panel de la plataforma).
//
//   node scripts/nuevo-restaurante.mjs <slug> "<Nombre del restaurante>"
//
// Queda en https://<slug>.<ROOT_DOMAIN> (o http://<slug>.localhost:3000 en tu compu).
// En tu compu lee el .env; en el contenedor las variables ya vienen del entorno.
await import("dotenv/config").catch(() => {});
import pg from "pg";

const [rawSlug, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
const slug = (rawSlug ?? "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

if (slug.length < 2 || ["www", "app", "admin", "api"].includes(slug) || !name) {
  console.error('Uso: node scripts/nuevo-restaurante.mjs <slug> "<Nombre del restaurante>"');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(
    `INSERT INTO "Restaurant" (slug, name, "updatedAt") VALUES ($1, $2, now()) RETURNING id`,
    [slug, name]
  );
  const root = process.env.ROOT_DOMAIN || "localhost:3000";
  console.log(`Restaurante #${rows[0].id} creado: ${name}`);
  console.log(`Entra en: http${root.startsWith("localhost") ? "" : "s"}://${slug}.${root}`);
} catch (e) {
  console.error(e.code === "23505" ? `Ya existe un restaurante con el slug "${slug}".` : e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
