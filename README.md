# Ristemo — Sistema para restaurantes (by IMZA)

Punto de venta para restaurantes: mesas, comandas, pantalla de cocina, cobro (total o dividido, efectivo/tarjeta), tickets y panel de administración.

## Pantallas

- `/`: plano de mesas en vivo para meseros (entran con su PIN). Cada mesa muestra si está libre, ocupada (con total y tiempo) o con pedido listo en cocina; también hay vista de lista.
- `/admin/mesas`: editor del plano. Crea salas (Salón, Terraza…), agrega mesas cuadradas, redondas o rectangulares desde la paleta y arrástralas a su lugar.
- `/llevar`: pedidos para llevar. Se pueden atender varios a la vez; cada uno exige el nombre del cliente (y opcionalmente su teléfono). Se agrupan en *Listos para entregar* (no se entregan sin cobrar), *En curso* y *Entregados hoy*.
- Cualquier cuenta de mesa puede llevar un **nombre de referencia** opcional ("Familia López"), visible en el plano, la cocina y el panel.
- `/cocina`: pantalla de cocina. Muestra lo pendiente por mesa con el tiempo de espera; el cocinero marca cada plato como listo y el mesero ve el aviso en la mesa. En *Panel → Menú* eliges qué categorías van a cocina (por ejemplo, desactiva Bebidas).
- Combos (*Panel → Menú → Nuevo combo*): se arman por partes (Plato, Acompañante, Bebida…). Una parte con un solo producto va fija; con varios, el mesero elige al pedir y cada opción puede tener recargo. Cocina recibe los platos del combo, el ticket muestra lo elegido y el inventario descuenta cada componente según su receta.
- `/admin/inventario`: inventario. Insumos con stock mínimo e ideal, proveedores, compras (pagadas o a crédito, con costo promedio), recetas por plato con su costo de alimento, mermas, conteo físico y kardex. Al cobrar se descuenta del stock lo que lleva cada plato según su receta; lo que llega al mínimo aparece en la lista de compras sugerida (agrupada por proveedor) y con alerta en el menú del panel. Los productos sin receta no se controlan.
- `/admin/facturacion`: facturación de Honduras (Régimen de Facturación SAR). Datos del obligado tributario, rangos CAI con fecha límite (el correlativo se asigna sin repetirse y pasa solo al siguiente rango), ISV 15%, 18% o exento por producto (los precios incluyen ISV y la factura lo desglosa; los combos reparten su precio entre componentes), factura POS de 80 mm con los campos obligatorios, RTN del cliente opcional al cobrar, anulación y reemisión, alertas de rango por agotarse o vencer y libro de ventas mensual en CSV.
- `/admin/reportes`: reportes con filtro de periodo (hoy, ayer, 7/30 días, mes, mes anterior, año o rango) y comparación contra el periodo anterior. *Ventas* (por día, horas pico, día de la semana, formas de pago, canal y mesero), *Productos* (ranking con costo y margen, categorías, menos vendidos e ingeniería de menú), *Ganancias* (estado de resultados: ventas netas, costo de lo vendido, mermas y faltantes), *Impuestos SAR* (débito fiscal de facturas, crédito fiscal del ISV de compras, ISV a pagar, libro de ventas y libro de compras) y *Cierre de caja*. Todo se descarga en CSV para Excel o se imprime / guarda en PDF.
- `/admin`: panel del dueño (contraseña `ADMIN_PASSWORD`).

Stack: Next.js 16 · React 19 · Prisma 7 · PostgreSQL · Tailwind v4.

## Varios restaurantes (SaaS)

Una sola instalación atiende a varios restaurantes. Cada uno entra por su subdominio (`elbuensabor.tudominio.com`) y solo ve sus datos: mesas, menú, personal, inventario, facturas y reportes. Los PIN, números de mesa, nombres de categoría y rangos CAI pueden repetirse entre restaurantes.

- El aislamiento es automático: el cliente de Prisma (`lib/prisma.ts`) filtra y firma cada consulta con el restaurante de la petición (`lib/tenant.ts`). Para tareas de la plataforma existe `rootPrisma` (`lib/prisma-base.ts`), sin filtro.
- Segunda barrera en PostgreSQL: los triggers `tenant_guard` impiden que una fila apunte a otra de un restaurante distinto, y un INSERT sin restaurante falla.
- Una dirección sin subdominio (o con `www`) abre el restaurante por defecto; un subdominio que no existe muestra "Restaurante no encontrado". Un restaurante con `status = SUSPENDED` queda bloqueado.
- La sesión del panel vale solo para el restaurante donde se abrió. Por ahora todos usan la misma `ADMIN_PASSWORD`; las cuentas por restaurante vienen en la siguiente fase.
- Crear un restaurante: `node scripts/nuevo-restaurante.mjs <slug> "<Nombre>"` (en Coolify, desde la terminal del contenedor). Para probar en tu compu entra a `http://<slug>.localhost:3000`.

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
| `ROOT_DOMAIN` | Para varios restaurantes | Dominio base de los subdominios, p. ej. `ristemo.com` → `<slug>.ristemo.com`. |
| `DEFAULT_RESTAURANT` | No | Slug del restaurante que abre la dirección sin subdominio. Por defecto, el primero (`principal`). |
| `TZ` | No | Zona horaria para "ventas de hoy" y horas del ticket. Por defecto `America/Tegucigalpa`. |
| `NEXT_PUBLIC_BUSINESS_NAME` | No | Nombre del negocio (ticket y título) si el restaurante no tiene uno propio. **Build variable.** |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | No | Dirección en el ticket si el restaurante no tiene una propia. **Build variable.** |
| `NEXT_PUBLIC_BUSINESS_TAX_ID` | No | RTN / RFC / NIT en el ticket si el restaurante no tiene uno propio. **Build variable.** |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | No | Símbolo de moneda, p. ej. `L` o `$`. **Build variable.** |
| `NEXT_PUBLIC_LOCALE` | No | Formato de números, p. ej. `es-HN`. **Build variable.** |

Las `NEXT_PUBLIC_*` se incrustan al compilar: si las cambias hay que volver a desplegar.

## Despliegue en Coolify

1. **Base de datos:** en el proyecto, *+ New → Database → PostgreSQL*. Copia su URL interna (*Postgres URL (internal)*).
2. **Aplicación:** *+ New → Application* desde el repositorio de GitHub, rama `main`, **Build Pack: Dockerfile**. Puerto expuesto: `3000`.
3. **Variables:** agrega `DATABASE_URL` (la URL interna del paso 1), `ADMIN_PASSWORD`, `SESSION_SECRET` y, si quieres, las `NEXT_PUBLIC_*` marcadas como *Build Variable*.
4. **Dominio:** asígnale un dominio con HTTPS (Coolify genera el certificado). Para varios restaurantes, agrega también el comodín `https://*.tudominio.com`, crea en tu DNS un registro `*` que apunte al servidor y define `ROOT_DOMAIN`. El certificado comodín requiere el reto DNS de Let's Encrypt en el proxy de Coolify.
5. **Deploy.** Al arrancar, el contenedor aplica las migraciones pendientes (`prisma migrate deploy`) y luego inicia el servidor.

La base empieza vacía: entra a `/admin` y crea mesas, categorías, productos y meseros.
