-- Suscripciones: planes, pagos, ajustes de la plataforma y entrada directa tras el registro.

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "paidUntil" TIMESTAMP(3),
ADD COLUMN "planId" INTEGER,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'PLATAFORMA';

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxWaiters" INTEGER,
    "maxAccounts" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL DEFAULT (current_setting('app.restaurant_id'::text, true))::integer,
    "amount" DOUBLE PRECISION NOT NULL,
    "months" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "trialDays" INTEGER NOT NULL DEFAULT 15,
    "graceDays" INTEGER NOT NULL DEFAULT 5,
    "signupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "signupPlanId" INTEGER,
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "supportEmail" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginTicket" (
    "id" TEXT NOT NULL,
    "restaurantId" INTEGER NOT NULL DEFAULT (current_setting('app.restaurant_id'::text, true))::integer,
    "accountId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionPayment_restaurantId_createdAt_idx" ON "SubscriptionPayment"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginTicket_restaurantId_idx" ON "LoginTicket"("restaurantId");

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginTicket" ADD CONSTRAINT "LoginTicket_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginTicket" ADD CONSTRAINT "LoginTicket_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Candado multi-restaurante (ver migración multi_restaurante)
CREATE TRIGGER "LoginTicket_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "accountId" ON "LoginTicket"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('accountId', 'Account');
