# PRP-011: Panel financiero e informes (TUR0011)

> **Estado**: IMPLEMENTADO EN LOCAL 2026-11-05 (aprobado por Claudia; 098-100 en producción, `wa-trip-send` v12; falta subir)
> **Fecha**: 2026-10-29 · revisión 2026-11-05
> **Proyecto**: Turno Flash
> **Tarea**: TUR0011 «Crear panel financiero e informes de Turno Flash» (pedida por Claudia; estimación original
> 4-6 días, **7-9 días** tras sumar pasajes con historial de pagos y devoluciones)
> **Base**: PRP-006 (anticipos, 090-092), PRP-007 (condiciones, 093-094), PRP-008 (pagos, 095), PRP-009 (avisos, 096),
> PRP-010 (cancelaciones y devoluciones, 097), módulo de pasajes (033-047, 064). Cierra la épica de finanzas.

---

## Objetivo

Una sección nueva **«Finanzas»** en el panel, con **dos apartados separados: Turnos y Pasajes**. En cada uno, el
dueño ve para el periodo que elija cuánto **espera cobrar**, cuánto **cobró**, cuánto **queda pendiente** y qué está
**vencido**, con un **resumen por periodo** (día, semana o mes) y el **detalle fila por fila**, con filtros y
descarga en **CSV y Excel**.

Para que las cifras de Pasajes sean tan fiables como las de Turnos, los pasajes pasan a tener **historial de pagos**
(cada pago con su día, forma de pago y anulación) y **devoluciones con importe y motivo**, igual que los turnos.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los datos de dinero existen (precio, anticipo, pagos, devoluciones) pero solo se ven turno a turno o reserva a reserva | Totales del periodo en 4 tarjetas: previsto, cobrado, pendiente, vencido |
| «Reportes» solo suma el precio de los turnos terminados: no sabe de pagos reales ni de devoluciones | Las cifras salen de los pagos registrados (TUR0008) y de las devoluciones (TUR0010) |
| En pasajes solo se guarda el total pagado: no se sabe qué día entró cada pago ni cuánto se devolvió | Historial de pagos y devoluciones de pasajes, como en turnos |
| El dueño no sabe a quién reclamarle dinero | Lista de vencidos en cada apartado |
| Para llevar las cuentas (o dárselas al contador) hay que copiar a mano | Descarga en CSV y Excel de exactamente lo que se ve filtrado |
| No hay forma de ver la evolución del dinero en el tiempo | Resumen por día, semana o mes, con gráfico |

**Valor de negocio**: el dueño controla su caja de turnos y de pasajes sin salir de la app, persigue los cobros
atrasados y entrega las cuentas en un archivo. Es el cierre visible de toda la épica de finanzas (TUR0003-TUR0010).

## Qué

### Decisiones de Claudia (2026-11-05)
1. **Lo ven solo el dueño y el admin de la plataforma**, como «Reportes». El admin entra a cualquier negocio con `?org=`.
2. **Turnos y pasajes, en apartados diferentes** (pestañas «Turnos» y «Pasajes»), los dos en esta tarea. Cada
   pestaña aparece solo si el negocio tiene ese módulo activo.
3. **Filtros de Turnos**: día exacto o rango de fechas, servicio, profesional, cliente, forma de pago y estado de
   pago. **Sin** búsqueda por número de turno.
4. **Filtros de Pasajes**: día exacto o rango de fechas, salida (viaje concreto), **destino**, punto de recogida,
   ida / ida y vuelta, estado de pago, pasajero y forma de pago.
5. **Destino**: hoy no existe; se añade el campo opcional **«Destino»** a cada salida. Las salidas viejas quedan sin
   destino (en el filtro, «Sin destino»).
6. **Pasajes con historial de pagos como en turnos**: cada pago guarda día, importe, forma de pago y nota; el dueño
   lo puede anular con motivo.
7. **Pasajes con devoluciones como en turnos**: importe, motivo, pendiente → procesada / rechazada, con historial.
8. **Excel hecho a medida**, sin herramientas nuevas que hagan la app más pesada.

