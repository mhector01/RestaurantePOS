import Image from "next/image";
import {
  ArrowRight,
  Camera,
  ChartColumn,
  Check,
  ChefHat,
  Cloud,
  FileText,
  HandCoins,
  KeyRound,
  Layers,
  LayoutGrid,
  Lock,
  Mail,
  MessageCircle,
  Package,
  Percent,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Wallet,
  Zap,
} from "lucide-react";
import { formatMoney } from "@/lib/config";
import { SYSTEM } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { CountUp, Reveal, StickyNav } from "./Reveal";
import {
  CheckoutMock,
  FloorMock,
  InventoryMock,
  InvoiceChip,
  InvoicePaper,
  KitchenMock,
  KitchenTicketChip,
  ReportsMock,
  SalesChip,
} from "./Mockups";

export interface LandingPlan {
  id: number;
  name: string;
  price: number;
  description: string;
  maxWaiters: number | null;
  maxAccounts: number | null;
}

interface Props {
  trialDays: number;
  signupHref: string | null;
  whatsapp: string | null;
  email: string | null;
  plans: LandingPlan[];
}

const NAV = [
  ["Funciones", "#funciones"],
  ["Cómo funciona", "#como-funciona"],
  ["Precios", "#precios"],
  ["Preguntas", "#preguntas"],
] as const;

const MODULES = [
  "Plano de mesas",
  "Pedidos para llevar",
  "Pantalla de cocina",
  "Combos",
  "Cuentas divididas",
  "Descuentos",
  "Propinas",
  "Facturación SAR",
  "Inventario",
  "Recetas y costeo",
  "Compras y proveedores",
  "Gastos",
  "Cierre de caja",
  "Reportes",
  "Utilidad neta",
  "Libros de ventas y compras",
];

const FEATURES = [
  {
    Icon: LayoutGrid,
    title: "Plano de mesas en vivo",
    text: "Dibuja tu salón, terraza o barra. Cada mesa muestra si está libre, ocupada (con total y tiempo) o con pedido listo.",
    span: "lg:col-span-2",
    accent: true,
  },
  { Icon: ChefHat, title: "Pantalla de cocina", text: "Las comandas llegan solas, con tiempo de espera. El mesero recibe el aviso cuando está listo." },
  { Icon: ShoppingBag, title: "Para llevar", text: "Varios pedidos a la vez, con nombre y teléfono del cliente. No se entrega nada sin cobrar." },
  { Icon: FileText, title: "Facturación SAR", text: "CAI, rangos con fecha límite, ISV 15%, 18% o exento, RTN del cliente y factura de 80 mm." },
  {
    Icon: Package,
    title: "Inventario con recetas",
    text: "Cada venta descuenta los insumos según la receta. Stock mínimo, mermas, conteo físico y kardex.",
    span: "lg:col-span-2",
    accent: true,
  },
  { Icon: ChartColumn, title: "Reportes que deciden", text: "Ventas, horas pico, meseros, ranking de platos, ingeniería de menú y utilidad neta." },
  { Icon: Wallet, title: "Gastos y crédito fiscal", text: "Alquiler, luz, sueldos… con o sin factura. El ISV de compras suma a tu crédito fiscal." },
  { Icon: Layers, title: "Combos", text: "Arma combos por partes; el mesero elige opciones con recargo y cocina recibe cada plato." },
  { Icon: Percent, title: "Descuentos con control", text: "Porcentaje, monto, cortesía o tercera edad. Lo que pasa el límite pide el PIN del encargado." },
  { Icon: HandCoins, title: "Pre-cuenta y propina", text: "Pre-cuenta con propina sugerida. La propina va aparte, sin ISV, y se reparte por mesero." },
  {
    Icon: Camera,
    title: "Fotos del menú",
    text: "Toma la foto con el celular; se recorta y optimiza sola para que el punto de venta vuele.",
    span: "lg:col-span-2",
  },
  {
    Icon: Printer,
    title: "Tickets y facturas",
    text: "Imprime en impresoras térmicas con tu logo, y reimprime cualquier cobro tal como salió.",
    span: "lg:col-span-2",
  },
];

