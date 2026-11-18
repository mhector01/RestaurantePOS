// Llama una acción del servidor desde el navegador sin quedarse "cargando" si se cae la conexión
// (internet intermitente, el servidor reiniciándose durante un despliegue…).

export const CONNECTION_LOST = "No hubo respuesta del servidor. Revisa tu conexión y vuelve a intentar.";

export async function callAction<T>(fn: () => Promise<T>, lostMessage = CONNECTION_LOST): Promise<T | { success: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    // Next.js usa excepciones para redirigir: esas se dejan pasar
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error(e);
    return { success: false, error: lostMessage };
  }
}

/** Para cambios de contraseña: si se perdió la respuesta, el cambio pudo haberse guardado igual. */
export const PASSWORD_LOST =
  "No hubo respuesta del servidor. Recarga la página: si ya no te pide la contraseña temporal, el cambio sí se guardó. Si no, vuelve a intentar.";
