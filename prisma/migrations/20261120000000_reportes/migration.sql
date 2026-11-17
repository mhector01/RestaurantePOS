-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "name" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "isCombo" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waiterName" TEXT,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleLine_createdAt_idx" ON "SaleLine"("createdAt");

-- CreateIndex
CREATE INDEX "SaleLine_productId_idx" ON "SaleLine"("productId");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ventas anteriores: se reconstruyen desde las cuentas ya cobradas que conservan sus productos.
-- (El costo queda en 0 porque no había recetas; el ISV se estima con la tasa actual del producto.)
INSERT INTO "SaleLine" ("paymentId", "orderId", "productId", "name", "categoryName", "isCombo", "quantity",
                        "unitPrice", "total", "net", "tax", "cost", "waiterName", "channel", "createdAt")
SELECT p."id",
       o."id",
       pr."id",
       pr."name",
       c."name",
       pr."isCombo",
       oi."quantity",
       oi."price",
       oi."price" * oi."quantity",
       ROUND(((oi."price" * oi."quantity") / (1 + CASE pr."taxRate" WHEN '18' THEN 0.18 WHEN 'EXENTO' THEN 0 ELSE 0.15 END))::numeric, 2),
       ROUND(((oi."price" * oi."quantity") - (oi."price" * oi."quantity") / (1 + CASE pr."taxRate" WHEN '18' THEN 0.18 WHEN 'EXENTO' THEN 0 ELSE 0.15 END))::numeric, 2),
       0,
       u."name",
       CASE WHEN t."number" = 0 THEN 'LLEVAR' ELSE 'MESA' END,
       p."createdAt"
FROM "OrderItem" oi
JOIN "Order" o ON o."id" = oi."orderId" AND o."status" IN ('PAID', 'CLOSED')
JOIN "Product" pr ON pr."id" = oi."productId"
JOIN "Category" c ON c."id" = pr."categoryId"
JOIN "Table" t ON t."id" = o."tableId"
LEFT JOIN "User" u ON u."id" = o."userId"
JOIN LATERAL (SELECT "id", "createdAt" FROM "Payment" WHERE "orderId" = o."id" ORDER BY "id" DESC LIMIT 1) p ON true;
