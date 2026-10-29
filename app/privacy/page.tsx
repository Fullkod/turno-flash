import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad | Turno Flash",
  description:
    "Política de privacidad de Turno Flash: qué datos recopilamos, cómo los usamos y cuáles son tus derechos.",
};

const LAST_UPDATED = "12 de octubre de 2026";
const CONTACT_EMAIL = "contact@fullkod.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
        >
          ← Volver al inicio
        </Link>

        <h1 className="mb-2 text-3xl font-semibold text-foreground">
          Política de Privacidad
        </h1>
        <p className="mb-10 text-sm text-foreground-muted">
          Última actualización: {LAST_UPDATED}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold">1. Quiénes somos</h2>
            <p>
              Turno Flash (&quot;la Aplicación&quot;, &quot;nosotros&quot;) es
              una plataforma de gestión de turnos y citas para negocios de
              servicios. Esta política describe qué datos personales
              recopilamos, con qué finalidad y cuáles son tus derechos. Para
              cualquier consulta puedes escribirnos a{" "}
              <a
                className="underline"
                href={`mailto:${CONTACT_EMAIL}`}
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              2. Datos que recopilamos
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Datos de cuenta:</strong> correo electrónico, nombre y
                contraseña (almacenada de forma cifrada) de los usuarios que se
                registran, y el número de WhatsApp de quien registra el
                negocio.
              </li>
              <li>
                <strong>Datos del negocio:</strong> nombre de la organización,
                zona horaria, teléfono de WhatsApp, servicios y personal.
              </li>
              <li>
                <strong>Datos de clientes del negocio:</strong> nombre,
                teléfono y, opcionalmente, correo y notas que el negocio
                registra para gestionar sus turnos.
              </li>
              <li>
                <strong>Datos de citas:</strong> fechas, horarios, servicio,
                profesional asignado y estado de cada turno.
              </li>
              <li>
                <strong>Datos del plan y de los pagos:</strong> el plan del
                negocio y, por cada pago que registramos, la fecha, el importe
                y el período que cubre. El pago se hace fuera de la Aplicación:
                no recibimos ni guardamos datos de tarjetas ni de cuentas
                bancarias.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              3. Para qué usamos los datos
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Prestar el servicio: agendar, recordar y gestionar turnos.</li>
              <li>
                Enviar recordatorios y confirmaciones por WhatsApp a los
                clientes del negocio, cuando el negocio activa esa función.
              </li>
              <li>Gestionar los planes y el acceso de cada negocio.</li>
              <li>
                Avisar por WhatsApp a quien registró el negocio antes de que
                venza su acceso.
              </li>
              <li>Diagnosticar errores y mejorar la Aplicación.</li>
            </ul>
            <p className="mt-2">
              No vendemos tus datos ni los usamos para publicidad.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              4. Con quién compartimos datos
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> (alojamiento de base de datos y
                autenticación), con cifrado en tránsito y en reposo.
              </li>
              <li>
                <strong>Proveedor de mensajería WhatsApp</strong> para el envío
                de recordatorios, cuando el negocio lo habilita, y de los
                avisos sobre el acceso del negocio.
              </li>
            </ul>
            <p className="mt-2">
              Estos proveedores actúan como encargados del tratamiento y solo
              procesan datos siguiendo nuestras instrucciones.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              5. Conservación y seguridad
            </h2>
            <p>
              Conservamos los datos mientras la cuenta esté activa. Aplicamos
              aislamiento por organización (cada negocio solo accede a sus
              propios datos), control de acceso por roles y cifrado en
              tránsito (HTTPS/TLS).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">6. Tus derechos</h2>
            <p>
              Puedes acceder, corregir o eliminar tus datos. Puedes{" "}
              <Link className="underline" href="/account-deletion">
                eliminar tu cuenta y sus datos
              </Link>{" "}
              desde la propia Aplicación o solicitándolo por correo a{" "}
              <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              . Atenderemos la solicitud en un plazo máximo de 30 días.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">7. Menores de edad</h2>
            <p>
              La Aplicación está dirigida a negocios y no está destinada a
              menores de 13 años.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">8. Cambios</h2>
            <p>
              Si modificamos esta política, actualizaremos la fecha de
              &quot;última actualización&quot; y, si el cambio es relevante, te
              lo notificaremos dentro de la Aplicación.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
