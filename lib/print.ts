// Imprimir cuando el contenido de impresión (y sus imágenes, como el logo) ya está listo.
// Si se llama a window.print() antes de que cargue el logo, el primer recibo sale sin él.

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function loaded(img: HTMLImageElement, timeoutMs: number) {
  if (img.complete) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

export async function printWhenReady({ selector = ".print-area", timeoutMs = 2000 } = {}) {
  // Dos cuadros: React termina de pintar el contenido recién montado
  await nextFrame();
  await nextFrame();
  const imgs = [...document.querySelectorAll<HTMLImageElement>(`${selector} img`)];
  await Promise.all(imgs.map((img) => loaded(img, timeoutMs)));
  window.print();
}
