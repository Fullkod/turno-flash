---
name: tasknic
description: Turno Flash enlazado con Tasknic (gestor de tareas del equipo) via skill tasknic
metadata:
  type: reference
---

- **Conectado el 2026-10-15.** La key `TASKNIC_API_KEY` vive en `.env.local` (ignorado por git; nunca commitearla).
  Cada programador pone la suya en su propio `.env.local`.
- Proyecto en Tasknic: **«Turno Flash»** (códigos `TUR0001`…). En el mismo workspace está también «LensSpace».
- Equipo: Roberto Gabriel Cabrera Álvarez (admin), Claudia Rodríguez Rodríguez (admin) y «Claude (Agente IA)».
- **Atribución:** `requested_by` = la persona que chatea en esa sesión: «Roberto Gabriel Cabrera Álvarez» o
  «Claudia Rodríguez Rodríguez» (ver [[preferencias-claudia]]). Nunca asumir uno por defecto.
- **Estados por su clave** (`todo`, `in_progress`, `in_review`, `done`, `discarded`): desde Bash en Windows la tilde
  de «En revisión» llega rota y la API responde `status ... no existe`. Para textos con acentos, escribir el JSON a
  un archivo con Python y mandarlo con `--data-binary @archivo` y `charset=utf-8`.
- **TUR0001** pasó a «En revisión» el 2026-10-16 con la cola terminada (4 comentarios de Claudia con el detalle).
- Tareas iniciales (2026-10-15): TUR0001 «Analizar y cerrar pendientes» (en progreso), TUR0002 petición de Aicenis
  (acortar el horario visible del calendario, p. ej. hasta las 2 pm), TUR0003 cobro de anticipos en turnos (como en
  pasajes), TUR0004 actualizar README y ayuda con fotos reales.
- **Pestaña «Despliegue» (2026-10-15):** el texto «Notas de despliegue» **no se puede editar por la API** (lo pega
  Roberto a mano). «Qué corre ahora» sí: `POST /projects/Turno%20Flash/deployments` con un `sha` ya pusheado
  (`git rev-parse origin/main`), `status` (solo `success`, `failed` o `rolled_back`), `verified` (true solo si se comprobó en vivo), `target`
  (`web`, `migrations`, `edge-functions/<nombre>`; sin target = todo) y `migrations_applied`.
  **Registrar cada despliegue a producción al terminarlo.** Primer registro: `2966d61`, sin verificar. 2026-10-16: registrados 087+088, `wa-send`/`wa-trip-send`/`wa-inbound` (verificados) y la web en `8a99af2` (sin verificar en Vercel). 2026-10-20: la web en `da8fe5c` (arreglo del Logger, sin verificar). 2026-10-23: 095 (verificada) y la web en `19a2f6a` (TUR0008, sin verificar); 096, `wa-send` v38 y `send-reminders` v15 (verificados), `wa-inbound` v50 y la web en `17e8ba8` (TUR0009, sin verificar).
  Además hay una nota larga «Despliegue» en Documentos del Espacio.

- **2026-11-05:** para comprobar tildes de lo que devuelve la API, leer con `sys.stdin.buffer.read().decode("utf-8")`:
  el `json.load(sys.stdin)` de Python en Windows decodifica en cp1252 y muestra «Ã©» aunque en Tasknic esté bien.
  Para mandar texto con tildes, JSON escrito con Write y `--data-binary @archivo` funciona.
