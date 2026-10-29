import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Eliminación de cuenta | Turno Flash",
  description:
    "Cómo eliminar tu cuenta de Turno Flash y qué datos se eliminan.",
};

const CONTACT_EMAIL = "contact@fullkod.com";

export default function AccountDeletionPage() {
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
          Eliminación de cuenta
        </h1>
        <p className="mb-10 text-sm text-foreground-muted">
          Turno Flash — com.turnoflash.app
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold">
              Eliminar tu cuenta desde la aplicación
            </h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Inicia sesión en Turno Flash.</li>
              <li>
                Ve a <strong>Mi cuenta</strong> en el menú lateral (o visita{" "}
                <Link className="underline" href="/dashboard/account">
                  /dashboard/account
                </Link>
                ).
              </li>
              <li>
                En la sección <strong>Eliminar cuenta</strong>, escribe{" "}
                <strong>ELIMINAR</strong> para confirmar y pulsa el botón.
              </li>
            </ol>
            <p className="mt-2">
              La eliminación es inmediata e irreversible. Si eres dueño de una
              organización con otros miembros, primero deberás quitarles el
              acceso desde Invitar usuario › Tu equipo.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              Solicitar la eliminación por correo
            </h2>
            <p>
              Si no puedes acceder a la aplicación, escríbenos a{" "}
              <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              desde el correo asociado a tu cuenta, con el asunto
              &quot;Eliminar cuenta&quot;. Procesaremos la solicitud en un
              plazo máximo de 30 días.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              Qué datos se eliminan
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Se eliminan de inmediato:</strong> tu cuenta de acceso
                (correo y credenciales) y tu perfil de usuario.
              </li>
              <li>
                <strong>Negocios sin otros miembros:</strong> la organización
                se desactiva y deja de ser accesible. Puedes solicitar por
                correo la eliminación definitiva de todos sus datos (clientes,
                citas, servicios), que se completará en un máximo de 30 días.
              </li>
              <li>
                <strong>Plan de pago:</strong> no hay renovaciones automáticas
                que cancelar. Al eliminar la cuenta dejan de llegarte los
                avisos sobre el acceso del negocio.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
