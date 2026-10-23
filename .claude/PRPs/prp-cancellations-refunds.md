# PRP-010: Cancelaciones y devoluciones (TUR0010)

> **Estado**: HECHO (2026-10-23, en producción)
> **Fecha**: 2026-10-23
> **Proyecto**: Turno Flash
> **Tarea**: TUR0010 «Gestionar cancelaciones y devoluciones»
> **Base**: PRP-006 (anticipos, 090-092), PRP-007 (condiciones, 093-094), PRP-008 (pagos, 095), PRP-009 (avisos de pago, 096)

---

## Objetivo

Al cancelar un turno desde el panel siempre queda **por qué** se canceló (de una lista corta), y el negocio puede
**registrar devoluciones** de lo que el cliente pagó (anticipo y pagos), totales o parciales, con importe, motivo, fecha
y estado (**Pendiente → Procesada / Rechazada**), con el historial de quién cambió cada estado y cuándo. El cliente
recibe un WhatsApp cuando su devolución se procesa o se rechaza.

## Por Qué

| Problema | Solución |
|----------|----------|
| Al cancelar desde el panel no se guarda el motivo (y nadie lo ve después) | Motivo obligatorio de una lista; se muestra en el detalle del turno cancelado |
| Solo existe «Marcar anticipo devuelto»: todo o nada, solo el anticipo, sin fecha ni rastro | Devoluciones de cualquier parte de lo pagado, con importe, motivo, fecha y estado |
| El empleado atiende al cliente pero no puede dejar constancia de que hay que devolverle dinero | El empleado registra la devolución como Pendiente; el dueño la procesa o la rechaza |
| No queda registro de quién decidió devolver o no | Historial de cada cambio de estado (quién, cuándo, nota) |
| El cliente no sabe si le van a devolver su dinero | WhatsApp al procesarla o rechazarla (con el interruptor de avisos de pago) |
| La mayoría devuelve, pero hay negocios que no devuelven nunca | Interruptor «Hacemos devoluciones» por negocio (encendido por defecto) |

**Valor de negocio**: menos discusiones con clientes por dinero, constancia de cada devolución para el dueño, y la base
de datos lista para los informes de cancelaciones y devoluciones (TUR0011).

## Qué

### Decisiones de Claudia (2026-10-23)
1. **Cancelar desde el panel pide motivo obligatorio** de una lista: «El cliente canceló», «Canceló el negocio»,
   «No pagó el anticipo», «Otro» (con texto obligatorio).
2. **Interruptor por negocio en Ajustes «Hacemos devoluciones»**, encendido por defecto. Apagado: no se ofrece
   devolución. Encendido: se puede devolver cualquier parte de lo pagado (anticipo + pagos de TUR0008), total o
   parcial; si lo devuelto cubre el anticipo, el anticipo queda «Devuelto». **Reemplaza el botón «Marcar anticipo
   devuelto».**
3. **El empleado registra una devolución como Pendiente**; solo dueño/admin la marca **Procesada** o **Rechazada**
   (con motivo del rechazo).
4. **WhatsApp al cliente al procesarla o rechazarla**, con el mismo interruptor de avisos de pago (096).
5. **Historial** de cambios de estado de cada devolución (quién, cuándo).

### Supuestos (corregir si no encajan)
- **Solo se devuelve en turnos cancelados o en los que el cliente no vino** (igual que el botón de hoy). Un turno
  terminado no ofrece devolución. *(Si quieres poder devolver también en un turno ya atendido —cliente insatisfecho—,
  dímelo y se abre.)*
- **El dueño puede registrar la devolución ya como Procesada** («Ya la devolví») sin pasar por Pendiente; el empleado
  siempre la deja Pendiente. Registrar como Pendiente **no** manda WhatsApp.
- **No se puede devolver más de lo pagado**: la suma de devoluciones pendientes y procesadas no supera lo pagado
  (pagos no anulados). Una rechazada no cuenta, y se puede registrar otra después.
- Cada devolución lleva: **importe**, **motivo** (texto corto; se propone el motivo de la cancelación), **cómo se
  devolvió** (efectivo, transferencia, tarjeta u otro, como los pagos) y **fecha** en que se devolvió (al procesarla;
  por defecto, ahora).
