// Aviso firmado de IMZA Pagos (imzaris.com) cuando cambia el estado de un cobro con tarjeta.
// Configúralo en imzaris.com como PRODUCTO_RISTEMO_WEBHOOK = https://<dominio principal>/api/imza-pagos/webhook
// (solo responde en el dominio principal, nunca en el subdominio de un restaurante).
import { NextResponse } from "next/server";
import { isPlatformHost } from "@/lib/tenant-host";
import { PRODUCT_ID, type CobroAviso, verificarFirma } from "@/lib/imza-pagos";
import { settleCardCheckout } from "@/lib/card-checkout";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPlatformHost(request.headers.get("host"))) return new NextResponse("No encontrado", { status: 404 });

  const raw = await request.text();
  const ok =
    request.headers.get("x-imza-producto") === PRODUCT_ID &&
    verificarFirma(raw, request.headers.get("x-imza-timestamp"), request.headers.get("x-imza-firma"));
  if (!ok) return NextResponse.json({ error: "Firma no válida" }, { status: 401 });

  let body: { evento?: string; cobro?: CobroAviso };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (body.evento !== "cobro.actualizado" || !body.cobro || typeof body.cobro !== "object") {
    return NextResponse.json({ ok: true, resultado: "ignorado" });
  }

  // Si algo falla aquí (p. ej. la base no responde) se devuelve 500 y imzaris.com reintenta.
  const resultado = await settleCardCheckout(body.cobro);
  console.info("[imza-pagos] aviso", body.cobro.id, body.cobro.estado, "→", resultado);
  return NextResponse.json({ ok: true, resultado });
}
