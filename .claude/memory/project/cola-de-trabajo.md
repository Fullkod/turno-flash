---
name: cola-de-trabajo
description: Orden de trabajo acordado el 2026-10-15 — qué se hace, en qué orden, y qué quedó descartado o aparcado
metadata:
  type: project
---

Acordado con el equipo el 2026-10-15, al repasar los pendientes.

**Cola terminada el 2026-10-16.** Tres de las cinco ya estaban hechas y las notas no lo decían: **antes de
empezar una tarea de la memoria, comprobar en el código y en producción que sigue pendiente.**

**Cola, en este orden:**
1. ~~**Licencia vencida = bloqueo total** (D-10)~~ — **hecho el 2026-10-16** ([[license-enforcement]]).
2. ~~Botón «Compartir» de una salida~~ — ya existía; el 2026-10-16 se pasó al menú de compartir del teléfono y se añadió en el detalle. Era: botón «Compartir» de una salida que arme el mensaje del viaje para WhatsApp ([[modulo-reserva-asientos]]).
3. ~~Precio ida / ida y vuelta~~ — ya existía (042); el 2026-10-16 se marcó también en la lista del chofer. Era: precio distinto para solo ida y para ida y vuelta (hoy se simula con dos paradas).
4. ~~Reportes con la zona horaria del negocio~~ — **hecho el 2026-10-16** (088; también cierra los reportes a un negocio bloqueado). Era: reportes con la zona horaria del negocio (P0-13, punto 7 de [[qa-piloto-cuba]]).
5. ~~Fecha del detalle de una salida~~ — ya arreglada el 2026-10-08 (`9e1955d`). Era: fecha del detalle de una salida que se ve como `2026-10-09`.

**Ya cerrado:** categorías de servicios en la web, probado en producción.

**Aparcado (no tocar sin que lo pidan):**
- Prueba en iPhone (P1-26): necesita un Mac, no se hará por ahora.
- Vencimiento automático del anticipo no pagado (Fase 5 de pasajes).
- Rol `special`.
- Contestar desde el número propio de cada negocio: se mantiene, para no sobrecargar OpenWA.

**Descartado:** pedidos de fotos sueltas por tamaño y reportes por categoría.

## Épica de finanzas de turnos (tablero Tasknic, desde 2026-10-19)

Claudia elige la tarea del board («procede con la tarea N»): PRP → aprobación → bucle-agentico → push,
comentario y despliegues en Tasknic **solo cuando ella lo pide** → tarea a `in_review`.
- TUR0003 anticipos — en revisión (prueba real con WhatsApp hecha 2026-10-21, OT-0065).
- TUR0007 precio y condiciones — en revisión, asignada a Claudia.
- **TUR0011 Finanzas — subido (`0021703`), comentario a nombre de Claudia y en «En revisión» el 2026-11-05.**
- **TUR0010 devoluciones — entregada en Tasknic el 2026-11-05** (estaba hecha desde el 23/10 pero seguía «En progreso»
  sin comentario): comentario a nombre de Claudia, despliegues 097 / `wa-send` v39 / `wa-inbound` v51 / web `f3ece97`,
  y en «En revisión».
- **TUR0013 «Hacer las pruebas pendientes»** (creada el 2026-11-05, asignada a Claudia): checklist de todo lo que falta
  probar (WhatsApp real de TUR0003/8/9/10/11, Excel en Microsoft Excel, licencias, teléfonos y redes cubanas, limpieza de
  datos de prueba). Lo nuevo sin probar se añade ahí.
- **TUR0008 pagos de cada turno — HECHO EN LOCAL, PAUSADO el 2026-10-22 antes de entregar** (ver abajo).
- Siguientes del board: TUR0009 recordatorios de pago, TUR0010 devoluciones, TUR0011 panel e informes
  (TUR0012 pasarelas de pago).

### Entrega de TUR0008 (2026-10-23)
- Claudia aprobó: push a `main` (`19a2f6a`), comentario en TUR0008 a su nombre, despliegues en Tasknic (`migrations`
  095 verificado; `web` sin verificar en Vercel) y TUR0008 en «En revisión» asignada a ella. Nada pendiente de subir.
- Ofrecimientos anteriores sin respuesta:
  - completar la tabla de resultados de la nota de prueba de TUR0003 en Tasknic y marcar verificado el despliegue
    de `wa-inbound`;
  - marcar el anticipo como «requested» aunque OpenWA dé un falso fallo;
  - limpiar Organización test: quitar el anticipo de «QA Consulta con aprobación», cancelar OT-0065 (ahora tiene un
    pago de 200,01 del backfill de 095), decidir qué hacer con «Tunro con adelanto»;
  - que Roberto revise el otro sistema que responde en la línea de WhatsApp compartida.
- No quedan negocios `qa-fixture-*` en producción (comprobado al pausar).


### TUR0011 panel financiero (revisado con Claudia el 2026-11-05)
- PRP-011 en `.claude/PRPs/prp-financial-reports.md`, **aprobado e implementado el 2026-11-05, en local sin subir**
  (098 pagos de pasajes + destino, 099 devoluciones de pasajes, 100 RPC `get_financial_summary`/`get_financial_rows`, todo
  aplicado en producción; `wa-trip-send` v12 desplegada con permiso; sección `/dashboard/finances`). Pendiente: push,
  comentario y despliegues en Tasknic cuando Claudia lo pida, TUR0011 a «En revisión». Decisiones: solo dueño/admin; Turnos y
  Pasajes en pestañas separadas, los dos en esta tarea; pasajes con historial de pagos y devoluciones como turnos
  (098-099, `amount_paid` pasa a calcularse por trigger), aviso de devolución de pasajes por WhatsApp (`wa-trip-send`,
  desplegar con permiso); campo nuevo «Destino» en las salidas; mismas formas de pago que turnos; Excel hecho a medida;
  filtros de turnos sin número de turno. Estimación 7-9 días, 8 fases.