- **Una devolución no se edita ni se borra**: si se registró mal, el dueño la rechaza con el motivo («me equivoqué») y
  se registra otra. Procesada y Rechazada son finales.
- **«Cubre el anticipo»**: cuando lo procesado suma al menos el anticipo, el anticipo pasa a «Devuelto». Una devolución
  parcial menor que el anticipo lo deja como estaba.
- **Lo pagado no cambia** al devolver: los pagos siguen siendo lo que entró. El turno muestra aparte **«Devuelto»**
  (procesado) y **«Devolución pendiente»**. Cómo se cuenta en ingresos lo decide TUR0011.
- **Anular un pago ya devuelto no se permite** si con eso lo devuelto superaría lo pagado (hay que rechazar antes la
  devolución pendiente).
- **Con el interruptor apagado** no se ofrecen devoluciones nuevas, pero las pendientes que ya existan se pueden seguir
  procesando o rechazando, y el historial se sigue viendo.
- **Cancelar por WhatsApp** (cliente escribe CANCELAR) sigue igual y se guarda como «El cliente canceló» con su texto
  de siempre. Marcar «No vino» no pide motivo.
- Los turnos cancelados antes de esto quedan como están (sin motivo de la lista); los anticipos ya marcados
  «Devuelto» con el botón viejo no se tocan.
- Fuera de esta tarea: informes de cancelaciones y devoluciones (TUR0011), pasajes (tienen su propio flujo), devolver
  con pasarela (TUR0012).

### Criterios de Éxito
- [x] Cancelar desde el panel no deja confirmar sin elegir motivo; «Otro» exige texto. El motivo, quién y cuándo se ven
      en el detalle del turno cancelado.
- [x] Con «Hacemos devoluciones» encendido, un turno cancelado con dinero pagado ofrece «Registrar devolución» con
      importe hasta lo pagado; apagado, no aparece. El botón «Marcar anticipo devuelto» ya no existe.
- [x] El empleado solo puede registrar Pendiente; procesar o rechazar es solo de dueño/admin (también en la BD, no solo
      en la pantalla). Rechazar exige motivo.
- [x] No se puede devolver más de lo pagado ni anular un pago que dejaría lo devuelto por encima de lo pagado.
- [x] Cuando lo procesado cubre el anticipo, el anticipo queda «Devuelto».
- [x] Cada devolución muestra su historial (Pendiente → Procesada/Rechazada, quién y cuándo).
- [x] El cliente recibe un WhatsApp al procesarse (importe y cómo) o al rechazarse (motivo), solo si el interruptor de
      avisos de pago está encendido y el negocio tiene WhatsApp; registrar Pendiente no manda nada.
- [x] Con la licencia bloqueada no se lee ni se escribe nada de devoluciones (política 087).
- [x] El manual (`/help`) explica motivos de cancelación y devoluciones.

### Comportamiento Esperado

**Cancelar con motivo.** En el detalle del turno, «Cancelar» abre una hoja con los 4 motivos como opciones; «Otro» abre
un campo de texto. «Cancelar turno» queda desactivado hasta elegir. El turno cancelado muestra «Cancelado · El cliente
canceló · por Ana · 23 oct 10:40».

**Devolver (dueño).** En el turno cancelado, el bloque de dinero muestra lo pagado y, si hay algo pagado y el negocio
hace devoluciones, «Registrar devolución». La hoja propone devolver todo lo pagado (editable), el motivo de la
cancelación, cómo se devuelve y dos opciones: «Ya la devolví» (Procesada) o «Queda pendiente». Al procesarla, al
cliente le llega «Te devolvimos 20 USD por transferencia del turno ES-0004». Si cubre el anticipo, el anticipo pasa a
«Devuelto».

**Devolver (empleado).** La misma hoja, sin elegir estado: queda «Pendiente de aprobar». El dueño la ve en el turno y
la procesa o la rechaza (con motivo). Al rechazar, al cliente le llega el motivo y el contacto del negocio.

**Historial.** Cada devolución muestra sus pasos: «Registrada por Ana · 23 oct 10:42 · Pendiente», «Procesada por
Claudia · 23 oct 12:05».

---

## Contexto

