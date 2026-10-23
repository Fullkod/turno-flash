---
name: turno-flash-tooling
description: "Datos de tooling de turno-flash — CLI de Supabase enlazado sin npx, lint roto, regeneración de tipos"
metadata:
  type: project
---

En turno-flash (gestión de turnos, Next.js 16 + Supabase + Capacitor):

- El CLI `supabase` funciona **sin npx** y el proyecto está enlazado al remoto
  (`gotetvnmnlrsfhsnounn`). `supabase db push` aplica migraciones sin pedir
  confirmación interactiva real (auto-confirma).
- Tras cambiar el esquema, regenerar tipos con
  `supabase gen types typescript --linked > types/database.types.ts`
  (usar Bash, no PowerShell: `>` en PS 5.1 escribe UTF-16 y PowerShell
  `-replace`+`Set-Content` corrompe los acentos UTF-8 de los .tsx).
- `npm run lint` está roto (`next lint` se eliminó en Next 16); usar
  `npx eslint <paths>`. Errores preexistentes conocidos: Drawer.tsx
  (setState en efecto), customers/page.tsx (useVirtualizer), dashboard/page.tsx
  (roleLabel sin uso).
- CLI de Supabase: el que se usa es el de **scoop** (`~/scoop/shims/supabase`), v2.117.0 desde
  2026-09-10 (`scoop update supabase`). La devDependency `supabase` 2.72.4 de package.json no se usa.
- SQL contra produccion sin MCP: `supabase db query --linked "select ..."` o `-f archivo.sql`
  (via Management API). Para probar migraciones sin persistir, ver Aprendizajes del PRP de reserva online.
- Edge functions: `supabase functions deploy <nombre> --use-api` (sin Docker; el daemon suele estar apagado).
  No hay Deno: chequear sintaxis antes con `typescript.transpileModule` desde Node.
- Antes de `supabase db push`, correr `supabase migration list --linked` (la 028 estaba aplicada a mano).
- Build de producción: `npm run build:next` (el `build` normal añade scripts
  de Capacitor). Desde 2026-10-06 ambos corren después `scripts/fix-windows-export.mjs`
  (ver [[arquitectura-static-export]]). Las páginas del panel viven en `app/(app)/dashboard/`.
- pg_cron se habilitó en la migración 025 (antes los recordatorios WhatsApp NO
  corrían automáticamente); jobs: `wa-reminders` y `wa-daily-summary` cada 15 min.
- El usuario (Roberto) prefiere actualizar el landing solo cuando un plan
  completo está terminado, no por fases ([[preferencias-roberto]]).

## En el equipo de Claudia/Klaudia (2026-10-16)

- El CLI de scoop (v2.121) está, pero el proyecto **no estaba enlazado**: `supabase link --project-ref
  gotetvnmnlrsfhsnounn` (sin contraseña de BD basta para `db query`, `db push`, `migration list` y `functions`).
- Suele haber ya un `npm run dev` en el puerto 3000 con este mismo árbol: un segundo falla por el lock de
  `.next/dev`; usar el que está.
- No hay navegadores de `ms-playwright`: usar el MCP de Playwright (deja `.playwright-mcp/`, ya ignorado por git).
  Si el MCP dice «Browser is already in use», usar `ui.cjs` (puppeteer-core + sharp en el scratchpad, Chrome de
  `C:/Program Files/Google/Chrome/Application/chrome.exe`): ver los aprendizajes de PRP-007.
- `supabase functions deploy` respeta `verify_jwt` de `config.toml` (`wa-inbound` y `revenuecat-webhook` en false).

## Probar en navegador y medir (2026-10-06)

- **El MCP de Playwright suele estar ocupado** por otra sesión ("Browser is already in use") y el **MCP de
  Supabase puede estar sin autenticar**. Alternativas que funcionan: `playwright-core` instalado en el
  scratchpad (no en el repo) lanzando el Chromium de `~/AppData/Local/ms-playwright/chromium-*/chrome-win64/chrome.exe`;
  para datos, el CLI (`supabase inspect db table-stats --linked`) o REST con la clave de servicio de `.env.local`.
- En `next dev` el overlay de errores (`<nextjs-portal>`) tapa botones y sale en las capturas: ocultarlo con
  `page.addStyleTag({ content: "nextjs-portal{display:none!important}" })`. Los `<input type=date>` salen en
  formato español solo si Chromium arranca con `--lang=es-ES`.
- **Medir el peso real de una página:** `npm run build:next`, servir `out/` y sumar el tamaño **brotli** de cada
  respuesta (así lo sirve Vercel). `python -m http.server` no resuelve `/ruta` a `ruta.html`; para navegar el
  panel exportado hace falta un servidor mínimo que lo haga. Parar esos servidores antes de recompilar.
- `npm run dev` bloquea las carpetas de `app/`: pararlo antes de moverlas y borrar `.next/dev` después.
- No terminar un comando Bash con `cat > archivo` sin heredoc: se queda esperando entrada hasta el timeout.

## Aprendido el 2026-10-08

