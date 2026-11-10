"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Result = { success?: boolean; error?: string } | void | null | undefined;

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  successMessage?: string;
  destructive?: boolean;
  action: () => Promise<Result>;
  children: React.ReactNode; // el botón que abre la confirmación
}

/** Pide confirmación antes de ejecutar una acción irreversible. */
export function ConfirmAction({
  title,
  description,
  confirmLabel = "Confirmar",
  successMessage,
  destructive = true,
  action,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await action();
      if (res && res.success === false) {
        toast.error(res.error ?? "No se pudo completar la acción");
      } else if (successMessage) {
        toast.success(successMessage);
      }
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm rounded-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className="h-11"
            onClick={run}
            disabled={pending}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