### Definiciones (corregir si no encajan)

Todo en la **moneda del negocio** y con las fechas en la **zona horaria del negocio** (088).

**Turnos**

| Cifra | Qué suma | Fecha que manda |
|-------|----------|-----------------|
| **Previsto** | Precio de los turnos del periodo (`price_charged` o el del servicio), sin cancelados ni «No vino» | Fecha del turno |
| **Cobrado** | Pagos no anulados **menos** devoluciones procesadas (neto; debajo, bruto y devuelto) | Fecha del pago / de la devolución |
| **Pendiente** | Lo que falta cobrar de los turnos previstos (precio − pagado, nunca negativo) | Fecha del turno |
| **Vencido** | Parte de lo pendiente que ya debió cobrarse: (a) anticipos con el plazo pasado y sin pagar; (b) turnos ya pasados o terminados con saldo | Fecha del turno / plazo del anticipo |

**Pasajes**

| Cifra | Qué suma | Fecha que manda |
|-------|----------|-----------------|
| **Previsto** | Precio de las reservas (`price_total` + `extra_amount`), sin canceladas | Fecha de la salida |
| **Cobrado** | Pagos de pasajes no anulados **menos** devoluciones procesadas | Fecha del pago / de la devolución |
| **Pendiente** | Lo que falta cobrar de las reservas previstas | Fecha de la salida |
| **Vencido** | (a) anticipos sin pagar con la reserva provisional ya caducada (`hold_expires_at` pasado); (b) salidas ya pasadas con saldo | Fecha de la salida / caducidad |

En los dos apartados, una línea de **devoluciones pendientes** (registradas, sin resolver).

### Supuestos (corregir si no encajan)
1. **Sección nueva «Finanzas»** en el menú (junto a «Reportes»). Reportes queda como está.
2. **Periodos rápidos**: Hoy, Esta semana, Este mes (entero), Mes pasado, Próximos 30 días y «Personalizado» (un día o
   desde/hasta). Se puede mirar hacia el futuro (lo previsto).
3. **Formas de pago de pasajes** = las de turnos (confirmado por Claudia): efectivo, transferencia, tarjeta, otro. Hoy
   en pasajes se escribe a mano; los pagos viejos se pasan a la forma que se reconozca y, si no, a «otro».
4. **Pagos viejos de pasajes** (9 reservas, 26.000 en total al 2026-11-05): cada uno se convierte en un único pago con
   el día en que se marcó el anticipo como pagado (o, si no consta, el último cambio de la reserva).
5. **Quién registra**: cobrar un pasaje lo puede hacer cualquier miembro del negocio (como hoy); anular un pago lo hace
   el dueño o el admin; una devolución la registra cualquiera como pendiente y la resuelve el dueño, como en turnos.
6. **Interruptor «Hacemos devoluciones»** (097): el mismo de Ajustes sirve para turnos y pasajes.
7. **Aviso por WhatsApp de las devoluciones de pasajes** (confirmado por Claudia): al procesar o rechazar una
   devolución de pasaje, el pasajero recibe el mismo aviso que en turnos. Obliga a cambiar y desplegar `wa-trip-send`
   (el despliegue se pregunta antes, como siempre).
8. **El destino** se ve y edita solo en el panel (crear / editar salida y Finanzas), no en la página pública.
9. **Solo lectura en Finanzas**: cada fila abre la ficha del turno o la reserva, donde se cobra y se devuelve.
10. **Exportar**: CSV y Excel por apartado, con lo filtrado. Excel con hoja «Resumen» y hoja «Detalle».

### Criterios de Éxito
- [ ] En un pasaje se registran varios pagos con su día y forma de pago, se anula uno con motivo, y el total pagado, lo
      pendiente y el estado del anticipo de la reserva quedan bien (como hoy, pero con historial).
