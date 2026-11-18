import { ShieldAlert } from "lucide-react";

export function OwnerOnly({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center max-w-xl">
      <ShieldAlert className="size-8 mx-auto text-muted-foreground" />
      <p className="font-medium mt-3">Solo el dueño puede {what}</p>
      <p className="text-sm text-muted-foreground mt-1">Pídeselo a quien tenga el rol de dueño en este restaurante.</p>
    </div>
  );
}
