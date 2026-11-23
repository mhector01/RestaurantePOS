-- Gastos (no inventario) con ISV, proveedor, factura y foto; entran al crédito fiscal, libro de compras, ganancias y caja.

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL DEFAULT (current_setting('app.restaurant_id'::text, true))::integer,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplierId" INTEGER,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "supplierRtn" TEXT NOT NULL DEFAULT '',
    "hasInvoice" BOOLEAN NOT NULL DEFAULT true,
    "invoiceNumber" TEXT NOT NULL DEFAULT '',
    "cai" TEXT NOT NULL DEFAULT '',
    "exempt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable15" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable18" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isv15" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isv18" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "paidAt" TIMESTAMP(3),
    "registerClosed" BOOLEAN NOT NULL DEFAULT false,
    "attachment" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_restaurantId_date_idx" ON "Expense"("restaurantId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Candado multi-restaurante (ver migración multi_restaurante)
CREATE TRIGGER "Expense_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "supplierId" ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('supplierId', 'Supplier');
