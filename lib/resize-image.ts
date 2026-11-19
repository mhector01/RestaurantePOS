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
