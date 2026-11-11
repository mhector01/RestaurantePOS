-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "kitchen" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "KitchenItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "KitchenItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitchenItem_status_idx" ON "KitchenItem"("status");

-- AddForeignKey
ALTER TABLE "KitchenItem" ADD CONSTRAINT "KitchenItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenItem" ADD CONSTRAINT "KitchenItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
