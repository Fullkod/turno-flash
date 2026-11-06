"use client";

import { useMoney } from "@/hooks/useMoney";

import { KebabMenu, type KebabMenuItem } from "@/components/ui";
import {
  bookingPending,
  bookingTotal,
  type TripBookingWithCustomer,
} from "@/types/trips";
import {
  BadgeCheck,
  Ban,
  Check,
  CircleDollarSign,
  Pencil,
  MapPin,
  Phone,
  Users,
} from "lucide-react";

export interface PassengerRowProps {
  booking: TripBookingWithCustomer;
  canManage: boolean;
  requiresApproval: boolean;
  onApprove: (booking: TripBookingWithCustomer) => void;
  onReject: (booking: TripBookingWithCustomer) => void;
  onRegisterPayment: (booking: TripBookingWithCustomer) => void;
  onEditNames: (booking: TripBookingWithCustomer) => void;
}

const chip =
  "rounded-full border px-2 py-0.5 text-caption font-semibold whitespace-nowrap";

const STATUS_CHIP: Record<string, string> = {
  pending: `${chip} border-warning-600 bg-warning-50 text-warning-600 dark:border-warning-400 dark:bg-warning-900 dark:text-warning-300`,
  confirmed: `${chip} border-success-600 bg-success-50 text-success-600 dark:border-success-400 dark:bg-success-900 dark:text-success-300`,
  cancelled: `${chip} border-danger-600 bg-danger-50 text-danger-600 dark:border-danger-400 dark:bg-danger-900 dark:text-danger-300`,
  completed: `${chip} border-border-2 bg-muted text-foreground-muted`,
  no_show: `${chip} border-danger-600 bg-danger-50 text-danger-600 dark:border-danger-400 dark:bg-danger-900 dark:text-danger-300`,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Por aprobar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Viajó",
  no_show: "No se presentó",
};

const DEPOSIT_CHIP: Record<string, string> = {
  pending: `${chip} border-warning-600 bg-warning-50 text-warning-600 dark:border-warning-400 dark:bg-warning-900 dark:text-warning-300`,
  paid: `${chip} border-success-600 bg-success-50 text-success-600 dark:border-success-400 dark:bg-success-900 dark:text-success-300`,
  refunded: `${chip} border-border-2 bg-muted text-foreground-muted`,
  waived: `${chip} border-border-2 bg-muted text-foreground-muted`,
};

const DEPOSIT_LABEL: Record<string, string> = {
  pending: "Anticipo pendiente",
  paid: "Anticipo cobrado",
  refunded: "Anticipo devuelto",
  waived: "Sin anticipo",
};