### Lo que ya hay
- `appointments.cancellation_reason / cancelled_by / cancelled_at` (010): `AppointmentService.updateStatus` ya acepta
  `reason` y llena `cancelled_by/at`; **la hoja de cancelar del panel no pide motivo** (`app/(app)/dashboard/appointments/page.tsx`,
  `ConfirmSheet` con `pendingTerminal`) y **ningún componente muestra el motivo**.
- `wa-inbound` cancela con `cancellation_reason: "Cancelado por cliente vía WhatsApp"`; el `cancel_ack` al cliente lo
  dispara el trigger de la 017.
- `guard_appointment_deposit` (última versión en 093): al cancelar, un anticipo `pending/requested/paid` pasa a
  `cancelled`; las columnas del anticipo solo cambian con `app.deposit_change = on` o service role.
- `set_appointment_deposit(..., 'refund')` (090): `verified` + turno cancelado/no vino → `refunded`. Lo usa el botón
  «Marcar anticipo devuelto» de `components/appointments/DepositPanel.tsx` vía `handleDeposit` del page.
- `appointment_payments` + `register_appointment_payment` / `void_appointment_payment` (095), SECURITY DEFINER,
  tabla solo lectura para miembros, RESTRICTIVE de licencia. Vista `appointments_with_details` con `amount_paid`,
  `amount_pending`, `payment_status` al final.
- 096: `business_settings.enable_payment_reminders`, intents nuevos en `wa_outbound_intent`, trigger
  `trg_wa_payment_received` → `wa-send` con `paymentId`; `wa-send` tiene `PAYMENT_NOTICES` y `paymentNoticeSkipReason`.
- UI de dinero: `components/appointments/AppointmentPayments.tsx` (`AppointmentMoney`: anticipo + pagos),
  `RegisterPaymentSheet.tsx`, `services/appointment-payments.service.ts`, `hooks/useAppointmentPayments.query.ts`,
  `schemas/appointment-payment.schema.ts`, `utils/payment.ts`, `utils/deposit.ts`.
- Ajustes: `app/(app)/dashboard/settings/page.tsx` (`SettingRow` + `patchDraft`), solo dueño/admin.

### Arquitectura propuesta
```
supabase/migrations/097_cancellations_refunds.sql   # columnas, tablas, RLS, RPCs, guarda del anular, vista, trigger WA
supabase/functions/wa-send/index.ts                 # intents refund_processed / refund_rejected
supabase/functions/wa-inbound/index.ts              # cancelación por WhatsApp = categoría "customer" (1 línea)

schemas/appointment-cancel.schema.ts                # motivo de cancelación (lista + "Otro")
schemas/appointment-refund.schema.ts                # registrar / procesar / rechazar
services/appointment-refunds.service.ts             # list, register, setStatus, history
hooks/useAppointmentRefunds.query.ts
utils/cancellation.ts                               # códigos y etiquetas de motivo
utils/refund.ts                                     # etiquetas de estado

components/appointments/CancelAppointmentSheet.tsx  # reemplaza el ConfirmSheet de cancelar
components/appointments/AppointmentRefunds.tsx      # bloque de devoluciones + historial (dentro de AppointmentMoney)
components/appointments/RefundSheet.tsx             # registrar / procesar / rechazar
components/appointments/DepositPanel.tsx            # quitar «Marcar anticipo devuelto»
components/appointments/AppointmentModal.tsx        # mostrar motivo de cancelación
app/(app)/dashboard/settings/page.tsx               # interruptor «Hacemos devoluciones»
docs/user-manual/                                   # manual /help
```

