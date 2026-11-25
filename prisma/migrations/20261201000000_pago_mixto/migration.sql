-- Pago mixto: parte en efectivo y parte con tarjeta en un mismo cobro.
ALTER TABLE "Payment" ADD COLUMN "cardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