- **Scripts de edición grandes:** un heredoc de Bash colapsa `\\` en `\` (rompe regex y `\u{…}`) y se trunca si es
  largo. Escribir el `.py` o `.cjs` con Write en el scratchpad y ejecutarlo desde ahí.
- **Ensayar migraciones:** `supabase db query --linked -f` con `BEGIN … ROLLBACK`, juntando los resultados en una
  tabla temporal y un único `SELECT` final (solo vuelve el último resultado). Para simular un rol dentro de un `DO`:
  `set_config('request.jwt.claims', …, true)` + `SET LOCAL ROLE authenticated` + `RESET ROLE`.
  **Atajo (2026-10-14):** un solo `DO $$ … $$` sin BEGIN/ROLLBACK: cada paso en su `BEGIN … EXCEPTION WHEN OTHERS`
  (subtransacción) acumulando `SQLERRM` en una variable, y al final `RAISE EXCEPTION 'RESULTS >> %', r`: deshace
  todo (incluido un GRANT de prueba) y los resultados vuelven en el mensaje de error del CLI. `grep -o 'RESULTS >>.*'`.
  Ojo: `pg_class.reltuples` da -1 en tablas nunca analizadas (contar con `count(*)`); la tabla de errores se llama
  `error_logs` con columnas `error_message`, `error_stack`, `timestamp`, `last_occurrence`, `error_count`, `resolved`;
  `customers.last_name` es NOT NULL (el panel manda `''` cuando no hay apellido).
- **Logs de edge functions sin MCP:** el token del CLI está en el Administrador de credenciales de Windows
  (`Supabase CLI:supabase`, blob UTF-8 `sbp_…`, se lee con `CredReadW` por P/Invoke desde PowerShell). El endpoint
  `analytics/endpoints/logs.all` ya no existe; `analytics/endpoints/logs?sql=…&iso_timestamp_start=…` responde pero el
  2026-10-14 devolvió 0 filas para `function_logs`/`function_edge_logs` (sin resolver). Alternativa que sí sirvió:
  reproducir la consulta PostgREST con la clave de servicio (`Accept: application/vnd.pgrst.object+json` → 406 PGRST116).
- **Verificar un trigger → pg_net → edge function:** la respuesta queda en `net._http_response` (`status_code`,
  `content`, `error_msg`, `created`); consultar unos segundos después del insert que dispara.
- **Definición viva de una función:** `select pg_get_functiondef(oid) …` por `db query`, guardar a un archivo y
  generar la migración reemplazando solo lo necesario. La consola de Windows muestra mal los acentos; el archivo
  queda bien en UTF-8.
- **Funciones desplegadas y su `verify_jwt`:** `supabase functions list`. `config.toml` declara `wa-inbound` y
  `revenuecat-webhook` con `verify_jwt = false`.
- **Probar una edge function pública desde fuera:** `curl` con la clave anon de `.env.local` (cargarla con
  `set -a; . ./.env.local`, sin imprimirla). Con un `service_id` o `trip_id` inexistente se prueba la validación
  sin crear nada.
- **Chequear la sintaxis de una edge function sin Deno:** `typescript.transpileModule` desde Node; sirve también
  para extraer una función suelta y ejecutarla con datos de ejemplo (ojo: los archivos tienen CRLF).
- **Playwright MCP funcionó** en esta sesión (login del empleado QA, medidas con `browser_evaluate`). El MCP de
  Supabase seguía sin autenticar: se usó el CLI.
- **Rehacer una foto de la guía:** `playwright-core` instalado en el scratchpad + Chromium de `ms-playwright`,
  viewport 390x700 con `deviceScaleFactor: 2`, `--lang=es-ES`, ocultar `nextjs-portal`, contorno naranja `#f97316`
  por estilo en línea, `sharp().resize(520, 933).webp({ quality: 80 })`. Negocio `qa-fixture-*` creado con la clave
  de servicio (`create_organization_with_owner`) y borrado en el `finally`.
- **Con `npm run dev` corriendo**, `tsc` puede mostrar errores de `.next/dev/types/validator.ts` al agregar un
  layout nuevo: son tipos generados viejos; se van con `npm run build:next`.
- `.playwright-mcp/` está en `.gitignore` desde el 2026-10-08.
- **Playwright sin el MCP (2026-10-14):** el de la caché de npx (`npm-cache/_npx/*/node_modules/playwright`, la 1.63.0) se carga con `createRequire` desde un script del scratchpad; esperar `networkidle` antes de llenar el login (si no, el clic no hace nada). `npm run dev` toma el primer puerto libre (ese día el 3002). Los avisos de sonner que lee un guion pueden ser del paso anterior: no usarlos como prueba.
- **Comparar el peso de una build vieja:** un worktree con `node_modules` enlazado (junction) no compila: Turbopack lo rechaza por estar fuera de la raíz. Hace falta un `npm ci` propio.

## Android build: Ionic Appflow, not local (2026-10-12)

Roberto generates the Android app in Ionic's cloud dashboard (`https://dashboard.ionicframework.com/`),
building from the GitHub repo. Do **not** run `gradlew bundleRelease` locally (it also takes 10+ minutes
here). "Preparing a release" means: bump `versionCode`/`versionName` in `android/app/build.gradle`,
commit, and make sure it is pushed; he launches the build and uploads it to Play Console himself.
State on 2026-10-12: `versionCode 3` / `1.1.0` is on `origin/main` (commit `e0bbe67`); Play still has
code 2 (1.0.1, June 2026). Production access was requested on 2026-10-12 at 16:21.

- **Probar la UI contra producción (2026-10-23):** `npm run dev` en segundo plano + MCP de Playwright a 390x844 con un
  negocio desechable creado con la clave de servicio (y `openwa_session_id` falso para que no salga ningún WhatsApp).
  Para una foto del manual: ocultar el botón de Next con `nextjs-portal{display:none}` y recortar con `sharp` a webp.
