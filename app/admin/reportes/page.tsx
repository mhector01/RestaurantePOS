import prisma from "@/lib/prisma";
import { DollarSign, Receipt, Trophy, CreditCard, Banknote } from "lucide-react";
import { PrintAndCloseButton } from "@/components/PrintAndCloseButton";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  const ordenesPagadas = await prisma.order.findMany({
    where: { status: "PAID" },
    include: {
      user: true,
      payments: true,
    }
  });

  // 1. LÓGICA DE SEPARACIÓN DE DINERO
  let totalCash = 0;
  let totalCard = 0;
  let totalRevenue = 0;

  ordenesPagadas.forEach(order => {
    order.payments.forEach(p => {
      totalRevenue += p.amount;
      
      // Verificamos el método (CASH = Efectivo, CARD = Tarjeta)
      const metodo = p.method.toUpperCase();
      if (metodo === "CASH" || metodo === "EFECTIVO") {
        totalCash += p.amount;
      } else if (metodo === "CARD" || metodo === "TARJETA") {
        totalCard += p.amount;
      } else {
        // Si tienes otro método (transferencia, etc), por defecto lo sumamos al efectivo
        totalCash += p.amount;
      }
    });
  });

  const totalOrders = ordenesPagadas.length;

  // 2. RENDIMIENTO POR MESERO
  const waiterStats: Record<number, { name: string; total: number; count: number }> = {};

  ordenesPagadas.forEach(order => {
    const waiterId = order.userId || 0; 
    const waiterName = order.user?.name || "Admin / Mostrador";
    const orderTotal = order.payments.reduce((sum, p) => sum + p.amount, 0);

    if (!waiterStats[waiterId]) {
      waiterStats[waiterId] = { name: waiterName, total: 0, count: 0 };
    }
    
    waiterStats[waiterId].total += orderTotal;
    waiterStats[waiterId].count += 1;
  });

  const topMeseros = Object.values(waiterStats).sort((a, b) => b.total - a.total);
  const fechaActual = new Date().toLocaleString();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      
      {/* ========================================= */}
      {/* 1. TICKET DE IMPRESIÓN (OCULTO EN PANTALLA) */}
      {/* ========================================= */}
      <div className="hidden print:block w-[80mm] mx-auto text-black font-mono text-sm">
        <h2 className="text-center text-xl font-black mb-1">CORTE DE CAJA (Z)</h2>
        <p className="text-center text-xs mb-4">{fechaActual}</p>
        
        <p className="mb-2">--------------------------------</p>
        <div className="flex justify-between font-black text-lg mb-1">
          <span>TOTAL VENTAS:</span>
          <span>${totalRevenue.toFixed(2)}</span>
        </div>
        
        {/* DESGLOSE EFECTIVO Y TARJETA EN EL TICKET */}
        <div className="flex justify-between mb-1 pl-2 text-xs">
          <span>+ Efectivo en Cajón:</span>
          <span className="font-bold">${totalCash.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-4 pl-2 text-xs">
          <span>+ Pagos en Terminal:</span>
          <span className="font-bold">${totalCard.toFixed(2)}</span>
        </div>

        <div className="flex justify-between mb-4">
          <span>Tickets Pagados:</span>
          <span>{totalOrders}</span>
        </div>
        
        <p className="mb-2 font-bold uppercase">Desglose por Mesero:</p>
        {topMeseros.length === 0 ? (
          <p className="italic text-xs">Sin ventas</p>
        ) : (
          topMeseros.map((m, i) => (
            <div key={i} className="flex justify-between mb-1 text-xs">
              <span>{m.name} ({m.count} mesas)</span>
              <span className="font-bold">${m.total.toFixed(2)}</span>
            </div>
          ))
        )}
        
        <p className="mt-6 mb-2">--------------------------------</p>
        <p className="text-center font-bold">FIN DEL TURNO</p>
        <p className="text-center text-xs mt-2">Sistema POS v1.0</p>
      </div>


      {/* ========================================= */}
      {/* 2. DASHBOARD VISUAL (OCULTO AL IMPRIMIR)    */}
      {/* ========================================= */}
      <div className="print:hidden space-y-8">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Cierre de Caja</h1>
            <p className="text-slate-500 font-medium">Ventas acumuladas del turno actual.</p>
          </div>
          <PrintAndCloseButton hasSales={totalOrders > 0} />
        </div>

        {/* TARJETAS DE RESUMEN (AHORA SON 4 PARA SEPARAR EFECTIVO Y TARJETA) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <DollarSign size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">Total Ingresos</span>
            </div>
            <p className="text-3xl font-black text-slate-900">${totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border-b-4 border-b-green-500 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-green-600">
              <Banknote size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">Cajón (Efectivo)</span>
            </div>
            <p className="text-3xl font-black text-green-600">${totalCash.toFixed(2)}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border-b-4 border-b-blue-500 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-blue-600">
              <CreditCard size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">Terminal (Tarjeta)</span>
            </div>
            <p className="text-3xl font-black text-blue-600">${totalCard.toFixed(2)}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Receipt size={20} />
              <span className="text-xs font-bold uppercase tracking-widest">Tickets</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{totalOrders}</p>
          </div>

        </div>

        {/* RANKING DE MESEROS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-6 flex items-center gap-3 text-white">
            <Trophy className="text-yellow-400" size={24} />
            <h2 className="text-xl font-black uppercase tracking-widest italic">Rendimiento por Mesero</h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs font-black tracking-widest text-slate-400 uppercase">Posición</th>
                <th className="p-4 text-xs font-black tracking-widest text-slate-400 uppercase">Mesero</th>
                <th className="p-4 text-xs font-black tracking-widest text-slate-400 uppercase text-center">Mesas Atendidas</th>
                <th className="p-4 text-xs font-black tracking-widest text-slate-400 uppercase text-right">Total Vendido</th>
              </tr>
            </thead>
            <tbody>
              {topMeseros.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 italic font-bold">No hay ventas registradas aún.</td>
                </tr>
              ) : (
                topMeseros.map((mesero, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" : 
                        index === 1 ? "bg-slate-200 text-slate-600" : 
                        index === 2 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-400"
                      }`}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="p-4 font-black text-slate-800 text-lg uppercase">{mesero.name}</td>
                    <td className="p-4 text-center font-bold text-slate-500">{mesero.count}</td>
                    <td className="p-4 text-right font-black text-green-600 text-xl">${mesero.total.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}