### Modelo de datos (borrador)
```sql
-- Motivo de la lista; cancellation_reason sigue guardando el texto («Otro» o el de WhatsApp)
ALTER TABLE appointments ADD COLUMN cancellation_category TEXT
  CHECK (cancellation_category IN ('customer', 'business', 'deposit_unpaid', 'other'));
-- 'other' exige cancellation_reason no vacío

ALTER TABLE business_settings ADD COLUMN refunds_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE appointment_refund_status AS ENUM ('pending', 'processed', 'rejected');

CREATE TABLE appointment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  method appointment_payment_method,          -- obligatorio al procesar
  method_other TEXT,
  status appointment_refund_status NOT NULL DEFAULT 'pending',
  refunded_at TIMESTAMPTZ,                    -- fecha en que se devolvió (processed)
  rejection_reason TEXT,                      -- obligatorio si rejected
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notice_sent_at TIMESTAMPTZ                  -- WhatsApp enviado (lo escribe wa-send)
);

CREATE TABLE appointment_refund_events (      -- historial
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  refund_id UUID NOT NULL REFERENCES appointment_refunds(id) ON DELETE CASCADE,
  status appointment_refund_status NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ambas: RLS, miembros solo leen su negocio, sin INSERT/UPDATE/DELETE directos,
-- RESTRICTIVE "License must be usable" (087). Escritura solo por:
--   register_appointment_refund(appointment, amount, reason, method, method_other, processed BOOLEAN, refunded_at)
--   set_appointment_refund_status(refund, 'processed' | 'rejected', note, method, method_other, refunded_at)
-- SECURITY DEFINER, comprueban negocio, licencia, rol, refunds_enabled (solo al registrar),
-- turno cancelado/no vino, tope = lo pagado, y anticipo -> 'refunded' (con app.deposit_change).
-- void_appointment_payment (095) se redefine para no dejar lo devuelto por encima de lo pagado.
-- appointments_with_details: + cancellation_category, amount_refunded, amount_refund_pending al final.
-- Trigger AFTER INSERT/UPDATE OF status en appointment_refunds -> wa-send (refund_processed / refund_rejected).
```

---

## Blueprint

> Solo fases. Las subtareas se generan al entrar a cada fase (bucle agéntico: mapear contexto → subtareas → ejecutar).

### Fase 1: Base de datos
**Objetivo**: migración 097 con motivo de cancelación, interruptor, tablas de devoluciones e historial (RLS +
RESTRICTIVE de licencia), RPCs de registrar y cambiar estado, guarda en anular pago, anticipo «Devuelto», columnas
nuevas al final de la vista, intents y trigger de WhatsApp; tipos regenerados.
**Validación**: ensayo en `BEGIN/ROLLBACK` por rol (dueño, empleado, otro negocio, licencia bloqueada) con INSERT/UPDATE
reales: el empleado solo registra Pendiente; nadie escribe las tablas directamente; tope de lo pagado; anular pago
bloqueado cuando corresponde; anticipo pasa a `refunded`; el trigger encola solo processed/rejected y respeta el
interruptor. `npx tsc --noEmit` pasa con los tipos nuevos.

### Fase 2: WhatsApp
**Objetivo**: `wa-send` arma «devolución procesada» y «devolución rechazada» (importe con moneda, cómo, número de
turno, motivo del rechazo y contacto), las cuenta como aviso de pago y marca `notice_sent_at`; `wa-inbound` guarda la
categoría «El cliente canceló».
**Validación**: llamar a `wa-send` desde fuera con un negocio desechable y revisar `wa_outbound_messages`. Migración y
despliegue de `wa-send` en el mismo comando (aprendizaje de PRP-009); **desplegar se pregunta antes**.

### Fase 3: Cancelar con motivo
**Objetivo**: hoja de cancelar con la lista y «Otro», validada con Zod y guardada por `updateStatus`; el detalle del
turno cancelado muestra motivo, quién y cuándo.
**Validación**: Playwright: no se puede confirmar sin motivo, «Otro» exige texto, el motivo aparece en el detalle.

### Fase 4: Devoluciones en el turno
**Objetivo**: bloque de devoluciones dentro del dinero del turno (registrar, procesar, rechazar, historial), según rol e
interruptor; fuera «Marcar anticipo devuelto»; totales «Devuelto» y «Devolución pendiente».
**Validación**: Playwright como dueño y como empleado: registrar parcial y total, procesar, rechazar con motivo, tope,
anticipo «Devuelto», historial correcto; sin interruptor no aparece «Registrar devolución».

### Fase 5: Ajustes, manual y validación final
**Objetivo**: interruptor «Hacemos devoluciones» en Ajustes y texto del interruptor de avisos de pago al día; manual
`/help` con motivos y devoluciones (fotos incluidas); memoria y entrega (Tasknic a «En revisión»).
**Validación**:
- [x] `npx tsc --noEmit` pasa
- [x] `npx eslint .` sin errores nuevos
- [x] `npm run build:next` exitoso
- [x] Playwright confirma la UI (dueño y empleado)
- [x] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-10-23: una regla nueva en la BD que la web publicada no cumple
- **Riesgo**: la 097 exige `cancellation_category` al cancelar desde el panel; con la web vieja, cancelar fallaba.
- **Fix**: aplicar migración, desplegar funciones y hacer push en el mismo comando (ventana = build de Vercel, 2-3 min),
  avisando antes a Claudia. Los tipos nuevos se escribieron a mano para compilar antes de aplicar la migración y se
  regeneraron después (coincidieron).