- [ ] Al cancelar un pasaje pagado se registra una devolución con importe y motivo, y se procesa o rechaza.
- [ ] Los pagos viejos de pasajes aparecen como un pago cada uno y el total pagado de cada reserva no cambia.
- [ ] La lista del chofer, la página pública de pasajes y los WhatsApp de viajes siguen mostrando lo mismo.
- [ ] Una salida nueva puede tener destino y se filtra por él.
- [ ] En cada apartado, las 4 cifras coinciden con la suma a mano (negocio de prueba + SQL), y el resumen por día /
      semana / mes suma lo mismo que las tarjetas.
- [ ] Cada filtro cambia tarjetas, resumen y detalle de forma coherente, y se combinan entre sí.
- [ ] CSV y Excel abren bien en Excel en español (acentos, columnas, importes como números) con las mismas filas que la
      pantalla.
- [ ] Un empleado no ve Finanzas ni puede leer sus datos llamando a las funciones; un negocio bloqueado tampoco.
- [ ] La guía de `/help` explica Finanzas y el historial de pagos de pasajes, con fotos reales.

### Comportamiento Esperado
1. El dueño abre **Más → Finanzas** y elige **Turnos** o **Pasajes**. Por defecto, **Este mes**.
2. Arriba, 4 tarjetas: **Previsto**, **Cobrado** (neto, con bruto y devuelto debajo), **Pendiente**, **Vencido**; y la
   línea «Devoluciones pendientes» si las hay.
3. **Resumen por periodo**: Día / Semana / Mes, gráfico de barras previsto vs. cobrado y tabla por fila.
4. **Detalle**: en Turnos, número, fecha, cliente, servicio, profesional, estado, precio, pagado, devuelto, pendiente,
   estado de pago. En Pasajes, número de reserva, salida, fecha, destino, punto de recogida, ida / ida y vuelta,
   pasajero, asientos, precio, pagado, devuelto, pendiente, estado de pago. Paginado; tocar una fila abre la ficha.
5. **Filtros** (en móvil, en una hoja desplegable). Tocar la tarjeta «Vencido» aplica ese filtro.
6. **CSV** y **Excel**: `finanzas-turnos_2026-10-01_a_2026-10-31.xlsx` / `finanzas-pasajes_…`.
7. **En la reserva de un pasaje**, «Cobrar» pasa a ser **«Registrar pago»** con la lista de pagos debajo (anular con
   motivo), y al cancelar una reserva pagada se ofrece **registrar la devolución**, como en turnos.

---

## Contexto

### Referencias
- `app/(app)/dashboard/reports/page.tsx` + `components/analytics/` (`KpiCard`, `SectionLabel`, gráficos con `dynamic`).
- `services/analytics.service.ts` + `hooks/useAnalytics.query.ts` — servicio fino sobre RPC + hook con `staleTime`.
- `supabase/migrations/088_analytics_business_timezone.sql` — RPC `SECURITY DEFINER` con chequeo de rol,
  `org_license_usable` y zona del negocio. **Plantilla de las RPC de Finanzas.**
- `supabase/migrations/095_appointment_payments.sql` — tabla de pagos, `register_appointment_payment`,
  `void_appointment_payment`, backfill, RLS + RESTRICTIVE de licencia. **Plantilla de los pagos de pasajes.**
- `supabase/migrations/097_cancellations_refunds.sql` — devoluciones + eventos, `register_appointment_refund`,
  `set_appointment_refund_status`, interruptor. **Plantilla de las devoluciones de pasajes.**
- `supabase/migrations/037_trip_pickup_points_and_payments.sql` — `amount_paid` y el trigger
  `sync_trip_deposit_status`; `038` (extras), `042` (`trip_type`), `064` (cancelaciones de reservas).
- `services/trip-bookings.service.ts#setAmountPaid`, `components/trips/PaymentSheet.tsx`,
  `components/trips/ManualBookingSheet.tsx`, `components/trips/PassengerRow.tsx` — cobro de pasajes de hoy.
