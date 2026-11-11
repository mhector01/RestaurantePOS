# POS Restaurante

Punto de venta para restaurantes: mesas, comandas, pantalla de cocina, cobro (total o dividido, efectivo/tarjeta), tickets y panel de administración.

## Pantallas

- `/`: plano de mesas para meseros (entran con su PIN).
- `/cocina`: pantalla de cocina. Muestra lo pendiente por mesa con el tiempo de espera; el cocinero marca cada plato como listo y el mesero ve el aviso en la mesa. En *Panel → Menú* eliges qué categorías van a cocina (por ejemplo, desactiva Bebidas).
- `/admin`: panel del dueño (contraseña `ADMIN_PASSWORD`).

Stack: Next.js 16 · React 19 · Prisma 7 · PostgreSQL · Tailwind v4.

## Desarrollo local

```bash
cp .env.example .env   # y ajusta DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev
```

Abre http://localhost:3000. En desarrollo, si no defines `ADMIN_PASSWORD`, la contraseña del panel es `12345`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. |
| `ADMIN_PASSWORD` | Sí (producción) | Contraseña del panel `/admin`. Sin ella no se puede entrar al panel en producción. |
| `SESSION_SECRET` | Recomendada | Cadena larga y aleatoria para firmar la sesión de admin. |
| `TZ` | No | Zona horaria para "ventas de hoy" y horas del ticket. Por defecto `America/Tegucigalpa`. |
| `NEXT_PUBLIC_BUSINESS_NAME` | No | Nombre del negocio (ticket y título). **Build variable.** |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | No | Dirección en el ticket. **Build variable.** |
| `NEXT_PUBLIC_BUSINESS_TAX_ID` | No | RTN / RFC / NIT en el ticket. **Build variable.** |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | No | Símbolo de moneda, p. ej. `L` o `$`. **Build variable.** |
| `NEXT_PUBLIC_LOCALE` | No | Formato de números, p. ej. `es-HN`. **Build variable.** |

Las `NEXT_PUBLIC_*` se incrustan al compilar: si las cambias hay que volver a desplegar.

## Despliegue en Coolify

1. **Base de datos:** en el proyecto, *+ New → Database → PostgreSQL*. Copia su URL interna (*Postgres URL (internal)*).
2. **Aplicación:** *+ New → Application* desde el repositorio de GitHub, rama `main`, **Build Pack: Dockerfile**. Puerto expuesto: `3000`.
3. **Variables:** agrega `DATABASE_URL` (la URL interna del paso 1), `ADMIN_PASSWORD`, `SESSION_SECRET` y, si quieres, las `NEXT_PUBLIC_*` marcadas como *Build Variable*.
4. **Dominio:** asígnale un dominio con HTTPS (Coolify genera el certificado).
5. **Deploy.** Al arrancar, el contenedor aplica las migraciones pendientes (`prisma migrate deploy`) y luego inicia el servidor.

La base empieza vacía: entra a `/admin` y crea mesas, categorías, productos y meseros.
