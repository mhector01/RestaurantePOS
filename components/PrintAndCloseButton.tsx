"use client";

import { useRouter } from "next/navigation";
import { Lock, Printer } from "lucide-react";
import { closeRegister } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/pos/ConfirmAction";

export function PrintAndCloseButton({ hasSales, openAccounts }: { hasSales: boolean; openAccounts: number }) {
  const router = useRouter();

  return (
    <>
      <Button variant="outline" className="h-11 rounded-xl" onClick={() => window.print()} disabled={!hasSales}>
        <Printer /> Imprimir reporte
      </Button>
      <ConfirmAction
        title="¿Cerrar el turno?"
        description={
          (openAccounts > 0
            ? `Ojo: hay ${openAccounts} cuenta(s) abierta(s); sus cobros pasarán al siguiente turno. `
            : "") +
          "Se imprimirá el corte y el contador del turno volverá a cero. Esta acción no se puede deshacer."
        }
        confirmLabel="Imprimir y cerrar"
        destructive={false}
        successMessage="Turno cerrado"
        action={async () => {
          window.print();
          await closeRegister();
          router.refresh();
        }}
      >
        <Button className="h-11 rounded-xl" disabled={!hasSales}>
          <Lock /> Cerrar turno
        </Button>
      </ConfirmAction>
    </>
  );
}
