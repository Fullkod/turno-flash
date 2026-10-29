import type { Metadata } from "next";
import { WithFullkodCredit } from "@/components/FullkodCredit";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description:
    "Registra tu negocio en Turno Flash y empieza tu prueba gratis para gestionar turnos, clientes y servicios.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WithFullkodCredit pinned>{children}</WithFullkodCredit>;
}