const DEEP = [
  {
    id: "salon",
    kicker: "Salón y meseros",
    title: "Tu salón entero, en la palma de la mano",
    text: "Cada mesero entra con su PIN desde su celular o una tablet y toma pedidos en la mesa. Tú ves todo el salón en vivo: qué mesas están ocupadas, cuánto llevan y cuánto tiempo.",
    points: [
      "Editor de plano: mesas cuadradas, redondas o rectangulares que arrastras a su lugar",
      "Varias salas: Salón, Terraza, Barra…",
      "Cuentas con nombre de referencia (“Familia López”) visibles en cocina",
      "Cuentas divididas, efectivo o tarjeta",
    ],
    mock: "floor",
  },
  {
    id: "cocina",
    kicker: "Cocina",
    title: "Adiós a las comandas perdidas",
    text: "Lo que pide el mesero aparece al instante en la pantalla de cocina, ordenado por tiempo de espera. El cocinero marca cada plato como listo y el mesero ve el aviso en su mesa.",
    points: [
      "Tiempo de espera por pedido con alerta de atraso",
      "Eliges qué categorías van a cocina (las bebidas, por ejemplo, no)",
      "Mesas y pedidos para llevar en la misma pantalla",
      "Los combos llegan desglosados plato por plato",
    ],
    mock: "kitchen",
  },
  {
    id: "cobro",
    kicker: "Cobro",
    title: "Cobra rápido, sin errores y con control",
    text: "Pre-cuenta, descuentos, propina voluntaria y factura en un solo flujo. Cada descuento queda registrado: quién lo aplicó, quién lo autorizó y de qué tipo fue.",
    points: [
      "Descuentos por cuenta o por producto, con límite y PIN de encargado",
      "Tercera edad y discapacidad con nombre e identidad del beneficiario",
      "Propina voluntaria fuera de la factura, como pide la ley",
      "Recibo o factura, y reimpresión de cualquier cobro",
    ],
    mock: "checkout",
  },
  {
    id: "inventario",
    kicker: "Inventario",
    title: "Sabe cuánto te cuesta cada plato",
    text: "Registra tus insumos, recetas y compras. Al cobrar, el sistema descuenta del stock lo que lleva cada plato y te avisa qué está por acabarse, agrupado por proveedor para que solo copies y envíes el pedido.",
    points: [
      "Recetas con costo de alimento y margen por plato",
      "Compras pagadas o a crédito, con costo promedio",
      "Mermas, conteo físico y kardex de movimientos",
      "Lista de compras sugerida, lista para WhatsApp",
    ],
    mock: "inventory",
  },
  {
    id: "sar",
    kicker: "Facturación SAR · Honduras",
    title: "Factura en regla desde el primer día",
    text: "Hecho para el Régimen de Facturación del SAR. Configura tus rangos CAI y el sistema asigna el correlativo sin repetir, pasa solo al siguiente rango y te avisa antes de que se agote o venza.",
    points: [
      "ISV 15%, 18% o exento por producto, desglosado en la factura",
      "RTN del cliente opcional al cobrar; anulación y reemisión",
      "Libro de ventas y libro de compras mensual en CSV",
      "Débito fiscal, crédito fiscal e ISV a pagar, ya calculados",
    ],
    mock: "invoice",
  },
  {
    id: "reportes",
    kicker: "Reportes y utilidad",
    title: "Números claros para decidir",
    text: "Compara cualquier periodo contra el anterior. Mira qué se vende, a qué hora, quién vende más y, sobre todo, cuánto ganas de verdad después de costos y gastos.",
    points: [
      "Ventas por día, hora pico, día de la semana, canal y mesero",
      "Ranking de productos con costo, margen e ingeniería de menú",
      "Estado de resultados: ventas, costo, mermas, gastos y utilidad neta",
      "Cierre de caja por turno con efectivo, tarjeta, gastos y propinas",
    ],
    mock: "reports",
  },
] as const;

