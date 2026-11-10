"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { logoutWaiter } from "@/app/actions";
import { PinPad } from "@/components/PinPad";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Muestra quién está atendiendo y permite cambiar de mesero. */
export function WaiterChip({ name, dark = false }: { name: string | null; dark?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const logout = () =>
    startTransition(async () => {
      await logoutWaiter();
      toast("Sesión cerrada");
      router.refresh();
    });

  return (
    <>
      {name ? (
        <div
          className={cn(
            "flex items-center gap-1 rounded-full pl-1 pr-1 h-11 border",
            dark ? "border-white/10 bg-white/5 text-white" : "bg-card"
          )}
        >
          <span className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold">
            {initials(name)}
          </span>
          <span className="text-sm font-medium px-2 max-w-[9rem] truncate hidden sm:inline">{name}</span>
          <button
            type="button"
            onClick={logout}
            disabled={pending}
            aria-label="Cambiar de mesero"
            title="Cambiar de mesero"
            className={cn(
              "size-9 grid place-items-center rounded-full transition-colors",
              dark ? "hover:bg-white/10 text-stone-300" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <UserRound className="size-4" /> Iniciar turno
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm rounded-3xl py-8">
          <DialogTitle className="sr-only">Ingresar PIN</DialogTitle>
          <PinPad variant="inline" onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
