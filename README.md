# Ristemo — Sistema para restaurantes (by IMZA)

Punto de venta para restaurantes: mesas, comandas, pantalla de cocina, cobro (total o dividido, efectivo/tarjeta), tickets y panel de administración.

## Pantallas

- `/`: plano de mesas en vivo para meseros (entran con su PIN). Cada mesa muestra si está libre, ocupada (con total y tiempo) o con pedido listo en cocina; también hay vista de lista.
- `/admin/mesas`: editor del plano. Crea salas (Salón, Terraza…), agrega mesas cuadradas, redondas o rectangulares desde la paleta y arrástralas a su lugar.
- `/llevar`: pedidos para llevar. Se pueden atender varios a la vez; cada uno exige el nombre del cliente (y opcionalmente su teléfono). Se agrupan en *Listos para entregar* (no se entregan sin cobrar), *En curso* y *Entregados hoy*.
- Cualquier cuenta de mesa puede llevar un **nombre de referencia** opcional ("Familia López"), visible en el plano, la cocina y el panel.
- `/cocina`: pantalla de cocina. Muestra lo pendiente por mesa con el tiempo de espera; el cocinero marca cada plato como listo y el mesero ve el aviso en la mesa. En *Panel → Menú* eliges qué categorías van a cocina (por ejemplo, desactiva Bebidas).
- Fotos de productos (*Panel → Menú*, al crear o editar un producto): se eligen o se toman con el celular, el navegador las recorta a 4:3 y las reduce (~100 KB) antes de subirlas, y se ven en el menú del panel y en los botones del punto de venta. Se guardan en un almacenamiento S3 (MinIO, Cloudflare R2…) si está configurado, o en disco (`UPLOAD_DIR`), siempre separadas por restaurante. El sistema las entrega por `/media/…` y cada restaurante solo ve las suyas, así que el bucket no tiene que ser público.
- Descuentos al cobrar: porcentaje, monto, cortesía o tercera edad / discapacidad, a toda la cuenta o a un producto. Quien cobra aplica descuentos hasta el límite del restaurante; más que eso, y las cortesías, piden el PIN de un encargado (*Personal → Encargado*). Tercera edad pide nombre e identidad del beneficiario y la factura sale a su nombre. El ISV se recalcula sobre el precio rebajado y la factura muestra *Descuentos y rebajas otorgados*. Límite y % de tercera edad en *Ajustes → Negocio*; el reporte de ventas muestra cuánto se descontó, de qué tipo y quién lo aplicó o autorizó.
- Pre-cuenta y propina: desde la cuenta de la mesa se imprime la **pre-cuenta** con el consumo, la propina sugerida (10% por defecto) y el total con propina. Al cobrar se pregunta si el cliente deja propina (*No* por defecto, *Sí* con el % sugerido u *Otro monto*). Por ley es voluntaria y no puede ir dentro de los importes de la factura: si se acepta, se guarda aparte, no lleva ISV y se imprime debajo del total de la factura o ticket como *Propina voluntaria* y *Total a pagar*. El cierre de caja y el reporte de ventas muestran las propinas por mesero, en efectivo y con tarjeta. Se activa y se ajusta en *Ajustes → Negocio → Propina*.
- Formas de pago: al cobrar se elige *Efectivo*, *Tarjeta*, *Transferencia* o *Mixto*. La transferencia admite el número de referencia del comprobante (sale en el ticket, la factura y en *Reportes → Cobros*, donde también se puede buscar). En mixto se elige *Efectivo + tarjeta* o *Efectivo + transferencia*, se escribe cuánto va por la otra vía y el resto se cobra en efectivo, con su cálculo de cambio. El cierre de caja muestra efectivo, tarjeta y transferencias por separado (solo el efectivo está en el cajón), y el reporte de ventas suma cada parte donde corresponde; las propinas pagadas con tarjeta o transferencia se cuentan juntas porque hay que entregarlas en efectivo.
- Combos (*Panel → Menú → Nuevo combo*): se arman por partes (Plato, Acompañante, Bebida…). Una parte con un solo producto va fija; con varios, el mesero elige al pedir y cada opción puede tener recargo. Cocina recibe los platos del combo, el ticket muestra lo elegido y el inventario descuenta cada componente según su receta.
- `/admin/inventario`: inventario. Insumos con stock mínimo e ideal, proveedores, compras (pagadas o a crédito, con costo promedio), recetas por plato con su costo de alimento, mermas, conteo físico y kardex. Al cobrar se descuenta del stock lo que lleva cada plato según su receta; lo que llega al mínimo aparece en la lista de compras sugerida (agrupada por proveedor) y con alerta en el menú del panel. Los productos sin receta no se controlan.
- `/admin/gastos`: gastos que no son inventario (alquiler, luz, agua, internet, sueldos, IHSS/RAP, mantenimiento, publicidad, honorarios, comisiones…). Cada gasto lleva fecha, categoría, proveedor (registrado o escrito con su RTN), si tiene **factura con CAI** o no, y cómo viene el impuesto: ISV 15%, 18%, exento o mixto (el ISV se calcula solo y se puede corregir para que cuadre con la factura). También la forma de pago (de la caja del turno, otro efectivo, transferencia, tarjeta, cheque o a crédito para marcarlo pagado después) y una foto opcional de la factura. Se anulan con motivo, sin borrarse. Con factura, su ISV suma al crédito fiscal y entra al libro de compras; para la utilidad cuentan sin ese ISV, y sin factura cuentan completos. Los pagados de la caja se restan en el cierre de caja del turno. Se descargan en CSV.
- `/admin/facturacion`: facturación de Honduras (Régimen de Facturación SAR). Datos del obligado tributario, rangos CAI con fecha límite (el correlativo se asigna sin repetirse y pasa solo al siguiente rango), ISV 15%, 18% o exento por producto (los precios incluyen ISV y la factura lo desglosa; los combos reparten su precio entre componentes), factura POS de 80 mm con los campos obligatorios, RTN del cliente opcional al cobrar, anulación y reemisión, alertas de rango por agotarse o vencer y libro de ventas mensual en CSV.
- `/admin/reportes`: reportes con filtro de periodo (hoy, ayer, 7/30 días, mes, mes anterior, año o rango) y comparación contra el periodo anterior. *Ventas* (por día, horas pico, día de la semana, formas de pago, canal y mesero), *Productos* (ranking con costo y margen, categorías, menos vendidos e ingeniería de menú), *Cobros* (todos los cobros del periodo, con factura o solo recibo, con búsqueda y botón para reimprimir la copia tal como se emitió), *Ganancias* (estado de resultados: ventas netas, costo de lo vendido, mermas, faltantes, gastos de operación y utilidad neta), *Impuestos SAR* (débito fiscal de facturas, crédito fiscal del ISV de compras y gastos, ISV a pagar, libro de ventas y libro de compras) y *Cierre de caja*. Todo se descarga en CSV para Excel o se imprime / guarda en PDF.
- `/admin`: panel de administración. Cada persona entra con su correo y contraseña (ver *Acceso al panel*).
- `/admin/ajustes`: datos del negocio (nombre, dirección, teléfono y RTN del ticket, y el logo que sale en recibos y facturas, impreso en gris para impresoras térmicas), cuentas con acceso al panel y *Mi cuenta* (cambiar contraseña, cerrar sesiones en otros aparatos).

