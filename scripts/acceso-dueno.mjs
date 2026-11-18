// Recupera el acceso de un dueño que olvidó su contraseña (o agrega otro dueño).
//
//   node scripts/acceso-dueno.mjs <slug> <correo>
//
// Si la cuenta existe, le asigna una contraseña temporal nueva y cierra sus sesiones;
// si no existe, la crea como dueño. Usa "principal" para el restaurante sin subdominio.
import { connect, normalizeEmail, restaurantUrl, upsertOwner } from "./_comun.mjs";

const [slug, rawEmail] = process.argv.slice(2);
const email = normalizeEmail(rawEmail);
if (!slug || !email) {
  console.error("Uso: node scripts/acceso-dueno.mjs <slug> <correo>");
  process.exit(1);
}

const client = await connect();
try {
  const { rows } = await client.query(`SELECT id, name FROM "Restaurant" WHERE slug = $1`, [slug]);
  if (!rows[0]) throw new Error(`No existe un restaurante con el slug "${slug}".`);
  const password = await upsertOwner(client, rows[0].id, email, "Dueño");
  console.log(`Acceso de dueño listo en ${rows[0].name || slug}`);
  console.log(`Entra en:            ${restaurantUrl(slug)}/login   (o tu dominio principal si es el restaurante por defecto)`);
  console.log(`Correo:              ${email}`);
  console.log(`Contraseña temporal: ${password}   (al entrar pondrá una propia)`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