function fmtDeadline(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return date.toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PassengerRow({
  booking,
  canManage,
  requiresApproval,
  onApprove,
  onReject,
  onRegisterPayment,
  onEditNames,
}: PassengerRowProps) {
  const { format: money } = useMoney();
  const customer = booking.customer;
  const bookedBy = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : "Cliente eliminado";
  const isCancelled = booking.status === "cancelled";
  // Same helpers as the trip summary, so the extra counts in both
  const total = bookingTotal(booking);
  const pending = bookingPending(booking);
  const missingNames = booking.seats - booking.passenger_names.length;
  const deadline = fmtDeadline(booking.hold_expires_at);
  const isExpiring =
    booking.deposit_status === "pending" && !!booking.hold_expires_at;

  const menuItems: KebabMenuItem[] = [
    {
      // A cancelled booking that had money still opens it, to refund
      label: isCancelled ? "Pagos y devoluciones" : "Registrar cobro",
      onClick: () => onRegisterPayment(booking),
      icon: <CircleDollarSign className="h-4 w-4" />,
      disabled: isCancelled && !(booking.amount_paid > 0),
    },
    {
      label: "Editar nombres de pasajeros",
      onClick: () => onEditNames(booking),
      icon: <Pencil className="h-4 w-4" />,
      disabled: isCancelled,
    },
    // A confirmed booking has nothing left to confirm
    ...(booking.status === "confirmed"
      ? []
      : [
          {
            label:
              booking.status === "pending" ? "Aprobar reserva" : "Confirmar",
            onClick: () => onApprove(booking),
            icon: <BadgeCheck className="h-4 w-4" />,
            disabled: isCancelled,
          },
        ]),
    {
      label: "Cancelar reserva",
      onClick: () => onReject(booking),
      icon: <Ban className="h-4 w-4" />,
      danger: true,
      disabled: isCancelled,
    },
  ];

  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 shadow-xs ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {bookedBy}
            </h3>
            <span className="text-caption font-semibold text-foreground-subtle">
              {booking.booking_number ?? "—"}
            </span>
            {booking.trip_type === "round_trip" && (
              <span className={`${chip} border-info-600 bg-info-50 text-info-600 dark:border-info-400 dark:bg-info-900 dark:text-info-300`}>
                Ida y vuelta
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {booking.seats} asiento{booking.seats === 1 ? "" : "s"}
            </span>
            {customer?.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="h-3 w-3" />
                {customer.phone}
              </a>
            )}
            {booking.pickup_point && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {booking.pickup_point.name}
              </span>
            )}
          </div>

          {/* The two states are shown side by side because they are independent. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={STATUS_CHIP[booking.status]}>
              {STATUS_LABEL[booking.status]}
            </span>
            {/* On a cancelled booking only a paid deposit matters: it must be returned */}
            {(!isCancelled || booking.deposit_status === "paid") && (
              <span className={DEPOSIT_CHIP[booking.deposit_status]}>
                {DEPOSIT_LABEL[booking.deposit_status]}
              </span>
            )}
            {isExpiring && !isCancelled && deadline && (
              <span className={`${chip} border-border-2 bg-muted text-foreground-muted`}>
                Vence {deadline}
              </span>
            )}
            {pending > 0 && !isCancelled && (
              <span className={`${chip} border-warning-600 bg-warning-50 text-warning-600 dark:border-warning-400 dark:bg-warning-900 dark:text-warning-300`}>
                Falta {money(pending)}
              </span>
            )}
            {pending === 0 && total > 0 && !isCancelled && (
              <span className={`${chip} border-success-600 bg-success-50 text-success-600 dark:border-success-400 dark:bg-success-900 dark:text-success-300`}>
                Pagó completo
              </span>
            )}
          </div>

          {booking.passenger_names.length > 0 && (
            <ol className="mt-2 flex flex-wrap gap-1.5">
              {booking.passenger_names.map((name, index) => (
                <li
                  key={`${booking.id}-${index}`}
                  className="rounded-md bg-surface-2 px-2 py-0.5 text-caption text-foreground"
                >
                  {index + 1}. {name}
                </li>
              ))}
            </ol>
          )}

          {missingNames > 0 && !isCancelled && (
            <p className="mt-1.5 text-caption font-semibold text-warning-600 dark:text-warning-300">
              Faltan {missingNames} nombre{missingNames === 1 ? "" : "s"} para la
              lista del chofer
            </p>
          )}

          {booking.notes && (
            <p className="mt-1.5 whitespace-pre-line text-xs text-foreground-muted">
              {booking.notes}
            </p>
          )}
        </div>

        {canManage && <KebabMenu items={menuItems} />}
      </div>

      {canManage && !isCancelled && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => onRegisterPayment(booking)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <CircleDollarSign className="h-3.5 w-3.5" />
            {booking.amount_paid > 0
              ? `Cobrado ${money(booking.amount_paid)}`
              : "Registrar cobro"}
          </button>

          {requiresApproval && booking.status === "pending" && (
            <button
              type="button"
              onClick={() => onApprove(booking)}
              className="bg-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
            >
              <Check className="h-3.5 w-3.5" />
              Aprobar
            </button>
          )}
        </div>
      )}

      {canManage && isCancelled && booking.amount_paid > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => onRegisterPayment(booking)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <CircleDollarSign className="h-3.5 w-3.5" />
            Pagó {money(booking.amount_paid)} · Devoluciones
          </button>
        </div>
      )}
    </div>
  );
}
