"use client";

import { PricingSection } from "@/components/landing/PricingSection";
import { Button, Card, IconTile, Logo, StatusBadge } from "@/components/ui";
import {
  LICENSE_GRACE_DAYS,
  LICENSE_PLAN_INFO,
  SECOND_MODULE_PRICE,
  TRIAL_DAYS,
  formatUsd,
} from "@/config/license-pricing";
import { useAuth } from "@/contexts/auth-context";
import {
  ArrowRight,
  Banknote,
  Building2,
  Bus,
  Calendar,
  CalendarCheck,
  ChartColumn,
  Check,
  CircleCheck,
  ClipboardList,
  Globe,
  HeartHandshake,
  KeyRound,
  ListOrdered,
  Lock,
  type LucideIcon,
  MapPin,
  MessageCircle,
  MessageSquare,
  Minus,
  Plus,
  ServerCog,
  Smartphone,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FullkodCredit } from "@/components/FullkodCredit";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CONTACT_EMAIL = "contact@fullkod.com";

interface Feature {
  Icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: readonly Feature[] = [
  {
    Icon: Calendar,
    title: "Calendario Intuitivo",
    description:
      "Gestiona tus turnos con un calendario móvil-first. Vista lista, día y semana.",
  },
  {
    Icon: MessageSquare,
    title: "WhatsApp en piloto automático",
    description:
      "Confirmaciones, recordatorios, valoraciones post-visita y resumen diario para el dueño. Sin configurar nada.",
  },
  {
    Icon: Users,
    title: "Clientes",
    description:
      "Historial, notas y datos. Búsqueda instantánea por nombre o teléfono.",
  },
  {
    Icon: Smartphone,
    title: "Móvil nativo",
    description:
      "iOS y Android. Bajo consumo de datos, ideal para conexiones lentas.",
  },
  {
    Icon: CalendarCheck,
    title: "Sin dobles reservas",
    description:
      "Tu calendario siempre actualizado en tiempo real, sin solapes.",
  },
  {
    Icon: Tags,
    title: "Servicios por categorías",
    description:
      "Agrupa tu catálogo (bodas, cortes, consultas…) y destaca lo más pedido. Tus clientes encuentran rápido lo que buscan.",
  },
  {
    Icon: ChartColumn,
    title: "Reportes y estadísticas",
    description:
      "Ingresos, servicios top, horas pico y rendimiento de tu equipo. Decide con datos, no con intuición.",
  },
  {
    Icon: HeartHandshake,
    title: "Recupera clientes",
    description:
      "Detecta clientes que dejaron de venir y envíales una invitación por WhatsApp con un clic.",
  },
  {
    Icon: ListOrdered,
    title: "Lista de espera inteligente",
    description:
      "Si se cancela un turno, avisamos automáticamente al primer cliente en espera.",
  },
];

const TRIP_FEATURES: readonly Feature[] = [
  {
    Icon: Bus,
    title: "Salidas y asientos",
    description:
      "Publica cada salida con sus asientos, su precio y la foto del vehículo. Nunca se venden más asientos de los que hay.",
  },
  {
    Icon: Globe,
    title: "Tu página de pasajes",
    description:
      "Tus pasajeros reservan solos desde un enlace, sin llamar: eligen la salida, cuántos viajan y dónde los recoges.",
  },
  {
    Icon: MapPin,
    title: "Puntos de recogida",
    description:
      "Cada parada con su hora y su precio. Solo ida o ida y vuelta.",
  },
  {
    Icon: Banknote,
    title: "Anticipos bajo control",
    description:
      "Pide un anticipo para guardar el asiento y registra cada cobro: siempre sabes quién pagó y cuánto falta.",
  },
  {
    Icon: ClipboardList,
    title: "La lista del chofer",
    description:
      "Pasajeros, paradas, teléfonos y lo que falta cobrar, lista para compartir por WhatsApp o imprimir.",
  },
  {
    Icon: MessageSquare,
    title: "Avisos por WhatsApp",
    description:
      "El pasajero recibe la confirmación de su reserva y cómo pagar el anticipo, sin que escribas nada.",
  },
];

const HOW_IT_WORKS: readonly {
  step: string;
  title: string;
  description: string;
}[] = [
    {
      step: "01",
      title: "Crea tu negocio",
      description:
        "Regístrate y elige si trabajas con turnos, con pasajes o con ambos. Luego carga tus servicios y tu equipo, o tus salidas.",
    },
    {
      step: "02",
      title: "Agenda turnos o publica salidas",
      description:
        "Carga las reservas en segundos desde el móvil o comparte tu página para que reserven solos. El sistema evita solapes y asientos vendidos de más.",
    },
    {
      step: "03",
      title: "WhatsApp hace el resto",
      description:
        "Confirmaciones y recordatorios automáticos. En los turnos, tus clientes responden OK o CANCELAR y la agenda se actualiza sola.",
    },
  ];

const TRUST_POINTS: readonly Feature[] = [
  {
    Icon: Lock,
    title: "Datos aislados por negocio",
    description:
      "Cada organización solo accede a su propia información, con aislamiento a nivel de base de datos (Row Level Security).",
  },
  {
    Icon: KeyRound,
    title: "Roles y permisos",
    description:
      "Dueño y empleados: cada miembro del equipo ve exactamente lo que necesita.",
  },
  {
    Icon: ServerCog,
    title: "Infraestructura confiable",
    description:
      "Cifrado en tránsito (HTTPS/TLS), respaldos automáticos y sincronización en tiempo real.",
  },
  {
    Icon: Building2,
    title: "Hecho para tu día a día",
    description:
      "Salones, barberías, clínicas, estéticas, talleres y negocios de viajes y excursiones: flujos pensados para el trabajo real.",
  },
];

const FAQS: readonly { question: string; answer: string }[] = [
  {
    question: "¿Qué es Turno Flash?",
    answer:
      "Turno Flash es un sistema de reservas para negocios. Sirve para dos cosas: llevar la agenda de turnos de salones, barberías, clínicas y talleres, y vender pasajes para viajes y excursiones. Está optimizado para funcionar desde tu móvil con bajo consumo de datos.",
  },
  {
    question: "¿Sirve para vender pasajes de viajes o excursiones?",
    answer:
      "Sí. Cargas cada salida con su fecha, sus asientos, sus puntos de recogida y su precio, y compartes un enlace para que tus pasajeros reserven solos. Puedes pedir un anticipo para guardar el asiento, aprobar las reservas antes de confirmarlas, registrar los cobros y compartir con el chofer la lista de pasajeros. Al registrarte eliges si tu negocio trabaja con turnos, con pasajes o con ambos.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
`Depende del tamaño de tu negocio. Personal (trabajas por tu cuenta) cuesta ${formatUsd(LICENSE_PLAN_INFO.personal.price)} al mes; Salón (hasta 5 profesionales), ${formatUsd(LICENSE_PLAN_INFO.salon.price)}; Salón grande, ${formatUsd(LICENSE_PLAN_INFO.salon_large.price)}; y Pasajes, ${formatUsd(LICENSE_PLAN_INFO.trips.price)}. Si das turnos y además vendes pasajes, sumas ${formatUsd(SECOND_MODULE_PRICE)} al mes. Puedes pagar por mes, por 3 o 6 meses, o por un año, que cuesta 10 meses. Empiezas con ${TRIAL_DAYS} días gratis.`,
  },
  {
    question: "¿Cómo se paga?",
    answer: `En dólares, por transferencia o en efectivo: nos escribes por WhatsApp desde la app y te decimos cómo. En cuanto registramos tu pago se extiende tu acceso. Desde 2 días antes de que venza te avisamos por WhatsApp, y si te atrasas tienes ${LICENSE_GRACE_DAYS} días de margen en los que la app sigue funcionando.`,
  },
  {
    question: "¿Necesito instalar algo?",
    answer:
      "No necesitas instalar nada complicado. Turno Flash funciona desde tu navegador móvil y también está disponible como aplicación nativa para iOS y Android. Todo desde un solo código base.",
  },
  {
    question: "¿Cómo funcionan las automatizaciones por WhatsApp?",
    answer:
      "Turno Flash trabaja solo: envía la confirmación al crear el turno, recordatorios 24 horas y 1 hora antes (el cliente responde OK o CANCELAR y la agenda se actualiza), pide una valoración de 1 a 5 estrellas al completar la visita, avisa a la lista de espera cuando se libera un lugar y puede enviarte cada mañana un resumen de tu día con los turnos e ingresos estimados.",
  },
  {
    question: "¿Qué reportes y estadísticas incluye?",
    answer:
      "El panel de reportes muestra los ingresos por día con comparación contra el período anterior, los servicios que más facturan, el rendimiento de cada profesional (turnos, ingresos y valoraciones de clientes), las horas pico de tu negocio, el origen de las reservas y cuántos clientes nuevos ganaste. Todo se calcula automáticamente con los turnos que ya cargas, y puedes exportar turnos y clientes a Excel (CSV) cuando quieras.",
  },
  {
    question: "¿Puedo usar Turno Flash en múltiples dispositivos?",
    answer:
      "Sí, Turno Flash funciona en cualquier dispositivo con navegador. Puedes acceder desde tu teléfono, tablet o computadora. Todos los datos se sincronizan en tiempo real.",
  },
  {
    question: "¿Qué pasa si no tengo internet?",
    answer:
      "En la app del teléfono puedes abrir y consultar tu día sin señal: la agenda y la lista de pasajeros quedan guardadas. Para crear o cambiar algo sí hace falta conexión. Turno Flash está optimizado para conexiones lentas y consume muy pocos datos.",
  },
  {
    question: "¿Puedo personalizar mi página de reservas?",
    answer:
      "Sí, cada negocio tiene su propia página pública con un enlace único, que tú decides cuándo activar. Tus clientes reservan turnos o asientos directamente desde ahí, sin crear una cuenta.",
  },
  {
    question: "¿Cómo empiezo a usar Turno Flash?",
    answer:
`Si eres dueño de un negocio, crea tu cuenta gratis: en un minuto tienes tu negocio listo, con ${TRIAL_DAYS} días de prueba. Si trabajas en un negocio que ya usa Turno Flash, pídele al dueño que te invite: te llega un correo para elegir tu contraseña.`,
  },
];

/** What WhatsApp sends on its own, in the order it happens. */
const WHATSAPP_TIMELINE: readonly { when: string; what: string; detail: string }[] = [
  { when: "Al reservar", what: "Confirmación", detail: "Con el día, la hora y el servicio." },
  { when: "24 h antes", what: "Recordatorio", detail: "El cliente responde OK o CANCELAR." },
  { when: "1 h antes", what: "Último aviso", detail: "Para que nadie llegue tarde." },
  { when: "Al terminar", what: "Valoración", detail: "De 1 a 5 estrellas." },
  { when: "Cada mañana", what: "Resumen para el dueño", detail: "Tus turnos e ingresos del día." },
];

const BUSINESS_TYPES = [
  "Peluquerías",
  "Barberías",
  "Clínicas",
  "Estéticas",
  "Talleres",
  "Agencias de viaje",
];

const SECTION = "mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-12";
const SECTION_GAP = "pt-16 sm:pt-24 lg:pt-[120px]";
const EYEBROW = "text-sm font-semibold text-primary-700 dark:text-primary-400";
const H2 = "mt-2.5 font-display text-[40px] leading-none text-foreground lg:text-[68px]";
// Over the inverted sections (dark in the light theme, light in the dark one)
const ON_INVERSE_MUTED = "text-inverse-foreground/70";
const ON_INVERSE_ACCENT = "text-primary-400 dark:text-primary-700";

export default function HomePageClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // The app is for owners already signed up: skip the marketing page (P2-12).
  // The panel sends to /login without a session and waits on a bad network.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    // Si hay tokens de autenticación en el hash, redirigir al callback
    if (window.location.hash.includes("access_token")) {
      const hash = window.location.hash;
      window.location.href = `/auth/callback${hash}`;
      return;
    }
  }, []);

  const ctaTarget = user ? "/dashboard" : "/register";
  const ctaLabel = user ? "Ir al Dashboard" : "Probar gratis";
  const whatsappFeature = FEATURES.find((f) => f.Icon === MessageSquare);
  const gridFeatures = FEATURES.filter((f) => f !== whatsappFeature);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className={`${SECTION} flex h-[68px] items-center gap-6`}>
          <Logo size={30} withWordmark />
          <div className="flex flex-1 items-center justify-center gap-7 text-sm font-medium text-foreground-muted max-md:hidden">
            <a href="#features" className="hover:text-foreground">Funciones</a>
            <a href="#trips" className="hover:text-foreground">Pasajes</a>
            <a href="#pricing" className="hover:text-foreground">Precios</a>
            <a href="#faq" className="hover:text-foreground">Preguntas</a>
            <Link href="/help" className="hover:text-foreground">Ayuda</Link>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {!user && (
              <Link
                href="/login"
                className="text-sm font-semibold text-foreground max-sm:hidden"
              >
                Iniciar sesión
              </Link>
            )}
            <Button
              onClick={() => router.push(ctaTarget)}
              className="!h-10"
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={`${SECTION} grid items-center gap-14 py-12 lg:grid-cols-2 lg:py-24`}>
        <div>
          <div className="inline-flex h-8 items-center gap-2 rounded-full bg-secondary-100 px-3.5 text-meta font-semibold text-secondary-600 dark:bg-secondary-900 dark:text-secondary-400">
            <MessageCircle className="size-4" />
            Recordatorios automáticos por WhatsApp
          </div>
          <h1 className="mt-6 font-display text-[56px] font-normal leading-[0.94] tracking-[-0.02em] text-foreground sm:text-[80px] lg:text-[108px]">
            Tu agenda,
            <br />
            en piloto <em className="text-primary">automático.</em>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-foreground-muted lg:text-[20px]">
            Turnos para peluquerías, barberías, consultorios y estéticas, y
            venta de pasajes para viajes y excursiones. Todo desde el celular.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Button size="lg" onClick={() => router.push(ctaTarget)}>
              {user ? "Ir al Dashboard" : `Probar ${TRIAL_DAYS} días gratis`}
              <ArrowRight className="size-[18px]" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() =>
                document
                  .getElementById("pricing")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Ver precios
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-[22px] gap-y-2.5 text-sm text-foreground-muted">
            {[
              "Sin dobles reservas",
              "Confirmaciones por WhatsApp",
              "Página de reservas propia",
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-primary" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* A still of the Inicio screen, plus the WhatsApp exchange */}
        <div className="relative min-h-[520px] max-lg:hidden" aria-hidden>
          <div className="absolute inset-[40px_6%_0_18%] rounded-[40px] bg-primary-100 dark:bg-primary-900" />
          <div className="absolute right-[10%] top-0 w-[320px] rounded-[36px] border border-border bg-background p-5 shadow-[0_24px_48px_-20px_rgba(22,23,20,.28)]">
            <div className="text-meta font-medium text-foreground-subtle">
              Viernes 12 de junio
            </div>
            <div className="mt-1 font-display text-[32px] leading-[1.05] text-foreground">
              Buen día, Lucía
            </div>
            <Card className="mt-4 p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-[0.9] text-foreground">
                  8
                </span>
                <span className="text-meta font-medium text-foreground-muted">
                  turnos hoy
                </span>
              </div>
              <div className="mt-3.5 flex h-2 gap-[3px]">
                <span className="st-completed grow-[3] rounded-[4px] bg-[var(--st-c)]" />
                <span className="st-in_progress grow rounded-[4px] bg-[var(--st-c)]" />
                <span className="st-confirmed grow-[3] rounded-[4px] bg-[var(--st-c)]" />
                <span className="st-pending grow rounded-[4px] bg-[var(--st-c)]" />
              </div>
            </Card>
            <div className="mt-3 grid gap-px overflow-hidden rounded-card border border-border bg-border">
              {(
                [
                  ["11:30", "Sofía Hernández", "Coloración", "in_progress"],
                  ["13:00", "Carlos Pérez", "Corte + barba", "client_confirmed"],
                  ["14:30", "Martina Gómez", "Corte de cabello", "confirmed"],
                ] as const
              ).map(([time, name, service, status]) => (
                <div
                  key={time}
                  className="flex items-center gap-3 bg-surface px-3.5 py-3"
                >
                  <span className="font-mono text-meta font-medium tabular-nums text-foreground">
                    {time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-meta font-semibold text-foreground">
                      {name}
                    </div>
                    <div className="truncate text-caption text-foreground-muted">
                      {service}
                    </div>
                  </div>
                  <StatusBadge status={status} size="sm" />
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-6 left-0 flex w-[300px] flex-col gap-2 rounded-[22px] bg-surface p-4 shadow-[0_0_0_1px_var(--color-border),0_24px_48px_-20px_rgba(22,23,20,.28)]">
            <div className="flex items-center gap-2 text-caption font-semibold text-foreground-subtle">
              <span className="size-2 rounded-full bg-primary" />
              WhatsApp · Barbería Demo
            </div>
            <div className="rounded-[4px_16px_16px_16px] bg-surface-2 px-3 py-2.5 text-sm text-foreground">
              Hola Carlos, te esperamos mañana a las 13:00 para tu Corte +
              barba. Responde OK para confirmar.
            </div>
            <div className="self-end rounded-[16px_4px_16px_16px] bg-primary-100 px-3 py-2 text-sm font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-400">
              OK
            </div>
            <div className="flex items-center gap-1.5 text-caption text-primary-700 dark:text-primary-400">
              <CircleCheck className="size-4" />
              Turno confirmado · la agenda se actualizó sola
            </div>
          </div>
        </div>
      </section>

      {/* Business types */}
      <div className="border-y border-border py-6">
        <div className={`${SECTION} flex flex-wrap items-baseline justify-center gap-x-7 gap-y-2`}>
          <span className="text-meta font-semibold text-foreground-muted">
            Hecho para
          </span>
          {BUSINESS_TYPES.map((type) => (
            <span
              key={type}
              className="font-display text-[22px] text-foreground-subtle lg:text-[30px]"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className={`${SECTION} ${SECTION_GAP}`}>
        <div className={EYEBROW}>Cómo funciona</div>
        <h2 className={H2}>Listo en tres pasos.</h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="border-t border-border-2 pt-5">
              <div className="font-display text-[64px] leading-none text-primary">
                {item.step}
              </div>
              <h3 className="mt-4 text-title font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-body leading-relaxed text-foreground-muted">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`${SECTION} ${SECTION_GAP} scroll-mt-20`}>
        <div className={EYEBROW}>Funciones</div>
        <h2 className={H2}>Todo lo que necesita tu agenda.</h2>

        {whatsappFeature && (
          <div className="mt-12 grid gap-10 rounded-[28px] bg-inverse p-6 text-inverse-foreground lg:grid-cols-2 lg:p-12">
            <div>
              <IconTile tone="pink" size={48}>
                <MessageCircle />
              </IconTile>
              <h3 className="mt-5 font-display text-[34px] leading-none lg:text-[48px]">
                {whatsappFeature.title}
              </h3>
              <p className={`mt-4 max-w-md text-body leading-relaxed ${ON_INVERSE_MUTED}`}>
                {whatsappFeature.description}
              </p>
            </div>
            <div>
              {WHATSAPP_TIMELINE.map((row) => (
                <div
                  key={row.when}
                  className="flex gap-4 border-t border-inverse-foreground/15 py-3.5"
                >
                  <span className={`w-[110px] shrink-0 font-mono text-meta ${ON_INVERSE_MUTED}`}>
                    {row.when}
                  </span>
                  <div>
                    <div className="text-body font-semibold">{row.what}</div>
                    <div className={`text-meta ${ON_INVERSE_MUTED}`}>
                      {row.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {gridFeatures.map((feature) => (
            <Card key={feature.title} className="flex flex-col gap-3.5 p-6">
              <IconTile size={42}>
                <feature.Icon />
              </IconTile>
              <h3 className="text-lead font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-foreground-muted">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Trips */}
      <section
        id="trips"
        className="mt-16 scroll-mt-16 bg-inverse py-16 text-inverse-foreground sm:mt-24 lg:mt-[120px] lg:py-[104px]"
      >
        <div className={SECTION}>
          <div className="text-sm font-semibold text-secondary-400 dark:text-secondary-600">
            Venta de pasajes
          </div>
          <h2 className="mt-2.5 font-display text-[40px] leading-none lg:text-[68px]">
            ¿Vendes pasajes?{" "}
            <em className={ON_INVERSE_ACCENT}>También es para ti.</em>
          </h2>
          <p className={`mt-5 max-w-2xl text-body leading-relaxed lg:text-[17px] ${ON_INVERSE_MUTED}`}>
            Guaguas, excursiones y viajes: publica tus salidas, cobra el
            anticipo y lleva la lista de pasajeros sin libretas ni llamadas.
          </p>
          <div className="mt-12 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {TRIP_FEATURES.map((feature) => (
              <div key={feature.title}>
                <feature.Icon className={`size-[22px] ${ON_INVERSE_ACCENT}`} />
                <h3 className="mt-3 text-lead font-semibold">
                  {feature.title}
                </h3>
                <p className={`mt-1.5 text-sm ${ON_INVERSE_MUTED}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / security */}
      <section className={`${SECTION} ${SECTION_GAP}`}>
        <div className="grid items-end gap-6 lg:grid-cols-2">
          <div>
            <div className={EYEBROW}>Seguridad</div>
            <h2 className={H2}>Tus datos, solo tuyos.</h2>
          </div>
          <p className="text-body leading-relaxed text-foreground-muted">
            La información de tu negocio y de tus clientes está aislada y
            protegida. Lee cómo la tratamos en la{" "}
            <Link className="underline" href="/privacy">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[22px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="bg-surface p-6">
              <point.Icon className="size-[22px] text-primary" />
              <h3 className="mt-3 text-lead font-semibold text-foreground">
                {point.title}
              </h3>
              <p className="mt-1.5 text-sm text-foreground-muted">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <PricingSection
        ctaLabel={user ? "Ir al Dashboard" : `Probar ${TRIAL_DAYS} días gratis`}
        onCta={() => router.push(ctaTarget)}
      />

      {/* FAQs */}
      <section id="faq" className={`${SECTION} ${SECTION_GAP} scroll-mt-20 grid gap-10 lg:grid-cols-2`}>
        <div>
          <h2 className="font-display text-[40px] leading-none text-foreground lg:text-[68px]">
            Preguntas frecuentes
          </h2>
          <p className="mt-5 text-body text-foreground-muted">
            ¿No encuentras lo que buscas? Escríbenos a{" "}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
        <div className="border-t border-border-2">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.question} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-lead font-semibold text-foreground"
                >
                  {faq.question}
                  {isOpen ? (
                    <Minus className="size-5 shrink-0 text-foreground-subtle" />
                  ) : (
                    <Plus className="size-5 shrink-0 text-foreground-subtle" />
                  )}
                </button>
                {isOpen && (
                  <p className="pb-[22px] pr-10 text-body leading-relaxed text-foreground-muted">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className={`${SECTION} ${SECTION_GAP}`}>
        <div className="flex flex-wrap items-end justify-between gap-8 rounded-[32px] bg-primary p-10 text-primary-foreground lg:p-[88px]">
          <div>
            <h2 className="font-display text-[56px] leading-[0.92] lg:text-[112px]">
              ¿Empezamos?
            </h2>
            <p className="mt-5 max-w-md text-[18px] opacity-85">
              {user
                ? "Tu panel te espera con la agenda de hoy."
                : `Crea tu negocio en un minuto y prueba ${TRIAL_DAYS} días gratis, sin dar una tarjeta.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(ctaTarget)}
            className="flex h-14 cursor-pointer items-center gap-2 rounded-[14px] bg-surface px-6 text-[16px] font-semibold text-primary-700 transition-[filter] hover:brightness-95 dark:text-primary-400"
          >
            {user ? "Ir al Dashboard" : "Comenzar gratis"}
            <ArrowRight className="size-[18px]" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`${SECTION} pb-8 pt-16`}>
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="max-w-sm flex-1 basis-64">
            <Logo size={28} withWordmark />
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
              Turnos y venta de pasajes para tu negocio. Reservas online,
              avisos por WhatsApp y control total de tu agenda y de tus
              salidas, desde el móvil.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-4 inline-block text-sm text-foreground-muted underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <FooterColumn title="Producto">
            <a href="#features">Funciones</a>
            <a href="#trips">Pasajes</a>
            <a href="#pricing">Precios</a>
            <Link href="/help">Ayuda</Link>
            <Link href="/login">Iniciar sesión</Link>
          </FooterColumn>
          <FooterColumn title="Legal">
            <Link href="/privacy">Política de Privacidad</Link>
            <Link href="/terms">Términos y Condiciones</Link>
            <Link href="/account-deletion">Eliminar cuenta</Link>
          </FooterColumn>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-5 text-meta text-foreground-subtle">
          <span>
            © {new Date().getFullYear()} Turno Flash. Todos los derechos
            reservados.
          </span>
          <FullkodCredit />
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-meta font-semibold text-foreground-subtle">
        {title}
      </div>
      <div className="mt-3 flex flex-col gap-2.5 text-sm text-foreground-muted [&>a:hover]:text-foreground">
        {children}
      </div>
    </div>
  );
}
