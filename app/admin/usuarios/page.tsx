import prisma from "@/lib/prisma";
import { UserModal } from "@/components/UserModal";
import { deleteUser } from "@/app/actions";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const usuarios = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Personal / Meseros</h1>
          <p className="text-slate-500">Administra quién tiene acceso a cobrar y atender mesas.</p>
        </div>
        <UserModal />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">ID</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">Nombre</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase">PIN de Acceso</th>
              <th className="p-4 text-xs font-black tracking-widest text-slate-500 uppercase text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 italic">No hay meseros registrados.</td>
              </tr>
            ) : (
              usuarios.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-400 font-mono text-sm">#{user.id}</td>
                  <td className="p-4 font-bold text-slate-800">{user.name}</td>
                  <td className="p-4">
                    <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1 rounded-md font-mono font-black tracking-[0.3em]">
                      {user.pin}
                    </span>
                  </td>
                  <td className="p-4 flex items-center justify-end gap-2">
                    <UserModal user={user} />
                    
                    <form action={async () => {
                      "use server";
                      await deleteUser(user.id);
                    }}>
                      <Button type="submit" variant="outline" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}