"use client";

import { useTransition } from "react";
import { ArchiveRestore } from "lucide-react";
import { restoreSupplier } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";

export function RestoreSupplierButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 rounded-lg"
      disabled={pending}
      onClick={() => startTransition(() => restoreSupplier(id))}
    >
      <ArchiveRestore className="size-4" /> Restaurar
    </Button>
  );
}
