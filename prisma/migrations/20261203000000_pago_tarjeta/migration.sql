-- Pago de la suscripción con tarjeta (Pagadito vía IMZA Pagos): cobros pendientes del dueño.

-- CreateTable
CREATE TABLE "CardCheckout" (
    "id" TEXT NOT NULL,
    "restaurantId" INTEGER NOT NULL DEFAULT (current_setting('app.restaurant_id'::text, true))::integer,
    "months" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'HNL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cobroId" TEXT,
    "paymentId" INTEGER,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "CardCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardCheckout_restaurantId_createdAt_idx" ON "CardCheckout"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "CardCheckout_cobroId_idx" ON "CardCheckout"("cobroId");

-- AddForeignKey
ALTER TABLE "CardCheckout" ADD CONSTRAINT "CardCheckout_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Candado multi-restaurante (ver migración multi_restaurante)
CREATE TRIGGER "CardCheckout_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "paymentId" ON "CardCheckout"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('paymentId', 'SubscriptionPayment');
