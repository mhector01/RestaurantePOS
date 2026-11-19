-- Descuentos al cobrar (cuenta, producto, cortesía, tercera edad) con autorización de encargado.

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "discountLimit" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "seniorPercent" INTEGER NOT NULL DEFAULT 25;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentDiscount" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL DEFAULT (current_setting('app.restaurant_id'::text, true))::integer,
    "paymentId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "items" TEXT NOT NULL DEFAULT '',
    "beneficiaryName" TEXT,
    "beneficiaryId" TEXT,
    "appliedBy" TEXT,
    "authorizedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentDiscount_restaurantId_createdAt_idx" ON "PaymentDiscount"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentDiscount_paymentId_idx" ON "PaymentDiscount"("paymentId");

-- AddForeignKey
ALTER TABLE "PaymentDiscount" ADD CONSTRAINT "PaymentDiscount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDiscount" ADD CONSTRAINT "PaymentDiscount_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Candado multi-restaurante (ver migración multi_restaurante)
CREATE TRIGGER "PaymentDiscount_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "paymentId" ON "PaymentDiscount"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('paymentId', 'Payment');
