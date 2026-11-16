-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variant" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isCombo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ComboSlot" (
    "id" SERIAL NOT NULL,
    "comboId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboOption" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComboOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemPart" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "slotName" TEXT NOT NULL,

    CONSTRAINT "OrderItemPart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ComboSlot" ADD CONSTRAINT "ComboSlot_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOption" ADD CONSTRAINT "ComboOption_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ComboSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOption" ADD CONSTRAINT "ComboOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemPart" ADD CONSTRAINT "OrderItemPart_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemPart" ADD CONSTRAINT "OrderItemPart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