- **Aplicar en**: cualquier trigger o CHECK nuevo que la UI actual no satisface.

### 2026-10-23: la ficha tarda un instante en mostrar el anticipo «Devuelto»
- No es un fallo: el bloque de devoluciones se refresca primero y la ficha justo después (`onAppointmentChange`).

> Esta sección crece con cada error encontrado durante la implementación.

---

## Gotchas

- [ ] Un empleado que registra el pago del anticipo lo deja `paid`; si luego se cancela, la guarda (093) lo pasa a
      `cancelled` aunque haya un pago real. Al devolver, tratar como anticipo cubierto también ese caso (o decidir en la
      Fase 1 si la guarda debe respetar `paid` con pago registrado).
- [ ] Las columnas del anticipo solo cambian con `app.deposit_change = on`: las RPCs de devolución deben encenderlo para
      pasar el anticipo a `refunded`.
- [ ] `appointments_with_details` tiene columnas congeladas: las nuevas van al final (091, 095), y
      `mapToAppointmentWithDetails` / `utils/normalized-state.ts` deben pasarlas.
- [ ] `ALTER TYPE ... ADD VALUE` (intents nuevos) no se puede usar en la misma migración: comparar con `intent::TEXT`.
- [ ] Orden de despliegue: migración y `wa-send` juntos; `wa-inbound` después de la migración (la columna nueva debe
      existir antes de escribirla).
- [ ] Ensayos de triggers con `pg_net`: filtrar `net.http_request_queue` por el cuerpo (`refund_processed`), no contar
      todo (aprendizaje de PRP-009).
- [ ] RLS rechaza en silencio: las RPCs deben levantar errores con código (`refund_forbidden`, `refund_exceeds_paid`…)
      y la UI traducirlos.
- [ ] El tope se calcula con pagos no anulados y devoluciones no rechazadas, con `FOR UPDATE` sobre el turno para que
      dos devoluciones a la vez no superen lo pagado.
- [ ] Moneda siempre con `useMoney` / la moneda del negocio; copy con tuteo y «anticipo».

## Anti-Patrones

- NO dejar escribir las tablas de devoluciones directamente: solo por RPC (como los pagos).
- NO borrar ni editar devoluciones: rechazar y registrar otra.
- NO restar las devoluciones de `amount_paid` ni de `was_paid` (lo decide TUR0011).
- NO crear un interruptor de WhatsApp nuevo: se usa `enable_payment_reminders`.
- NO tocar el flujo de pasajes.

---

## Cómo quedó

- **097** (en producción): `appointments.cancellation_category` + trigger que la exige a quien cancela con sesión;
  `business_settings.refunds_enabled`; `appointment_refunds` y `appointment_refund_events` (solo lectura para miembros,
  RESTRICTIVE de licencia); RPC `register_appointment_refund` y `set_appointment_refund_status`; `void_appointment_payment`
  no deja lo devuelto por encima de lo pagado; `refresh_deposit_refunded`; vista con `cancellation_category`,
  `amount_refunded`, `amount_refund_pending`; trigger `trg_wa_refund_notice`.
- **`wa-send` v39** (`refund_processed`, `refund_rejected`, `notice_sent_at`); **`wa-inbound` v51** (cancelar por WhatsApp =
  `customer`).
- **App**: `CancelAppointmentSheet` + `CancellationNote`, `AppointmentRefunds`, `RefundSheet`, servicio/hook/schema de
  devoluciones; «Marcar anticipo devuelto» eliminado; interruptor «Hacemos devoluciones». **Manual** con foto `refunds.webp`.
- **Probado**: 30 casos por rol en BEGIN/ROLLBACK; en el navegador (app local contra producción, negocio desechable con
  WhatsApp falso, ya borrado): cancelar con «Otro», devolución parcial ya hecha, anticipo «Devuelto», rechazo de una
  pendiente del empleado con historial, textos de WhatsApp y el interruptor en Ajustes. **Sin probar** con un WhatsApp real.

