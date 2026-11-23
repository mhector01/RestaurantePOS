// Reduce una foto en el navegador antes de subirla: recorte 4:3 centrado de 640×480 en WebP
// (JPEG si el navegador no sabe hacer WebP). Una foto de celular de 4 MB queda en ~60–150 KB.

const W = 640;
const H = 480;

async function load(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      // Respeta la orientación de las fotos tomadas con el celular
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* algunos formatos (HEIC) no se pueden leer: se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Logo: sin recortar, cabe en 600×300 y conserva la transparencia (WebP, o PNG si el navegador
 * no sabe hacer WebP). Pensado para imprimirse en tickets de 80 mm.
 */
export async function resizeLogo(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Elige una imagen");
  let img;
  try {
    img = await load(file);
  } catch {
    throw new Error("No se pudo leer la imagen. Prueba con una PNG o JPG.");
  }
  const scale = Math.min(1, 600 / img.width, 300 / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const webp = await toBlob(canvas, "image/webp", 0.9);
  if (webp && webp.type === "image/webp") return webp;
  const png = await toBlob(canvas, "image/png", 1);
  if (!png) throw new Error("No se pudo procesar la imagen");
  return png;
}

/** Foto de un documento (factura de proveedor): sin recortar, hasta 1600 px, en JPEG legible. */
export async function resizeDocument(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Elige una foto");
  let img;
  try {
    img = await load(file);
  } catch {
    throw new Error("No se pudo leer la foto. Prueba con una JPG o PNG.");
  }
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // fondo blanco para PNG transparentes
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.82, 0.7, 0.55]) {
    const jpg = await toBlob(canvas, "image/jpeg", q);
    if (jpg && jpg.size < 780 * 1024) return jpg;
  }
  throw new Error("La foto es demasiado pesada");
}

export async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Elige una foto");
  let img;
  try {
    img = await load(file);
  } catch {
    throw new Error("No se pudo leer la foto. Prueba con una JPG o PNG.");
  }
  const scale = Math.max(W / img.width, H / img.height);
  const sw = W / scale;
  const sh = H / scale;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpg) throw new Error("No se pudo procesar la foto");
  return jpg;
}