- `components/appointments/AppointmentPayments.tsx`, `RegisterPaymentSheet.tsx`, `AppointmentRefunds.tsx` — UI de
  pagos y devoluciones de turnos a imitar.
- Lectores de `trip_bookings.amount_paid` que **no deben cambiar**: `supabase/functions/wa-trip-send`,
  `public-trips`, `components/public-trips/TripsFlow.tsx`, `app/(app)/dashboard/trips/details/page.tsx`.
- `utils/csv.ts`, `utils/payment.ts`, `hooks/useMoney.ts`, `components/nav-items.ts`, `MODULE_ROUTES`.
- `docs/user-manual/` — guía del dueño (Turnos y Pasajes).

### Arquitectura Propuesta (estructura real del repo)
```
supabase/migrations/098_trip_payments.sql        # pagos de pasajes + destino + backfill
supabase/migrations/099_trip_refunds.sql         # devoluciones de pasajes + aviso por WhatsApp
supabase/functions/wa-trip-send/                 # intent nuevo: devolución procesada / rechazada
supabase/migrations/100_financial_reports.sql    # RPC de solo lectura de Finanzas (turnos y pasajes)
services/trip-bookings.service.ts                # registrar / anular pago, devoluciones (ampliado)
components/trips/                                # historial de pagos y devoluciones en la reserva
types/finance.ts  schemas/finance.schema.ts
services/finance.service.ts  hooks/useFinance.query.ts
utils/xlsx.ts                                    # escritor mínimo de .xlsx (sin dependencias)
components/finance/                              # tarjetas, filtros, resumen, tablas
app/(app)/dashboard/finances/page.tsx            # «Finanzas» con pestañas Turnos / Pasajes
```

### Modelo de Datos
- **`trips.destination TEXT`** (opcional).
- **`trip_booking_payments`**: `organization_id`, `trip_booking_id`, `amount > 0`, `method`
  (`appointment_payment_method`), `paid_at`, `note`, `created_by`, `voided_at`, `voided_by`, `void_reason`. Índices
  `(trip_booking_id)` y `(organization_id, paid_at)`. RLS de lectura por miembro + RESTRICTIVE de licencia (087).
- **`trip_booking_refunds`** + **`trip_booking_refund_events`**: mismo diseño que `appointment_refunds` (097).
- **`trip_bookings.amount_paid` se mantiene**, pero lo calcula la base de datos (suma de pagos no anulados) con un
  trigger: así el trigger de anticipo de 037, la lista del chofer, la página pública y `wa-trip-send` siguen igual
  **sin redesplegar funciones**. La app deja de escribirlo directamente.
- RPC de pasajes: `register_trip_payment`, `void_trip_payment`, `register_trip_refund`,
  `set_trip_refund_status` (`SECURITY DEFINER`, mismos chequeos que las de turnos).
- RPC de Finanzas, `STABLE SECURITY DEFINER`, mismo chequeo que 088:
  `get_financial_summary(p_module, p_start_date, p_end_date, p_group_by, p_organization_id, p_filters)` →
  `{ totals, buckets[] }` y `get_financial_rows(p_module, p_start_date, p_end_date, p_organization_id, p_filters,
  p_limit, p_offset)` → filas + `total_count`. `p_module` = `'appointments' | 'trips'`; cada módulo con una sola
  definición de «vencido» y de filtros compartida por las dos funciones.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Pagos de pasajes y destino en la base de datos
**Objetivo**: Migración 098: `trips.destination`, `trip_booking_payments`, RPC registrar / anular, `amount_paid`
calculado por trigger, backfill de los pagos actuales.
**Validación**: Ensayo `BEGIN/ROLLBACK` por rol (owner, staff, admin, bloqueado) con INSERT/UPDATE reales; los 9
pagos actuales pasan a historial y el `amount_paid` y `deposit_status` de cada reserva no cambian (SQL antes/después).

