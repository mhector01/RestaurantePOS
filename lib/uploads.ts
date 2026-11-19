// Fotos de productos, una "carpeta" por restaurante: r<id>/<archivo>.
//
// Dónde se guardan:
//  - En un almacenamiento S3 (MinIO, Cloudflare R2, AWS…) si están S3_ENDPOINT, S3_BUCKET,
//    S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY. El bucket NO tiene que ser público: las fotos se
//    entregan por /media/<archivo>, y cada restaurante solo puede ver las suyas.
//  - Si no, en disco (UPLOAD_DIR). En producción esa carpeta debe ser un volumen persistente,
//    si no las fotos se pierden en cada despliegue. En desarrollo se usa ./uploads.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const MAX_IMAGE_BYTES = 800 * 1024; // el navegador ya las reduce a ~100–200 KB

const TYPES = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
} as const;
type Ext = keyof typeof TYPES;

// ---------------------------------------------------------------------------
// Dónde guardar
// ---------------------------------------------------------------------------

interface S3Config {
  client: S3Client;
  bucket: string;
  prefix: string;
}

let s3Cache: S3Config | null | undefined;

/** Almacenamiento S3 configurado por variables de entorno (o null para usar disco). */
function s3(): S3Config | null {
  if (s3Cache !== undefined) return s3Cache;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return (s3Cache = null);
  s3Cache = {
    bucket,
    // Prefijo opcional dentro del bucket (por ejemplo "productos/") por si el bucket se comparte
    prefix: (process.env.S3_PREFIX?.trim() ?? "").replace(/^\/+/, ""),
    client: new S3Client({
      endpoint,
      region: process.env.S3_REGION?.trim() || "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, // MinIO usa https://servidor/bucket/archivo
    }),
  };
  return s3Cache;
}

/** Carpeta base en disco; null si no está configurada en producción. */
export function uploadDir() {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "production" ? null : path.join(process.cwd(), "uploads");
}

/** Para avisos: dónde se están guardando las fotos. */
export function storageKind(): "s3" | "disk" | null {
  return s3() ? "s3" : uploadDir() ? "disk" : null;
}

const objectKey = (cfg: S3Config, restaurantId: number, name: string) => `${cfg.prefix}r${restaurantId}/${name}`;

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/** Nombre de archivo válido (lo genera el servidor; evita rutas como ../../). */
const NAME = /^[0-9a-f-]{36}\.(webp|jpg|png)$/;
export const isImageName = (name: string) => NAME.test(name);

/** Revisa los primeros bytes: solo se aceptan WebP, JPEG y PNG de verdad. */
function detect(buf: Buffer): Ext | null {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  return null;
}

export class UploadError extends Error {}

// ---------------------------------------------------------------------------
// Guardar, leer y borrar
// ---------------------------------------------------------------------------

/** Guarda una foto del restaurante y devuelve su nombre de archivo. */
export async function saveImage(restaurantId: number, data: Buffer) {
  if (data.length === 0) throw new UploadError("La foto está vacía");
  if (data.length > MAX_IMAGE_BYTES) throw new UploadError("La foto es demasiado grande");
  const ext = detect(data);
  if (!ext) throw new UploadError("Formato no válido: usa una foto JPG, PNG o WebP");
  const name = `${randomUUID()}.${ext}`;

  const cfg = s3();
  if (cfg) {
    try {
      await cfg.client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: objectKey(cfg, restaurantId, name),
          Body: data,
          ContentType: TYPES[ext],
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    } catch (e) {
      console.error("No se pudo subir la foto al almacenamiento S3:", e);
      throw new UploadError("No se pudo guardar la foto en el almacenamiento de archivos. Revisa la configuración S3 del servidor.");
    }
    return name;
  }

  const base = uploadDir();
  if (!base) throw new UploadError("Falta configurar dónde guardar las fotos (S3_* o UPLOAD_DIR) en el servidor.");
  const dir = path.join(base, `r${restaurantId}`);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), data);
  } catch (e) {
    console.error("No se pudo guardar la foto:", e);
    throw new UploadError("El servidor no pudo guardar la foto. Revisa que el volumen de fotos esté montado y tenga permiso de escritura.");
  }
  return name;
}

export async function readImage(restaurantId: number, name: string): Promise<{ data: Uint8Array; type: string } | null> {
  if (!isImageName(name)) return null;
  const type = TYPES[name.split(".").pop() as Ext];

  const cfg = s3();
  if (cfg) {
    try {
      const res = await cfg.client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: objectKey(cfg, restaurantId, name) }));
      if (!res.Body) return null;
      return { data: await res.Body.transformToByteArray(), type };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 404) console.error("No se pudo leer la foto del almacenamiento S3:", e);
      return null;
    }
  }

  const base = uploadDir();
  if (!base) return null;
  try {
    return { data: await readFile(path.join(base, `r${restaurantId}`, name)), type };
  } catch {
    return null;
  }
}

/** Borra una foto (si no existe, no pasa nada). */
export async function deleteImage(restaurantId: number, name: string | null | undefined) {
  if (!name || !isImageName(name)) return;
  const cfg = s3();
  if (cfg) {
    await cfg.client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: objectKey(cfg, restaurantId, name) })).catch((e) => {
      console.error("No se pudo borrar la foto del almacenamiento S3:", e);
    });
    return;
  }
  const base = uploadDir();
  if (!base) return;
  await unlink(path.join(base, `r${restaurantId}`, name)).catch(() => {});
}

/** Dirección pública de una foto (la sirve app/(restaurante)/media/[name]). */
export const imageUrl = (name: string | null | undefined) => (name ? `/media/${name}` : null);
