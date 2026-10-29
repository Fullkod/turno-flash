import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones | Turno Flash",
  description:
    "Términos y condiciones de uso de Turno Flash: suscripciones, responsabilidades y uso aceptable.",
};

const LAST_UPDATED = "12 de octubre de 2026";
const CONTACT_EMAIL = "contact@fullkod.com";

export default function TermsPage() {
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
          Términos y Condiciones
        </h1>
        <p className="mb-10 text-sm text-foreground-muted">
          Última actualización: {LAST_UPDATED}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold">1. El servicio</h2>
            <p>
              Turno Flash es una plataforma de gestión de turnos y citas para
              negocios de servicios. Al crear una cuenta o usar la Aplicación
              aceptas estos términos. Si no estás de acuerdo, no uses la
              Aplicación.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">2. Cuentas</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Eres responsable de mantener la confidencialidad de tus
                credenciales y de toda actividad realizada con tu cuenta.
              </li>
              <li>
                Debes proporcionar información veraz y mantenerla actualizada.
              </li>
              <li>
                Puedes eliminar tu cuenta en cualquier momento (ver{" "}
                <Link className="underline" href="/account-deletion">
                  eliminación de cuenta
                </Link>
                ).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              3. Planes y pagos
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Cada negocio usa la Aplicación con un plan de pago, que
                depende de su tamaño y de si da turnos, vende pasajes o hace
                ambas cosas. Los planes y sus precios vigentes se publican en
                nuestro sitio web.
              </li>
              <li>
                Al registrar un negocio tienes 15 días de prueba gratis. La
                prueba se da una sola vez por negocio.
              </li>
              <li>
                El plan se paga fuera de la Aplicación, en dólares
                estadounidenses, por transferencia o en efectivo, coordinándolo
                con nuestro soporte. Se paga por adelantado un período de 1, 3,
                6 o 12 meses.
              </li>
              <li>
                No hay renovación automática: no guardamos medios de pago ni
                hacemos cobros por nuestra cuenta. Antes de que venza tu
                período te avisamos por WhatsApp y dentro de la Aplicación.
              </li>
              <li>
                Si un período vence sin que registremos un pago, el negocio
                sigue funcionando 5 días de margen. Después queda bloqueado
                hasta que se registre un pago. Los días de margen usados
                cuentan dentro del período siguiente; los días que el negocio
                estuvo bloqueado, no.
              </li>
              <li>
                Un negocio bloqueado conserva sus datos, con el alcance que
                indica la{" "}
                <Link className="underline" href="/privacy">
                  Política de Privacidad
                </Link>
                .
              </li>
              <li>
                Los precios pueden cambiar; te avisaremos con antelación y el
                cambio aplicará a partir del siguiente período que pagues.
              </li>
              <li>
                Si tienes un problema con un pago, escríbenos y lo revisamos
                contigo.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              4. Datos de los clientes del negocio
            </h2>
            <p>
              Como negocio usuario de la Aplicación, eres responsable de los
              datos de tus clientes que registras (nombres, teléfonos, citas) y
              de contar con su consentimiento para usarlos, incluido el envío
              de recordatorios por WhatsApp. Nosotros tratamos esos datos según
              la{" "}
              <Link className="underline" href="/privacy">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">5. Uso aceptable</h2>
            <p>No está permitido:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Usar la Aplicación para enviar spam o mensajes no consentidos.</li>
              <li>Intentar acceder a datos de otras organizaciones.</li>
              <li>
                Revender, descompilar o interferir con el funcionamiento del
                servicio.
              </li>
            </ul>
            <p className="mt-2">
              Podemos suspender cuentas que incumplan estos términos.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              6. Disponibilidad y responsabilidad
            </h2>
            <p>
              Trabajamos para mantener el servicio disponible y seguro, pero la
              Aplicación se ofrece &quot;tal cual&quot;, sin garantía de
              disponibilidad ininterrumpida. En la medida permitida por la ley,
              nuestra responsabilidad total queda limitada al importe pagado
              por el servicio en los últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">7. Cambios</h2>
            <p>
              Podemos actualizar estos términos. Si el cambio es sustancial, lo
              notificaremos dentro de la Aplicación antes de que entre en
              vigor.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">8. Contacto</h2>
            <p>
              Para cualquier duda sobre estos términos:{" "}
              <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