### Fase 2: Devoluciones de pasajes en la base de datos
**Objetivo**: Migración 099 con devoluciones + historial, mismo interruptor que turnos, sin devolver más de lo pagado,
y el aviso por WhatsApp al procesar o rechazar (trigger como `trigger_wa_refund_notice` de 097 + intent nuevo en
`wa-trip-send`, desplegado con permiso).
**Validación**: Ensayo por rol; anular un pago no deja devoluciones por encima de lo pagado; el aviso llega
(`net._http_response` y `wa_outbound_messages`) con el texto en español internacional.

### Fase 3: Pantallas de pasajes
**Objetivo**: «Registrar pago» con historial y anular, alta manual con primer pago, devolución al cancelar, campo
«Destino» al crear / editar salida. Tipos regenerados.
**Validación**: Playwright: cobrar en dos partes, anular, cancelar con devolución; lista del chofer y página pública
siguen mostrando lo mismo. `tsc` y `eslint` limpios.

### Fase 4: Cálculos de Finanzas
**Objetivo**: Migración 100 con las RPC de Finanzas para los dos módulos.
**Validación**: Negocio de prueba con pagos, anulaciones, devoluciones y vencidos en turnos y pasajes; los totales
cuadran con SQL a mano y el resumen suma lo mismo que los totales; staff y bloqueado reciben error.

### Fase 5: Servicio, tipos, filtros y hooks
**Objetivo**: `types/finance.ts`, `schemas/finance.schema.ts`, `FinanceService`, hooks de TanStack Query.
**Validación**: `npx tsc --noEmit` y `npx eslint` limpios; los hooks devuelven datos reales en dev.

### Fase 6: Pantalla «Finanzas»
**Objetivo**: Página con pestañas Turnos / Pasajes, periodos, tarjetas, resumen con gráfico, detalle paginado,
filtros (hoja en móvil); entrada en el menú y en `MODULE_ROUTES`, solo owner/admin; `?org=` para el admin.
**Validación**: Playwright escritorio y móvil: cifras, filtros combinados, fila → ficha; empleado sin acceso;
pestañas según módulos del negocio.

### Fase 7: Exportar a CSV y Excel
**Objetivo**: `utils/xlsx.ts` y los botones de descarga en cada pestaña.
**Validación**: archivos abiertos en Excel en español (y LibreOffice): acentos, columnas, importes numéricos, mismas
filas que la pantalla; funciona en la app Capacitor o queda documentado el límite.

### Fase 8: Manual y validación final
**Objetivo**: «Finanzas» y el nuevo cobro de pasajes en la guía de `/help`, con fotos reales.
**Validación**:
- [x] `npx tsc --noEmit` pasa
- [x] `npx eslint` de lo tocado sin errores nuevos (quedan 6 viejos en `useCapacitor`, `useErrorLogs`, `appointments.service`)
- [x] `npm run build:next` exitoso
- [x] Capturas (puppeteer) en escritorio, móvil y oscuro
- [x] Criterios de éxito cumplidos (Excel probado con openpyxl; abrirlo en Excel real queda para Claudia)

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-11-05: `amount_paid` de pasajes pasa a calcularse
- **Riesgo**: la web publicada seguía escribiendo `amount_paid` a mano; un trigger que lo recalcula en silencio lo habría perdido.
- **Fix**: `guard_trip_amount_paid` (098) rechaza con `amount_paid_managed` cualquier escritura directa (bandera local
  `app.trip_payments_sync`); se nombra `sync_trip_amount_paid_guard` para correr antes que `sync_trip_deposit_status_trigger`.
- **Aplicar en**: toda columna que pase de «la escribe la app» a «la deriva la BD».

### 2026-11-05: importes que no caben en una KpiCard
- **Error**: «103.000 CUP» se montaba sobre el ícono: `Intl` une número y moneda con espacio no separable.
- **Fix**: tarjetas de Finanzas en 1 columna (teléfono) / 2×2. **Aplicar en**: cualquier KpiCard con dinero de 6+ cifras.

