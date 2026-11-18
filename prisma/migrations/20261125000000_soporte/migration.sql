-- Entrar como soporte: sesiones sin cuenta del restaurante y registro de cada acceso.

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "accountId" DROP NOT NULL,
ADD COLUMN "supportName" TEXT;

-- AlterTable
ALTER TABLE "LoginTicket" ALTER COLUMN "accountId" DROP NOT NULL,
ADD COLUMN "supportName" TEXT;

-- CreateTable
CREATE TABLE "SupportAccess" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL DEFAULT (current_setting('app.restaurant_id'::text, true))::integer,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAccess_restaurantId_createdAt_idx" ON "SupportAccess"("restaurantId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportAccess" ADD CONSTRAINT "SupportAccess_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
