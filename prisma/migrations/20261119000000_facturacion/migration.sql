-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "taxRate" TEXT NOT NULL DEFAULT '15';

-- CreateTable
CREATE TABLE "FiscalSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "legalName" TEXT NOT NULL DEFAULT '',
    "tradeName" TEXT NOT NULL DEFAULT '',
    "rtn" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceRange" (
    "id" SERIAL NOT NULL,
    "cai" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "rangeFrom" INTEGER NOT NULL,
    "rangeTo" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "rangeId" INTEGER NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT 'Consumidor final',
    "customerRtn" TEXT,
    "exempt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exonerated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable15" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable18" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isv15" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isv18" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "issuer" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "replacedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Invoice_paymentId_idx" ON "Invoice"("paymentId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rangeId_fkey" FOREIGN KEY ("rangeId") REFERENCES "InvoiceRange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
