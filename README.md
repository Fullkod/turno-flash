# Turno Flash

SaaS de gestión de turnos y de venta de pasajes para pequeños negocios de Cuba: peluquerías, barberías,
estudios, clínicas y transportistas. Cada negocio tiene su panel web y app Android, una página pública
de reservas y avisos automáticos por WhatsApp a sus clientes.

- **Web:** https://turno-flash.vercel.app
- **Android:** Google Play (`com.turnoflash.app`)
- **Manual para los negocios:** `/help` dentro de la app (fuente en `docs/user-manual/`)

## Qué hace

| Módulo | Para quién | Qué incluye |
|---|---|---|
| **Turnos** | Negocios con agenda | Agenda por día y profesional, 9 estados de turno (Avisado, Confirmó, Llegó, Terminado, No vino…), clientes, servicios con categorías, horarios por profesional, reserva online en `/book?b=<negocio>`, recordatorios y confirmación por WhatsApp, reportes |
| **Pasajes** | Transportistas | Salidas con plazas, puntos de recogida, ida y vuelta, anticipo por plaza, lista de pasajeros, página pública en `/trips?b=<negocio>`, avisos por WhatsApp |

Comunes a los dos: varios negocios en una misma instalación, roles (admin de plataforma, dueño, personal),
licencia con prueba de 15 días y planes (Personal, Salón, Salón grande, Pasajes), cobro por RevenueCat o
registro manual del pago.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) con `output: "export"` · React 19 · TypeScript 5 |
| Estilos | Tailwind CSS v4 (sin `tailwind.config`; tokens en `app/globals.css`) |
| Datos | Supabase: Postgres + RLS, Auth, Edge Functions (Deno), pg_cron |
| Cliente | TanStack Query v5, React Context, react-hook-form, Zod v4, date-fns |
| Móvil | Capacitor 8 (Android; iOS preparado) + RevenueCat |
| WhatsApp | OpenWA (una sesión compartida por el piloto), llamado desde Edge Functions |
| Despliegue | Vercel (web) · Supabase CLI (BD y funciones) · Ionic Appflow (Android) |

### La restricción que manda: sitio estático

La web se exporta como HTML estático (`out/`) porque Capacitor la empaqueta dentro de la app. Por eso:

- **No hay** API routes, middleware, Server Actions ni SSR. Todo Next corre en el cliente.
- **La seguridad está en la base de datos (RLS).** Los guardas de la UI son cosméticos.
- Lo que necesita servidor va en **Edge Functions** (`supabase/functions/`) o en funciones SQL.
- Las tareas programadas son **pg_cron** dentro de Postgres, no crons de Vercel.

## Estructura

```
app/
├── (app)/            # Con sesión (AuthProvider): landing, login, registro, /help y /dashboard/*
├── book/  trips/     # Páginas públicas de reserva (sin sesión: no usan useAuth)
└── privacy/ terms/ account-deletion/
components/           # UI por dominio (appointments, booking, services, trips…) y primitivas en ui/
services/             # Acceso a datos, un archivo por dominio (<dominio>.service.ts)
hooks/  contexts/     # Hooks de TanStack Query y estado global
schemas/              # Esquemas Zod compartidos entre formulario y servicio
types/                # Tipos, incluido database.types.ts (generado)
utils/  config/
supabase/
├── migrations/       # Fuente de verdad del esquema (001 → 085…)
└── functions/        # Edge Functions + _shared/ (cliente de OpenWA, textos de WhatsApp)
android/  ios/        # Proyectos nativos de Capacitor
scripts/              # Build (arreglo del export en Windows, plataformas, íconos) y datos demo
docs/                 # Documentación (ver abajo)
```

Reglas: las consultas van en `services/`, nunca sueltas en componentes; la validación, en `schemas/`;
todo cambio de esquema, en una migración nueva.

## Arrancar en local