const ROLES = [
  { Icon: Store, who: "Dueño", text: "Ve ventas, utilidad e impuestos desde cualquier lugar, y decide quién tiene acceso al panel." },
  { Icon: Smartphone, who: "Mesero", text: "Entra con su PIN, toma pedidos en la mesa y sabe cuándo su comida está lista." },
  { Icon: ChefHat, who: "Cocina", text: "Una pantalla con lo pendiente y el tiempo de cada pedido. Un toque y está listo." },
  { Icon: Receipt, who: "Caja y administración", text: "Cobra, factura, registra gastos y compras, y cierra el turno con todo cuadrado." },
];

const SECURITY = [
  { Icon: Lock, title: "Tus datos, solo tuyos", text: "Cada restaurante vive aislado con doble barrera: en la aplicación y en la base de datos." },
  { Icon: KeyRound, title: "Accesos con control", text: "Cuentas de dueño y administrador, PIN por mesero y bloqueo tras intentos fallidos." },
  { Icon: ShieldCheck, title: "Soporte transparente", text: "Si te ayudamos desde dentro, ves quién entró, cuándo y por qué, y puedes cerrar el acceso." },
  { Icon: Cloud, title: "En la nube", text: "Sin instalar nada: funciona en el navegador de tu celular, tablet o computadora." },
];

function limitText(n: number | null, one: string, many: string) {
  if (n == null) return `${many[0].toUpperCase()}${many.slice(1)} ilimitados`;
  return `Hasta ${n} ${n === 1 ? one : many}`;
}

