-- Pago por transferencia (con referencia) y transferencia como segunda forma de un pago mixto.
ALTER TABLE "Payment" ADD COLUMN "mixedWith" TEXT NOT NULL DEFAULT 'CARD';
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT NOT NULL DEFAULT '';