Stack: Next.js 16 · React 19 · Prisma 7 · PostgreSQL · Tailwind v4.

## Varios restaurantes (SaaS)

Una sola instalación atiende a varios restaurantes. Cada uno entra por su subdominio (`elbuensabor.tudominio.com`) y solo ve sus datos: mesas, menú, personal, inventario, facturas y reportes. Los PIN, números de mesa, nombres de categoría y rangos CAI pueden repetirse entre restaurantes.

- El aislamiento es automático: el cliente de Prisma (`lib/prisma.ts`) filtra y firma cada consulta con el restaurante de la petición (`lib/tenant.ts`). Para tareas de la plataforma existe `rootPrisma` (`lib/prisma-base.ts`), sin filtro.
- Segunda barrera en PostgreSQL: los triggers `tenant_guard` impiden que una fila apunte a otra de un restaurante distinto, y un INSERT sin restaurante falla.
- Una dirección sin subdominio abre el restaurante por defecto, salvo en el dominio principal (ver *Página de venta*); un subdominio que no existe muestra "Restaurante no encontrado". Un restaurante con `status = SUSPENDED` queda bloqueado.
- Los restaurantes se crean y se suspenden desde el panel de la plataforma (abajo). Para probar en tu compu entra a `http://<slug>.localhost:3000`.