function Mock({ kind }: { kind: (typeof DEEP)[number]["mock"] }) {
  switch (kind) {
    case "floor":
      return <FloorMock />;
    case "kitchen":
      return <KitchenMock />;
    case "checkout":
      return <CheckoutMock />;
    case "inventory":
      return <InventoryMock />;
    case "invoice":
      return (
        <div className="relative py-6">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-[#3987e5]/15 blur-2xl" />
          <div className="relative">
            <InvoicePaper />
          </div>
        </div>
      );
    case "reports":
      return <ReportsMock />;
  }
}

export function Landing({ trialDays, signupHref, whatsapp, email, plans }: Props) {
  const trial = trialDays > 0 ? `${trialDays} días gratis` : null;
  const contactHref = whatsapp ?? (email ? `mailto:${email}` : "#preguntas");
  const primary = signupHref
    ? { href: signupHref, label: trial ? `Prueba ${trial}` : "Crear mi restaurante" }
    : { href: contactHref, label: "Solicitar una demo" };

  return (
    <div className="relative min-h-dvh bg-ink-950 text-ink-100 overflow-x-clip">
      {/* Fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60rem] overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[42rem] w-[70rem] rounded-full bg-[radial-gradient(closest-side,rgba(251,119,5,0.22),transparent)]" />
        <div className="absolute top-40 -right-40 h-[30rem] w-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(57,135,229,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      </div>

      <StickyNav>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-6">
          <a href="#inicio" className="shrink-0" aria-label={SYSTEM.name}>
            <Image src="/brand/ristemo-logo-dark.png" alt={`${SYSTEM.name} by ${SYSTEM.vendor}`} width={1200} height={442} priority className="h-9 w-auto" />
          </a>
          <div className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map(([l, h]) => (
              <a key={h} href={h} className="px-3 py-2 rounded-lg text-sm text-ink-300 hover:text-white hover:bg-white/5 transition-colors">
                {l}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {whatsapp && signupHref && (
              <a href={whatsapp} className="hidden sm:inline-flex h-10 items-center px-4 rounded-xl text-sm font-medium text-ink-200 hover:text-white hover:bg-white/5 transition-colors">
                Hablar con ventas
              </a>
            )}
            <a
              href={primary.href}
              className="inline-flex h-10 items-center gap-1.5 px-4 rounded-xl bg-primary text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(251,119,5,0.8)] hover:brightness-110 transition"
            >
              {signupHref ? "Empezar gratis" : "Solicitar demo"} <ArrowRight className="size-4" />
            </a>
          </div>
        </nav>
      </StickyNav>

      <main id="inicio">
        {/* HERO */}
        <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-32 sm:pt-40 pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-10 items-center">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 pl-1.5 pr-3.5 py-1 text-xs font-medium text-orange-200">
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Nuevo</span>
                Gastos, crédito fiscal y utilidad neta
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.2rem] font-semibold tracking-[-0.035em] text-white text-balance">
                El sistema que pone{" "}
                <span className="bg-gradient-to-r from-[#ff9a3d] via-primary to-[#ffc078] bg-clip-text text-transparent">tu restaurante</span>{" "}
                en orden.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 text-lg sm:text-xl text-ink-300 max-w-xl text-pretty">
                Mesas, cocina, cobro, inventario, facturación SAR y reportes de utilidad. Todo conectado, en la nube y desde cualquier
                celular, tablet o computadora.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <a
                  href={primary.href}
                  className="group inline-flex h-13 items-center justify-center gap-2 px-7 rounded-2xl bg-primary text-base font-semibold text-white shadow-[0_14px_40px_-10px_rgba(251,119,5,0.9)] hover:brightness-110 transition"
                >
                  {primary.label}
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a
                  href="#funciones"
                  className="inline-flex h-13 items-center justify-center gap-2 px-7 rounded-2xl border border-white/12 bg-white/[0.03] text-base font-medium text-white hover:bg-white/[0.07] transition"
                >
                  Ver todo lo que hace
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-300">
                {[trial ? `${trial}, sin tarjeta` : "Demo sin compromiso", "Sin instalar nada", "Hecho para Honduras"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative">
            <div className="relative mx-auto max-w-xl lg:max-w-none">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-primary/25 via-transparent to-[#3987e5]/25 blur-3xl" />
              <div className="relative [transform:perspective(1600px)_rotateY(-8deg)_rotateX(4deg)] motion-reduce:transform-none">
                <FloorMock />
              </div>
              <div className="hidden sm:block absolute -left-10 -bottom-10 animate-[landing-float_7s_ease-in-out_infinite] motion-reduce:animate-none">
                <KitchenTicketChip />
              </div>
              <div className="hidden sm:block absolute -right-6 -top-10 animate-[landing-float_8s_ease-in-out_infinite_1s] motion-reduce:animate-none">
                <SalesChip />
              </div>
              <div className="hidden md:block absolute -right-10 bottom-16 animate-[landing-float_6s_ease-in-out_infinite_0.5s] motion-reduce:animate-none">
                <InvoiceChip />
              </div>
            </div>
          </Reveal>
        </section>

        {/* Cinta de módulos */}
        <section aria-label="Módulos incluidos" className="relative border-y border-white/8 bg-white/[0.015] py-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max animate-[landing-marquee_40s_linear_infinite] motion-reduce:animate-none">
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-10 pr-10">
                {MODULES.map((m) => (
                  <li key={m} className="flex items-center gap-10 text-sm font-medium text-ink-300 whitespace-nowrap">
                    {m}
                    <span className="size-1.5 rounded-full bg-primary/70" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* Cifras */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-3xl overflow-hidden border border-white/8 bg-white/8">
            {[
              { v: <CountUp to={16} />, l: "módulos conectados en un solo sistema" },
              { v: <CountUp to={6} />, l: "reportes listos, con descarga a Excel y PDF" },
              { v: <CountUp to={100} suffix="%" />, l: "en la nube: sin servidores ni instalaciones" },
              { v: <>0</>, l: "comandas perdidas entre el salón y la cocina" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 80} className="bg-ink-950 p-6 sm:p-8">
                <p className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">{s.v}</p>
                <p className="mt-2 text-sm text-ink-400 text-pretty">{s.l}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FUNCIONES (bento) */}
        <section id="funciones" className="scroll-mt-20 mx-auto max-w-7xl px-4 sm:px-6 pb-24">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Todo incluido</p>
            <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white text-balance">
              Un solo sistema para todo tu restaurante
            </h2>
            <p className="mt-4 text-lg text-ink-300 text-pretty">
              Deja de juntar libretas, hojas de Excel y tres aplicaciones distintas. Con {SYSTEM.name}, cada venta mueve la cocina, el inventario,
              la caja y tus impuestos al mismo tiempo.
            </p>
          </Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 4) * 70}
                className={cn(
                  "group relative rounded-3xl border border-white/8 p-6 overflow-hidden transition-colors hover:border-white/15",
                  f.accent ? "bg-gradient-to-br from-primary/[0.13] via-ink-900 to-ink-900" : "bg-ink-900/60",
                  "span" in f && f.span,
                )}
              >
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative grid size-11 place-items-center rounded-2xl bg-white/[0.06] border border-white/10">
                  <f.Icon className="size-5 text-primary" />
                </span>
                <h3 className="relative mt-5 text-lg font-semibold text-white">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-300">{f.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Recorrido por módulos */}
        <section id="como-funciona" className="scroll-mt-20 relative">
          {DEEP.map((d, i) => (
            <div key={d.id} id={d.id} className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <Reveal className={cn(i % 2 === 1 && "lg:order-2")}>
                <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">{d.kicker}</p>
                <h2 className="mt-3 text-3xl sm:text-[2.6rem] leading-tight font-semibold tracking-[-0.03em] text-white text-balance">{d.title}</h2>
                <p className="mt-4 text-lg text-ink-300 text-pretty">{d.text}</p>
                <ul className="mt-7 space-y-3.5">
                  {d.points.map((p) => (
                    <li key={p} className="flex gap-3 text-ink-200">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15">
                        <Check className="size-3 text-primary" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={120} className={cn("relative", i % 2 === 1 && "lg:order-1")}>
                <Mock kind={d.mock} />
              </Reveal>
            </div>
          ))}
        </section>

        {/* Para cada persona */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24">
          <Reveal className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Para todo tu equipo</p>
            <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white text-balance">Cada quien, con lo que necesita</h2>
          </Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLES.map((r, i) => (
              <Reveal key={r.who} delay={i * 80} className="rounded-3xl border border-white/8 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
                <r.Icon className="size-7 text-primary" />
                <h3 className="mt-5 text-lg font-semibold text-white">{r.who}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{r.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Empieza en minutos */}
        <section className="relative py-24 border-y border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Empieza hoy</p>
              <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white text-balance">Vendiendo en minutos, no en semanas</h2>
            </Reveal>
            <ol className="mt-12 grid md:grid-cols-3 gap-4">
              {[
                {
                  Icon: Sparkles,
                  t: signupHref ? "Crea tu cuenta" : "Te creamos tu cuenta",
                  d: "Tu restaurante tiene su propia dirección (turestaurante.ristemo.com) y su cuenta de dueño.",
                },
                {
                  Icon: Zap,
                  t: "Sigue los primeros pasos",
                  d: "Una guía te lleva por los datos del negocio, mesas, menú, personal y facturación. Cada paso se marca solo.",
                },
                {
                  Icon: Receipt,
                  t: "Haz tu primera venta",
                  d: "Tus meseros entran con su PIN y empiezan a tomar pedidos. Así de simple.",
                },
              ].map((s, i) => (
                <Reveal as="li" key={s.t} delay={i * 100} className="relative rounded-3xl border border-white/8 bg-ink-900/60 p-7">
                  <span className="absolute top-6 right-7 text-6xl font-semibold text-white/[0.05] tabular">0{i + 1}</span>
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary text-white shadow-[0_10px_30px_-10px_rgba(251,119,5,0.9)]">
                    <s.Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.d}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Seguridad */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-24 grid lg:grid-cols-[1fr_1.3fr] gap-12 items-center">
          <Reveal>
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Seguro y confiable</p>
            <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white text-balance">Tu información, protegida</h2>
            <p className="mt-4 text-lg text-ink-300 text-pretty">
              Tus ventas, tu menú y tus clientes son tuyos. Nadie más los ve, y tú decides quién entra a tu panel.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={i * 80} className="rounded-3xl border border-white/8 bg-ink-900/60 p-6">
                <s.Icon className="size-6 text-emerald-400" />
                <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* PRECIOS */}
        <section id="precios" className="scroll-mt-20 mx-auto max-w-7xl px-4 sm:px-6 py-24">
          <Reveal className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Precios</p>
            <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white text-balance">Un pago mensual. Todo incluido.</h2>
            <p className="mt-4 text-lg text-ink-300">
              Todos los planes traen todos los módulos.{trial ? ` Empieza con ${trial}, sin tarjeta.` : ""}
            </p>
          </Reveal>
          {plans.length > 0 ? (
            <div
              className={cn(
                "mt-14 grid gap-5 mx-auto",
                plans.length === 1 ? "max-w-md" : plans.length === 2 ? "md:grid-cols-2 max-w-4xl" : "md:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {plans.map((p, i) => {
                const featured = plans.length >= 3 ? i === 1 : plans.length === 2 ? i === 1 : true;
                return (
                  <Reveal
                    key={p.id}
                    delay={i * 90}
                    className={cn(
                      "relative rounded-[1.75rem] p-8 flex flex-col",
                      featured
                        ? "bg-gradient-to-b from-primary/20 via-ink-900 to-ink-900 border border-primary/50 shadow-[0_30px_80px_-30px_rgba(251,119,5,0.6)]"
                        : "bg-ink-900/60 border border-white/8",
                    )}
                  >
                    {featured && plans.length > 1 && (
                      <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                        Más elegido
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                    {p.description && <p className="mt-1.5 text-sm text-ink-300">{p.description}</p>}
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-5xl font-semibold tracking-tight text-white tabular">{formatMoney(p.price).replace(/\.00$/, "")}</span>
                      <span className="text-ink-400">/ mes</span>
                    </p>
                    <ul className="mt-7 space-y-3 text-sm text-ink-200 flex-1">
                      {[
                        limitText(p.maxWaiters, "mesero", "meseros"),
                        limitText(p.maxAccounts, "cuenta del panel", "cuentas del panel"),
                        "Todos los módulos incluidos",
                        "Facturación SAR",
                        "Actualizaciones y soporte",
                      ].map((t) => (
                        <li key={t} className="flex gap-2.5">
                          <Check className="size-4 mt-0.5 shrink-0 text-primary" /> {t}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={primary.href}
                      className={cn(
                        "mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition",
                        featured ? "bg-primary text-white hover:brightness-110" : "bg-white/[0.07] text-white hover:bg-white/[0.12]",
                      )}
                    >
                      {signupHref ? (trial ? "Empezar prueba gratis" : "Empezar ahora") : "Solicitar este plan"}
                    </a>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <Reveal className="mt-12 max-w-xl mx-auto rounded-3xl border border-white/8 bg-ink-900/60 p-8 text-center">
              <p className="text-lg text-white font-semibold">Un plan a la medida de tu restaurante</p>
              <p className="mt-2 text-ink-300">Escríbenos y te armamos una propuesta según tus mesas y tu personal.</p>
              <a href={contactHref} className="mt-6 inline-flex h-12 items-center gap-2 px-6 rounded-2xl bg-primary text-sm font-semibold text-white">
                Pedir precio <ArrowRight className="size-4" />
              </a>
            </Reveal>
          )}
        </section>

        {/* PREGUNTAS */}
        <section id="preguntas" className="scroll-mt-20 mx-auto max-w-3xl px-4 sm:px-6 py-24">
          <Reveal className="text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.18em]">Preguntas frecuentes</p>
            <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white">¿Dudas? Aquí las resolvemos</h2>
          </Reveal>
          <div className="mt-12 divide-y divide-white/8 rounded-3xl border border-white/8 bg-ink-900/50">
            {[
              ["¿Tengo que instalar algo?", "No. Funciona desde el navegador en cualquier celular, tablet o computadora con internet. Tu restaurante tiene su propia dirección web."],
              ["¿Sirve para facturar ante el SAR?", "Sí. Maneja rangos CAI con fecha límite, correlativo sin repetir, ISV 15%, 18% o exento, RTN del cliente, factura de 80 mm con los campos obligatorios, anulación, y los libros de ventas y compras."],
              ["¿Qué impresora necesito?", "Cualquier impresora térmica de 80 mm que tu equipo pueda usar para imprimir. Tickets, pre-cuentas y facturas salen con tu logo."],
              ["¿Cuántos meseros y dispositivos puedo usar?", "Depende del plan. Cada mesero entra con su PIN desde el dispositivo que quieras: no cobramos por aparato."],
              ["¿Puedo controlar mi inventario?", "Sí. Registras insumos y recetas; cada venta descuenta del stock automáticamente y el sistema te avisa qué comprar, agrupado por proveedor."],
              ["¿Qué pasa con mis datos si dejo de pagar?", "Nada se borra. Recibes avisos antes del vencimiento y unos días de gracia; al ponerte al día todo vuelve a funcionar como lo dejaste."],
              ["¿Me ayudan a configurarlo?", "Sí. Una guía de primeros pasos te lleva paso a paso, y nuestro equipo de soporte te acompaña cuando lo necesites."],
            ].map(([q, a]) => (
              <details key={q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-white">
                  {q}
                  <Plus className="size-5 shrink-0 text-ink-400 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="pb-5 -mt-1 text-ink-300 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
          <Reveal className="relative overflow-hidden rounded-[2rem] border border-primary/30 bg-gradient-to-br from-primary via-[#e0610a] to-[#9c3d06] px-6 py-16 sm:px-16 sm:py-20 text-center">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.25),transparent_45%)]" />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-white text-balance">Tu restaurante merece un mejor sistema</h2>
              <p className="mt-4 text-lg text-white/85 max-w-2xl mx-auto">
                Menos errores, cobros más rápidos y números claros cada día. {trial ? `Pruébalo ${trial}.` : "Te lo mostramos sin compromiso."}
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={primary.href}
                  className="inline-flex h-13 items-center justify-center gap-2 px-8 rounded-2xl bg-white text-base font-semibold text-ink-950 hover:bg-orange-50 transition"
                >
                  {primary.label} <ArrowRight className="size-5" />
                </a>
                {whatsapp && (
                  <a
                    href={whatsapp}
                    className="inline-flex h-13 items-center justify-center gap-2 px-8 rounded-2xl border border-white/40 text-base font-semibold text-white hover:bg-white/10 transition"
                  >
                    <MessageCircle className="size-5" /> Escríbenos por WhatsApp
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid md:grid-cols-[1.5fr_1fr_1fr] gap-10">
          <div>
            <Image src="/brand/ristemo-logo-dark.png" alt={`${SYSTEM.name} by ${SYSTEM.vendor}`} width={1200} height={442} className="h-12 w-auto" />
            <p className="mt-4 text-sm text-ink-400 max-w-sm">
              {SYSTEM.tagline}: punto de venta, cocina, inventario, facturación SAR y reportes en un solo lugar.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Producto</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-400">
              {NAV.map(([l, h]) => (
                <li key={h}>
                  <a href={h} className="hover:text-white transition-colors">{l}</a>
                </li>
              ))}
            </ul>
          </div>
          {(whatsapp || email || signupHref) && (
          <div>
            <p className="text-sm font-semibold text-white">Contacto</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-400">
              {whatsapp && (
                <li>
                  <a href={whatsapp} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                    <Mail className="size-4" /> {email}
                  </a>
                </li>
              )}
              {signupHref && (
                <li>
                  <a href={signupHref} className="hover:text-white transition-colors">Crear mi restaurante</a>
                </li>
              )}
            </ul>
          </div>
          )}
        </div>
        <div className="border-t border-white/8">
          <p className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-ink-500">
            © {new Date().getFullYear()} {SYSTEM.name} by {SYSTEM.vendor}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