### 2026-11-05: `module` es nombre reservado en Next
- `@next/next/no-assign-module-variable` rechaza una variable `module` en una página: usar `activeModule`.

### 2026-11-05: probar sin MCP con un dueño desechable
- El dueño de «Organización test» es la cuenta real de Roberto: no se entra con ella. `ui.cjs` (scratchpad) crea un
  usuario `qa.tur0011.*` con perfil owner/staff en ese negocio, entra por `/login` y lo borra al final. En la pantalla
  de Finanzas, esperar a que carguen los módulos antes de tocar las pestañas (al principio solo hay una).

### 2026-11-05: heredocs largos en Bash
- Un `python - <<'EOF'` o `cat <<'SQL'` muy largo falla con «unexpected EOF». Escribir el script con Write y ejecutarlo.

---

## Gotchas

- [ ] **Fechas en la zona del negocio**: agrupar con `(paid_at AT TIME ZONE v_tz)::date`, como 088. Semanas en lunes.
      Las salidas ya tienen `departure_date` local.
- [ ] **Dos bases de fecha** (cobrado por fecha de pago; previsto/pendiente por fecha del turno o de la salida): un
      pago adelantado cuenta como cobrado en el mes en que entró. Explicarlo en la UI con una línea y en el manual.
- [ ] **`SECURITY DEFINER` salta RLS y las RESTRICTIVE de licencia (087)**: rol, negocio y `org_license_usable` se
      comprueban dentro de cada función. Las tablas nuevas llevan su política RESTRICTIVE.
- [ ] **Pagos anulados no cuentan** y **solo las devoluciones `processed`** restan; las `pending` se muestran aparte.
- [ ] **`amount_paid` de pasajes pasa a ser calculado**: buscar todo lo que lo escribe (`setAmountPaid`, alta manual)
      y moverlo a las RPC; el trigger de 037 debe seguir viendo el valor nuevo (orden de triggers `BEFORE`/`AFTER`).
- [ ] **`deposit_status = 'refunded'` de pasajes** era manual: decidir en la Fase 2 cómo convive con las devoluciones
      nuevas sin romper la etiqueta «Anticipo devuelto» de la lista del chofer.
- [ ] **`deposit_method` era texto libre**: mapear al enum en el backfill; dejar la columna como está (la leen otros).
- [ ] **`extra_amount`** forma parte de lo que se debe en pasajes (038).
- [ ] **Turnos con estado `rescheduled`**: verificar si quedan como fila duplicada al reprogramar; si es así, excluirlos.
- [ ] **CSV en Excel en español**: el separador de lista es `;`; el `downloadCsv` actual usa `,`. Decidir en la Fase 7
      sin romper los CSV existentes.
- [ ] **Escritor `.xlsx` propio**: ZIP «store» con CRC32 y unos XML; importes como celdas numéricas. Si pasa de ~150
      líneas, parar y reconsiderarlo con el equipo.
- [ ] **Descargas en la app nativa**: comprobar cómo funciona hoy el CSV de turnos y usar lo mismo (o
      `@capacitor/share`, ya instalado).
- [ ] **Recharts** solo con `dynamic(..., { ssr: false })` (static export).
- [ ] **Sin N+1**: el detalle sale de una sola llamada.
- [ ] **Manual al día**: actualizar `/help` en el mismo trabajo, con foto (preferencia del equipo).

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (pagos/devoluciones de turnos, KpiCard, useMoney, downloadCsv)
- NO calcular totales en el cliente sumando filas paginadas
- NO duplicar la definición de «vencido» entre funciones o entre SQL y TypeScript
- NO tocar las edge functions de viajes más allá del aviso de devolución (siguen leyendo `amount_paid`)
- NO ignorar errores de TypeScript ni usar `any`
- NO agregar dependencias sin confirmarlo con el equipo
- NO omitir validación Zod de los filtros

---

*Implementado el 2026-11-05. Migraciones 098-100 aplicadas, `wa-trip-send` v12 desplegada con permiso; el código web sin subir.*
