# syntax=docker/dockerfile:1
# Imagen de producción para Coolify (o cualquier host con Docker).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat tzdata
WORKDIR /app

# --- Dependencias (postinstall ejecuta "prisma generate", por eso va el esquema) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# --- Build de Next.js ---
FROM base AS builder
# Los NEXT_PUBLIC_* se incrustan en el build: en Coolify márcalos como "Build Variable".
ARG NEXT_PUBLIC_BUSINESS_NAME
ARG NEXT_PUBLIC_BUSINESS_ADDRESS
ARG NEXT_PUBLIC_BUSINESS_TAX_ID
ARG NEXT_PUBLIC_CURRENCY_SYMBOL
ARG NEXT_PUBLIC_LOCALE
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- CLI de Prisma aislado, solo para aplicar migraciones al arrancar ---
FROM base AS migrator
WORKDIR /migrate
RUN npm init -y >/dev/null && npm install --no-audit --no-fund prisma@7.4.0 dotenv@17.3.1
COPY prisma ./prisma
COPY prisma.config.ts ./

# --- Imagen final ---
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/Tegucigalpa

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=migrator --chown=nextjs:nodejs /migrate ./migrate

USER nextjs
EXPOSE 3000

# Aplica migraciones pendientes y arranca el servidor.
CMD ["sh", "-c", "cd /app/migrate && node node_modules/prisma/build/index.js migrate deploy && cd /app && exec node server.js"]
