import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailySales } from "@/app/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // Aprovechamos la función que ya hicimos para darle un vistazo rápido
  const ventas = await getDailySales();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Hola, Administrador</h1>
      <p className="text-slate-500 mb-8">Este es el resumen de tu negocio el día de hoy.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white shadow-sm border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ventas de Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-800">${ventas.total.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-widest">Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-800">{ventas.transacciones}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
        <h3 className="font-bold text-blue-900 mb-2">Acciones Rápidas</h3>
        <div className="flex gap-4">
          <Link href="/admin/reportes">
            <Button className="bg-blue-600 hover:bg-blue-700">Ver Cierre Detallado</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}