### Página de venta

En el dominio principal (`PLATFORM_HOST` o `ROOT_DOMAIN`, con o sin `www`; en desarrollo, `http://localhost:3000`), `/` muestra la página que vende Ristemo: funciones, pantallas de ejemplo, precios y preguntas. Los precios salen de los planes activos, y los botones llevan a `/registro` si el registro público está activo o, si no, al WhatsApp de soporte (*Plataforma → Ajustes*). Si la base no responde, la página se muestra igual, sin precios.

- Las pantallas de un restaurante (`/login`, `/admin`, `/cocina`, `/llevar`, `/mesa`) abiertas en el dominio principal se redirigen al subdominio del restaurante por defecto (`principal.tudominio.com`). Sus meseros y su cocina deben usar esa dirección.
- Sin `PLATFORM_HOST` ni `ROOT_DOMAIN` (instalación de un solo restaurante), `/` sigue siendo el punto de venta.

## Plataforma (`/plataforma`)

Panel del equipo que vende y administra Ristemo. Solo abre en el dominio principal (o en `PLATFORM_HOST`), nunca en el subdominio de un restaurante, y usa cuentas propias: una cuenta de restaurante no entra aquí.

- **Restaurantes:** lista con búsqueda, ventas de los últimos 30 días, última venta y alerta de los que dejaron de vender. *Nuevo restaurante* lo crea con la cuenta de su dueño y muestra un mensaje listo para enviar con la dirección, el correo y la contraseña temporal.
- **Detalle:** nombre, subdominio y notas internas; **suspender / reactivar** (bloquea punto de venta, cocina y panel sin borrar nada); cuentas del restaurante y contraseña temporal nueva para un dueño que olvidó la suya.
- **Entrar como soporte:** desde la página del restaurante, con un motivo obligatorio, se abre su panel en otra pestaña con permisos de dueño, sin pedirle su contraseña. La sesión dura 2 horas y no se renueva, y el enlace de entrada sirve una sola vez y vence en 2 minutos. Mientras dura, el panel muestra un aviso de *Modo soporte* con un botón para salir y volver a la plataforma. El dueño ve cada acceso (quién, cuándo y por qué) en *Ajustes → Acceso al panel* y puede cerrar el acceso abierto.
- **Equipo:** quién tiene acceso a la plataforma. **Mi cuenta:** cambiar la contraseña.

## Suscripciones y cobro

