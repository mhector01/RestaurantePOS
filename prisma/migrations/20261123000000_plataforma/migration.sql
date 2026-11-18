-- Plataforma: equipo que administra los restaurantes, y datos internos de cada restaurante.

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE INDEX "PlatformSession_userId_idx" ON "PlatformSession"("userId");

-- AddForeignKey
ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
