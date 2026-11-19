-- Propina voluntaria: sugerida en la pre-cuenta, aceptada al cobrar, fuera de la venta y del ISV.

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "tipEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "tipPercent" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "tip" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "tip" DOUBLE PRECISION NOT NULL DEFAULT 0;