- **Planes** (*Plataforma → Ajustes*): nombre, precio mensual y límites opcionales de meseros y de cuentas del panel. Un plan retirado deja de ofrecerse, pero quien lo tiene lo conserva. Al llegar al límite, el restaurante ve un aviso al intentar agregar más.
- **Vencimiento:** cada restaurante tiene una fecha de *pagado hasta* (último día pagado). Los restaurantes nuevos empiezan con la prueba gratis (días configurables). Sin fecha, no vence nunca, como el restaurante que ya usaba el sistema.
- **Cobro manual:** en la página del restaurante, *Registrar pago* (monto, meses, forma de pago y referencia) alarga el vencimiento desde el día siguiente al último pagado, o desde hoy si ya había vencido. El vencimiento también se puede ajustar a mano para corregir o regalar días.
- **Avisos y bloqueo:** 7 días antes de vencer, y durante los días de gracia, el panel del restaurante muestra un aviso con *Cómo pagar*. Pasada la gracia se bloquean el punto de venta, la cocina y el panel, con las instrucciones de pago y el contacto de soporte. Al registrar el pago se desbloquea solo. La suspensión manual sigue siendo aparte.
- **El restaurante ve** su plan, vencimiento, uso de límites, cómo pagar e historial de pagos en *Ajustes → Suscripción*.
- La lista de la plataforma muestra el ingreso mensual (planes de los que ya pagan), los restaurantes por cobrar, en prueba y bloqueados.

## Registro público (`/registro`)

- Se activa en *Plataforma → Ajustes → Registro público*. Necesita `ROOT_DOMAIN` y conviene tener el certificado comodín: sin él, la dirección de cada restaurante nuevo no funciona hasta agregarla en Coolify.
- El restaurante elige su nombre y su dirección (se revisa en vivo si está libre), y crea la cuenta del dueño con su propia contraseña. Empieza con la prueba gratis y el plan configurado para registros, y entra directo a su panel con un enlace de un solo uso que vence a los 10 minutos.
- Freno contra abuso: máximo 3 registros por hora desde la misma conexión, más un campo trampa para bots.
- En el panel, **Primeros pasos** guía la configuración (datos del negocio, mesas, menú, personal, facturación opcional y primera venta). Cada paso se marca solo, y la tarjeta desaparece al completar lo necesario.
- **Primer usuario:** desde la terminal del contenedor, `node scripts/plataforma-usuario.mjs <correo> "<Nombre>"` (también sirve para recuperar el acceso). Imprime una contraseña temporal.
- Scripts equivalentes, por si no hay acceso al panel: `node scripts/nuevo-restaurante.mjs <slug> "<Nombre>" <correo-del-dueño>` y `node scripts/acceso-dueno.mjs <slug> <correo>` (el restaurante sin subdominio es `principal`).

## Acceso al panel

- Cada restaurante tiene sus cuentas: **Dueño** (todo, más datos del negocio y quién tiene acceso) y **Administrador** (todo el panel). Se manejan en *Ajustes → Acceso al panel*: dar acceso, contraseña temporal nueva, cambiar rol, desactivar o eliminar.
- Las cuentas nuevas reciben una contraseña temporal y deben poner una propia al primer ingreso.
- Contraseñas guardadas con scrypt. Las sesiones viven en la base de datos (la cookie solo tiene un token al azar), vencen tras 7 días sin uso, valen solo en su restaurante y se cierran al cambiar la contraseña o desactivar la cuenta.
- Tras varios intentos fallidos se bloquea un rato el correo (y la IP), igual que el PIN de los meseros. La cookie del mesero va firmada.
- **Primer acceso:** un restaurante sin cuentas (como el local que ya usaba el sistema) muestra en `/login` el formulario para crear la cuenta del dueño, protegido con la clave de instalación `ADMIN_PASSWORD`.

## Desarrollo local

```bash
cp .env.example .env   # y ajusta DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev
```

