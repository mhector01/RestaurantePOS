-- Multi-restaurante (SaaS): cada fila pertenece a un restaurante.
-- Todo lo que ya existe pasa al restaurante #1, así el local actual sigue igual.
-- La app siempre manda "restaurantId". El valor por defecto (app.restaurant_id) no está definido,
-- así que un INSERT sin restaurante falla en vez de quedar huérfano.

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

INSERT INTO "Restaurant" ("id", "slug", "updatedAt") VALUES (1, 'principal', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"Restaurant"', 'id'), 1);

-- Area
ALTER TABLE "Area" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Area" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "Area_restaurantId_idx" ON "Area"("restaurantId");
ALTER TABLE "Area" ADD CONSTRAINT "Area_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Table
DROP INDEX "Table_number_key";
ALTER TABLE "Table" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Table" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE UNIQUE INDEX "Table_restaurantId_number_key" ON "Table"("restaurantId", "number");
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Category
DROP INDEX "Category_name_key";
ALTER TABLE "Category" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Category" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE UNIQUE INDEX "Category_restaurantId_name_key" ON "Category"("restaurantId", "name");
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Product
ALTER TABLE "Product" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "Product_restaurantId_idx" ON "Product"("restaurantId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ComboSlot
ALTER TABLE "ComboSlot" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ComboSlot" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "ComboSlot_restaurantId_idx" ON "ComboSlot"("restaurantId");
ALTER TABLE "ComboSlot" ADD CONSTRAINT "ComboSlot_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ComboOption
ALTER TABLE "ComboOption" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ComboOption" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "ComboOption_restaurantId_idx" ON "ComboOption"("restaurantId");
ALTER TABLE "ComboOption" ADD CONSTRAINT "ComboOption_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order
ALTER TABLE "Order" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OrderItem" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "OrderItem_restaurantId_idx" ON "OrderItem"("restaurantId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderItemPart
ALTER TABLE "OrderItemPart" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OrderItemPart" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "OrderItemPart_restaurantId_idx" ON "OrderItemPart"("restaurantId");
ALTER TABLE "OrderItemPart" ADD CONSTRAINT "OrderItemPart_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- KitchenItem
DROP INDEX "KitchenItem_status_idx";
ALTER TABLE "KitchenItem" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "KitchenItem" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "KitchenItem_restaurantId_status_idx" ON "KitchenItem"("restaurantId", "status");
ALTER TABLE "KitchenItem" ADD CONSTRAINT "KitchenItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment
ALTER TABLE "Payment" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Payment" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "Payment_restaurantId_idx" ON "Payment"("restaurantId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- User
DROP INDEX "User_pin_key";
ALTER TABLE "User" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE UNIQUE INDEX "User_restaurantId_pin_key" ON "User"("restaurantId", "pin");
ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supplier
ALTER TABLE "Supplier" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Supplier" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "Supplier_restaurantId_idx" ON "Supplier"("restaurantId");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ingredient
DROP INDEX "Ingredient_name_key";
ALTER TABLE "Ingredient" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Ingredient" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE UNIQUE INDEX "Ingredient_restaurantId_name_key" ON "Ingredient"("restaurantId", "name");
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RecipeItem
ALTER TABLE "RecipeItem" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RecipeItem" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "RecipeItem_restaurantId_idx" ON "RecipeItem"("restaurantId");
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Purchase
DROP INDEX "Purchase_date_idx";
ALTER TABLE "Purchase" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Purchase" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "Purchase_restaurantId_date_idx" ON "Purchase"("restaurantId", "date");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PurchaseItem
ALTER TABLE "PurchaseItem" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PurchaseItem" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "PurchaseItem_restaurantId_idx" ON "PurchaseItem"("restaurantId");
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StockMovement
DROP INDEX "StockMovement_type_createdAt_idx";
ALTER TABLE "StockMovement" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StockMovement" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "StockMovement_restaurantId_type_createdAt_idx" ON "StockMovement"("restaurantId", "type", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FiscalSettings
ALTER TABLE "FiscalSettings" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FiscalSettings" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE UNIQUE INDEX "FiscalSettings_restaurantId_key" ON "FiscalSettings"("restaurantId");
ALTER TABLE "FiscalSettings" ADD CONSTRAINT "FiscalSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- InvoiceRange
ALTER TABLE "InvoiceRange" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InvoiceRange" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "InvoiceRange_restaurantId_idx" ON "InvoiceRange"("restaurantId");
ALTER TABLE "InvoiceRange" ADD CONSTRAINT "InvoiceRange_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoice
DROP INDEX "Invoice_number_key";
DROP INDEX "Invoice_createdAt_idx";
ALTER TABLE "Invoice" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Invoice" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE UNIQUE INDEX "Invoice_restaurantId_number_key" ON "Invoice"("restaurantId", "number");
CREATE INDEX "Invoice_restaurantId_createdAt_idx" ON "Invoice"("restaurantId", "createdAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SaleLine
DROP INDEX "SaleLine_createdAt_idx";
ALTER TABLE "SaleLine" ADD COLUMN "restaurantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SaleLine" ALTER COLUMN "restaurantId" SET DEFAULT (current_setting('app.restaurant_id'::text, true))::integer;
CREATE INDEX "SaleLine_restaurantId_createdAt_idx" ON "SaleLine"("restaurantId", "createdAt");
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FiscalSettings deja de ser fila única (id = 1): una por restaurante
CREATE SEQUENCE "FiscalSettings_id_seq";
ALTER TABLE "FiscalSettings" ALTER COLUMN "id" SET DEFAULT nextval('"FiscalSettings_id_seq"');
ALTER SEQUENCE "FiscalSettings_id_seq" OWNED BY "FiscalSettings"."id";
SELECT setval('"FiscalSettings_id_seq"', COALESCE((SELECT MAX("id") FROM "FiscalSettings"), 0) + 1, false);

-- ---------------------------------------------------------------------------
-- Candado en la base de datos: una fila nunca puede apuntar a otra de un
-- restaurante distinto (ej. un pedido del restaurante A con un producto del B),
-- aunque un error en el código lo intentara. Prisma no administra estos triggers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "tenant_guard"() RETURNS trigger AS $$
DECLARE
  i INT := 0;
  ref_id INT;
  parent_rid INT;
BEGIN
  WHILE i < TG_NARGS LOOP
    ref_id := (to_jsonb(NEW) ->> TG_ARGV[i])::INT;
    IF ref_id IS NOT NULL THEN
      EXECUTE format('SELECT "restaurantId" FROM %I WHERE "id" = $1', TG_ARGV[i + 1]) INTO parent_rid USING ref_id;
      IF parent_rid IS NOT NULL AND parent_rid <> NEW."restaurantId" THEN
        RAISE EXCEPTION 'tenant_guard: %.% apunta a % de otro restaurante', TG_TABLE_NAME, TG_ARGV[i], TG_ARGV[i + 1];
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Table_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "areaId" ON "Table"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('areaId', 'Area');
CREATE TRIGGER "Product_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "categoryId" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('categoryId', 'Category');
CREATE TRIGGER "ComboSlot_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "comboId" ON "ComboSlot"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('comboId', 'Product');
CREATE TRIGGER "ComboOption_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "slotId", "productId" ON "ComboOption"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('slotId', 'ComboSlot', 'productId', 'Product');
CREATE TRIGGER "Order_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "tableId", "userId" ON "Order"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('tableId', 'Table', 'userId', 'User');
CREATE TRIGGER "OrderItem_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "orderId", "productId" ON "OrderItem"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('orderId', 'Order', 'productId', 'Product');
CREATE TRIGGER "OrderItemPart_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "orderItemId", "productId" ON "OrderItemPart"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('orderItemId', 'OrderItem', 'productId', 'Product');
CREATE TRIGGER "KitchenItem_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "orderId", "productId" ON "KitchenItem"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('orderId', 'Order', 'productId', 'Product');
CREATE TRIGGER "Payment_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "orderId" ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('orderId', 'Order');
CREATE TRIGGER "Ingredient_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "supplierId" ON "Ingredient"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('supplierId', 'Supplier');
CREATE TRIGGER "RecipeItem_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "productId", "ingredientId" ON "RecipeItem"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('productId', 'Product', 'ingredientId', 'Ingredient');
CREATE TRIGGER "Purchase_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "supplierId" ON "Purchase"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('supplierId', 'Supplier');
CREATE TRIGGER "PurchaseItem_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "purchaseId", "ingredientId" ON "PurchaseItem"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('purchaseId', 'Purchase', 'ingredientId', 'Ingredient');
CREATE TRIGGER "StockMovement_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "ingredientId" ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('ingredientId', 'Ingredient');
CREATE TRIGGER "Invoice_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "rangeId", "paymentId" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('rangeId', 'InvoiceRange', 'paymentId', 'Payment');
CREATE TRIGGER "SaleLine_tenant_guard" BEFORE INSERT OR UPDATE OF "restaurantId", "paymentId" ON "SaleLine"
  FOR EACH ROW EXECUTE FUNCTION "tenant_guard"('paymentId', 'Payment');
