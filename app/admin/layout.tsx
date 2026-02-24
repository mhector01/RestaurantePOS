import Link from "next/link";
import { LayoutDashboard, Package, BarChart3, Users, Store, LogOut } from "lucide-react";
import { logoutAdmin } from "@/app/actions"; // <-- Importamos la acción de cerrar sesión

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      {/* SIDEBAR (Menú Lateral) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 text-center border-b border-slate-800">
          <h2 className="text-2xl font-black italic tracking-tighter">POS ADMIN</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Panel de Control</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors font-medium">
            <LayoutDashboard size={20} className="text-blue-400" />
            Inicio
          </Link>
          <Link href="/admin/reportes" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors font-medium">
            <BarChart3 size={20} className="text-green-400" />
            Cierre de Caja
          </Link>
          
          {/* Módulo de Productos (¡Ya habilitado!) */}
          <Link href="/admin/productos" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors font-medium">
            <Package size={20} className="text-orange-400" />
            Productos
          </Link>

          <Link href="/admin/usuarios" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors font-medium opacity-50 cursor-not-allowed" title="Próximamente">
            <Users size={20} className="text-purple-400" />
            Usuarios
          </Link>
        </nav>

        <div className="p-6 border-t border-slate-800 space-y-3">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors font-bold text-sm uppercase tracking-widest">
            <Store size={18} />
            Ir al POS
          </Link>

          {/* Botón de Cerrar Sesión Segura */}
          <form action={logoutAdmin}>
            <button type="submit" className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold text-sm uppercase tracking-widest">
              <LogOut size={18} />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      
    </div>
  );
}