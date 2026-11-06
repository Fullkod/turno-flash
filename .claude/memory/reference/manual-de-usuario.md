---
name: manual-de-usuario
description: Donde vive el manual para clientes (/help), como se construye y que hay que tocar cuando cambia una funcionalidad
metadata:
  type: reference
---

Manual para los negocios (no para developers), en español internacional, con 4 guías: Turnos o
Viajes × Dueño o Personal. Hecho el 2026-09-12.

- **Fuente única:** `docs/user-manual/turno-flash-user-manual.html`. Es una página autónoma (con su
  propio JS de pestañas). Estuvo publicada como Artifact
  (`.../artifact/aabd8212-a6ff-4594-b8a4-2ea241cc47e7`), pero **ese enlace ya no se puede leer desde
  2026-10-06** (borrado o de otra cuenta): no intentar republicarlo. Si Roberto quiere una copia
  publicada, crear una nueva y anotar aquí el enlace
- **En la app:** `/help` (`app/(app)/help/page.tsx`) lee ese archivo **en el build**, extrae el `<style>` y
  los 4 `<article class="panel">`, y `components/help/HelpManual.tsx` arma el encabezado, las
  pestañas y el índice. Entrada: "Ayuda" en `Sidebar` y `Drawer`. Abre sola la guía que le
  corresponde al usuario logueado (rol + módulos); un link `/help#vd-pasajeros` gana.
- Los tokens CSS del manual llevan prefijo `--hm-*` para no pisar los de la app, y el tema oscuro
  se engancha poniendo `data-theme` en `<html>` según la clase `.dark` de la app.
- El preflight de Tailwind quita viñetas y pone `svg { display: block }`: el CSS del manual
  restituye `list-style` a mano. Si algo se ve distinto en `/help` que en el Artifact, es eso.

**Why:** Roberto pidió el manual "en la misma app, en /help"; leerlo en build evita tener el texto
duplicado y la app nativa lo lleva offline.
**How to apply:** cuando cambie algo visible para el negocio (botones, flujos, límites), editar el
HTML de `docs/user-manual/`, respetando la estructura `article.panel` + `h2[id]`, (los avisos van como
`<div class="callout tip|note|warn"><span class="tag">…</span>…</div>`). La sección "Lo que todavía no se puede hacer" de cada guía lista
agujeros reales: sacar el ítem cuando se arregle.

Relacionado: [[modulo-reserva-asientos]], [[copy-espanol-internacional]], [[mapa-docs]].

**Guía de primeros pasos (2026-10-06):** además del manual, el dueño nuevo ve en Inicio la tarjeta
"Pon en marcha tu negocio" (`components/onboarding/SetupGuide.tsx`), mencionada en las secciones
"Puesta en marcha" del manual. Si cambia un paso de la guía, revisar también esas secciones.

**Actualizado el 2026-10-08** con el cierre de P3 (21 cambios): botón Actualizar, «Hoy · fecha» y «Por la
mañana/tarde», filtro No vino y búsqueda completa, apellido opcional, Cuenta de la app y Mis turnos, pasos de la
reserva pública (salto de «¿Con quién?», cliente recordado, Escribir al negocio, Copiar instrucciones), 👍 y nota
de voz, avisos de licencia, y CSV que no aparece en el teléfono.

**Actualizado el 2026-10-12:** rediseño v2 (nombres de estado, navegación, Turnos por día) y «Mi cuenta» editable
(nombre, contraseña pidiendo la actual, WhatsApp del dueño). «Lo que todavía no se puede hacer» ya solo manda a
soporte para cambiar el nombre del negocio; el WhatsApp del negocio se cambia en Ajustes.

**Fotos de la guía:** `passenger.webp` rehecha el 2026-10-08 (receta en [[turno-flash-tooling]]). Las otras siete
muestran la cabecera sin el botón «Actualizar», y `booking-page.webp` / `trips-page.webp` muestran Copiar y
Compartir en la tarjeta apagada de abajo, que ya no aparecen. Diferencias menores, sin rehacer.

- **2026-10-12:** textos al día con el rediseño v2 (estados Avisado / Confirmó / Llegó / Terminado / No vino, acciones «Marcar llegada», «Empezar atención», «Terminar», barra inferior con «Más», filas en vez de tarjetas) y las 8 fotos de la guía de primeros pasos rehechas. La hoja de estilos propia del manual sigue con los colores de antes. Ver [[rediseno-v2]].

**Fotos en el manual (2026-10-15, TUR0004):** 18 capturas reales de teléfono en `public/images/help/<nombre>.webp`
(520 px de ancho, ~25 KB cada una), insertadas como `<figure class="shot">` en 19 secciones (una por pantalla
clave; las de texto puro, sin foto). Van después del primer párrafo, o después de su lista si ese párrafo termina
en «:». Rutas absolutas `/images/help/…`: en el HTML suelto de `docs/` no cargan, en `/help` sí.
Se sacaron sobre dos negocios desechables («Barbería La Esquina» y «Rutas del Caribe», slugs `qa-fixture-ayuda-*`,
WhatsApp apagado y sin sesión para que ningún trigger mande mensajes; borrados al terminar), con el reloj del
navegador fijado a las 10:40 para que la agenda parezca de media mañana (`context.clock.install`).
Ojo al sembrar pasajes: los puntos de recogida tienen su propio precio (por defecto 0 → la página pública dice
«Desde 0 US$»). La pantalla de equipo del dueño es `/dashboard/invite` (`/dashboard/users` es solo de admin).

- **2026-10-16 (TUR0002):** h3 «Acortar las horas del calendario» en la agenda del dueño y fila «Día» de ambas guías; 19.ª foto
  `calendar-hours.webp`, sacada con **puppeteer-core + Chrome local** (390x700 @2x, `prefers-color-scheme: light` emulado,
  `nextjs-portal` oculto por CSS) y reducida a 520 px con sharp; el MCP de Playwright va a DPR 1 y en oscuro, no sirve
  para fotos. Ver [[horario-calendario]].
- **2026-10-19 (TUR0003):** h3 «Pedir un anticipo» en Servicios y anticipo en Crear un turno, estados, reserva online,
  WhatsApp (envíos y respuestas), límites y guía del personal; 20.ª foto `deposit.webp` (ficha de un turno con el
  anticipo pendiente), con puppeteer-core + sharp instalados en el scratchpad y un negocio desechable renombrado
  «Estudio Luz» para la foto (borrado al terminar).
- **2026-11-05 (TUR0011):** h2 «Finanzas» en las guías del dueño de turnos y de viajes, «Registrar un cobro» de pasajes
  rehecho (pago por pago), «Devolver dinero de una reserva cancelada», campo «Destino», aviso de devolución en la tabla de
  WhatsApp y el personal de viajes sí registra cobros. Fotos nuevas `finances`, `finances-trips` y `trip-payments`
  (puppeteer-core + sharp, dueño desechable en Organización test, 390x700 @2x → 520 px).