Requisitos: Node 20+ y el [CLI de Supabase](https://supabase.com/docs/guides/cli) (instalado aparte, se usa sin `npx`).

```bash
npm install
# Pide el .env.local a alguien del equipo (no hay .env.example)
npm run dev                    # toma el primer puerto libre desde el 3000
```

Variables de `.env.local`:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente de Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL pública (enlaces de reserva, Open Graph) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo para scripts locales (`scripts/`). Nunca en el cliente |
| `TASKNIC_API_KEY` | Opcional: conexión del agente con Tasknic (cada uno la suya) |

Los secretos de las Edge Functions (`OPENWA_*`, `REVENUECAT_WEBHOOK_AUTH`, `ADMIN_NOTIFY_*`,
`ERROR_NOTIFY_PHONES`) viven en Supabase, no en el repo.

**Solo hay una base de datos (producción).** No existe entorno de pruebas: para probar, crea un negocio
desechable y bórralo al terminar; nunca uses los negocios de clientes.

## Comandos

```bash
npm run dev               # Desarrollo
npm run build:next        # Build web (+ arreglo del export en Windows)
npx tsc --noEmit          # Chequeo de tipos
npx eslint .              # Lint (npm run lint está roto desde Next 16)

npm run cap:sync:android  # Build + copiar la web al proyecto Android

supabase migration list --linked
supabase db push                                                   # aplicar migraciones
supabase gen types typescript --linked > types/database.types.ts   # desde Bash, no PowerShell
supabase functions deploy <nombre> --use-api                       # una Edge Function
```

No hay tests automáticos ni CI (el único workflow de GitHub hace un ping diario a Supabase).

## Despliegue

| Pieza | Cómo |
|---|---|
| Web | Automático en Vercel al hacer push a `main` (tarda hasta ~20 min en verse) |
| Base de datos | Migración nueva → ensayarla en `BEGIN … ROLLBACK` probando cada rol → `supabase db push` → regenerar tipos |
| Edge Functions | `supabase functions deploy <nombre> --use-api`, antes o a la vez que la web que las usa |
| Android | Subir `versionCode`/`versionName` en `android/app/build.gradle` → `npm run cap:sync:android` → push → build en [Ionic Appflow](https://dashboard.ionicframework.com/) → Play Console |

El detalle y el estado de cada despliegue se llevan en Tasknic (proyecto «Turno Flash», pestaña Despliegue).

## Documentación

| Dónde | Qué |
|---|---|
| `docs/user-manual/` | Manual para los negocios, servido en `/help` |
| `docs/ROLES-AND-PERMISSIONS.md` | Qué puede hacer cada rol |
| `docs/APPOINTMENT-FLOW.md` | Estados de un turno y sus acciones |
| `docs/SERVICE-LAYER.md` | Contrato de los services |
| `docs/CORRECCION-capacitor.md` | Por qué el sitio es estático |
| `docs/PLAN-GOOGLE-PLAY.md` | Publicación en Play y RevenueCat |
| `docs/design/` | Rediseño v2 (tokens, pantallas) |
| `.claude/PRPs/` | Planes de las funcionalidades grandes |
| `.claude/memory/` | Memoria del proyecto: decisiones, estado y trampas conocidas |

Varios documentos de `docs/` son de enero de 2026 y están desactualizados (`ROADMAP-2026.md`,
`PLAN-MEJORAS-PRO.md`, `REFACTOR-*.md`, `RESUMEN-FINAL.md`…). La verdad está en `supabase/migrations/`,
el código y `git log`.

## Licencia

Software propietario. Todos los derechos reservados por Fullkod — ver [LICENSE](LICENSE).

<!-- fullkod-signature -->
---

<a href="https://fullkod.com/?ref=turno-flash"><img src="https://fullkod.com/brand/fullkod-symbol.svg" width="20" height="20" align="center" alt="Fullkod"></a> Built by **[Fullkod](https://fullkod.com/?ref=turno-flash)**