Abre http://localhost:3000. En desarrollo, si no defines `ADMIN_PASSWORD`, la clave de instalación (para crear la primera cuenta del dueño) es `12345`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. |
| `ADMIN_PASSWORD` | Sí (producción) | Clave de instalación: se pide solo para crear la cuenta del dueño en un restaurante que aún no tiene cuentas. Ya no sirve para entrar al panel. |
| `SESSION_SECRET` | Recomendada | Cadena larga y aleatoria para firmar la cookie de los meseros. |
| `ROOT_DOMAIN` | Para varios restaurantes | Dominio base de los subdominios, p. ej. `ristemo.com` → `<slug>.ristemo.com`. |
| `PLATFORM_HOST` | No | Única dirección donde abre `/plataforma` (p. ej. `ristemo.com`). Si no se define, abre en cualquier dirección sin subdominio de restaurante. |
| `DEFAULT_RESTAURANT` | No | Slug del restaurante que abre la dirección sin subdominio. Por defecto, el primero (`principal`). |
| `S3_ENDPOINT` | Para fotos en S3 | Dirección de la API S3, p. ej. `https://minio.tudominio.com` (MinIO) o la de Cloudflare R2. |
| `S3_BUCKET` | Para fotos en S3 | Bucket de las fotos, p. ej. `ristemo-fotos`. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Para fotos en S3 | Clave con permiso solo sobre ese bucket (no uses la de administrador). |
| `S3_REGION` / `S3_PREFIX` | No | Región (por defecto `us-east-1`; en R2 `auto`) y carpeta dentro del bucket, si se comparte. |
| `UPLOAD_DIR` | Si no hay S3 | Carpeta de las fotos en disco. El Dockerfile la define en `/app/uploads`; en Coolify móntale un volumen persistente. En desarrollo usa `./uploads`. |
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
4. **Dominio:** asígnale un dominio con HTTPS (Coolify genera el certificado). Para varios restaurantes, mira *Subdominios de los restaurantes*.
5. **Fotos de productos** (elige una):
   - **MinIO u otro S3 (recomendado):** en la consola de MinIO crea el bucket `ristemo-fotos` (privado) y, en *Access Keys → Create Access Key*, una clave con una política que solo permita ese bucket:
     ```json
     {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::ristemo-fotos/*"]}]}
     ```
     Luego agrega en la aplicación `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`. Respalda MinIO (o el bucket) fuera del servidor.
   - **Volumen:** *Persistent Storage → + Add → Volume Mount* con *Destination Path* `/app/uploads`. Sin esto, las fotos se borran en cada despliegue.
6. **Deploy.** Al arrancar, el contenedor aplica las migraciones pendientes (`prisma migrate deploy`) y luego inicia el servidor.

La base empieza vacía: entra a `/admin` y crea mesas, categorías, productos y meseros.

### Subdominios de los restaurantes

Ejemplo con `ristemo.com`; cambia por tu dominio.

1. **DNS:** en tu proveedor de dominio crea un registro `A` con nombre `*` (comodín) que apunte a la IP del servidor de Coolify, además del registro del dominio principal. Así cualquier `algo.ristemo.com` llega al servidor.
2. **Variable:** agrega `ROOT_DOMAIN=ristemo.com` a la aplicación (y, si quieres, `PLATFORM_HOST=ristemo.com`).
3. **Dominios en Coolify** — elige una forma:
   - **Simple (pocos restaurantes):** en *Domains* de la aplicación agrega cada restaurante separado por coma: `https://ristemo.com,https://elfogon.ristemo.com,https://laesquina.ristemo.com`, y vuelve a desplegar. Coolify saca un certificado por cada uno sin configurar nada más. La página de cada restaurante en la plataforma te muestra la dirección exacta para copiar.
   - **Comodín (muchos restaurantes):** agrega `https://*.ristemo.com` una sola vez. El certificado comodín de Let's Encrypt exige el reto por DNS: en *Servers → Proxy* configura Traefik con el proveedor DNS de tu dominio (por ejemplo, Cloudflare con un token de API) según la guía de Coolify para *wildcard certificates*. Con eso los restaurantes nuevos funcionan sin volver a desplegar.
4. Crea el restaurante en `/plataforma` y prueba su dirección. El restaurante que ya existía pasa a su subdominio (`principal.ristemo.com`): agrégalo en *Domains* si no usas el comodín. El dominio principal muestra la página de venta.
