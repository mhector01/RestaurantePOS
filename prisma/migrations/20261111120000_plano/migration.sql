-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "seats" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "shape" TEXT NOT NULL DEFAULT 'square',
ADD COLUMN     "x" INTEGER,
ADD COLUMN     "y" INTEGER;

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Crea la sala principal y le asigna las mesas existentes (no el mostrador, número 0)
INSERT INTO "Area" ("name", "position") VALUES ('Salón principal', 0);
UPDATE "Table" SET "areaId" = (SELECT "id" FROM "Area" ORDER BY "id" LIMIT 1) WHERE "number" <> 0;
