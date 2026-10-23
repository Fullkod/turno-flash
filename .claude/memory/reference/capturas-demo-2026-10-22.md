---
name: capturas-demo-2026-10-22
description: Datos de demo ficticios creados en el negocio «Organización test» para las capturas de la web de Fullkod
metadata:
  type: reference
---

El 2026-10-22 se dejaron datos ficticios en el negocio «Organización test» para las capturas de la web de Fullkod
(`Fullkod/fullkod-web/public/sites/turnoflash-*`): 10 servicios y 3 profesionales renombrados, 9 clientes, 12 turnos
del 22 al 25 de octubre, 5 salidas de viajes renombradas y 4 reservas en la de Varadero; 9 clientes de prueba
desactivados. En las capturas el negocio sale como «Barbería Demo» porque se sustituyó en el navegador; en la base
sigue «Organización test» y con el correo del dueño (solo lo cambia la cuenta de plataforma).

Quedan datos QA viejos (~12 servicios «QA F16…», clientes antiguos, un viaje «Cancelada») que inflan los
porcentajes de Reportes. Arranque para capturar: `npx next dev --webpack -p 3104`. Método general: hub
`memoria/reference/capturas-de-proyectos.md`.
