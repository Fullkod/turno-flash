"use client";

import { useMemberName } from "@/components/appointments/AppointmentPayments";
import { TripPaymentForm } from "@/components/trips/TripPaymentForm";
import { TripRefunds } from "@/components/trips/TripRefunds";
import { Button, ConfirmSheet, Field, Sheet, sheetInputClasses as inputClasses } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useSetBookingExtra, useToast } from "@/hooks";
import { useMoney } from "@/hooks/useMoney";
import { useTripPayments, useVoidTripPayment } from "@/hooks/useTripBookingMoney.query";
import { voidPaymentReasonSchema } from "@/schemas/appointment-payment.schema";
import { AppointmentPaymentsService } from "@/services/appointment-payments.service";
import type { TripBookingPayment } from "@/services/trip-booking-money.service";
import type { TripBookingWithCustomer } from "@/types/trips";
import { paymentMethodText } from "@/utils/payment";
import { useState } from "react";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** What a refund says by default: the reason the booking ended. */
function closingReason(booking: TripBookingWithCustomer, tripCancelled: boolean): string {
  if (tripCancelled) return "Salida cancelada";
  if (booking.status === "no_show") return "No vino";
  const reason = booking.cancellation_reason?.trim() ?? "";
  if (!reason || reason === "cancelled_by_business") return "Reserva cancelada por el negocio";
  if (reason === "deposit_expired") return "No pagó el anticipo a tiempo";
  return reason;
}

/**
 * The money of a trip booking (TUR0011): what is owed (seats + extra), every
 * payment with its date and method, voiding with a reason, and the refunds
 * once the booking or its departure is cancelled. Replaces the old single
 * "amount paid" field: the total paid is now the sum of the payments (098).
 */
export function BookingMoneySheet({
  booking,
  tripCancelled,
  onClose,
}: {
  /** Mounted with a key per booking, so local state starts fresh. */
  booking: TripBookingWithCustomer;
  tripCancelled: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { format: money } = useMoney();
  const { data: payments = [] } = useTripPayments(booking.id);
  const saveExtra = useSetBookingExtra();
  const [registering, setRegistering] = useState(false);
  const [voiding, setVoiding] = useState<TripBookingPayment | null>(null);
  const [extraDescription, setExtraDescription] = useState(booking.extra_description ?? "");
  const [extraAmount, setExtraAmount] = useState<number | "">(booking.extra_amount || "");
  const [savedExtra, setSavedExtra] = useState(booking.extra_amount ?? 0);
  const [savedDescription, setSavedDescription] = useState(booking.extra_description ?? "");

  const closed = tripCancelled || booking.status === "cancelled" || booking.status === "no_show";
  const paid = payments.filter((p) => !p.voided_at).reduce((sum, p) => sum + Number(p.amount), 0);
  const seatsTotal = booking.price_total ?? 0;
  const total = seatsTotal + savedExtra;
  const pending = Math.max(total - paid, 0);
  const deposit = booking.deposit_amount ?? 0;
  const depositOwed = deposit > 0 && paid < deposit ? deposit - paid : 0;
  const extraDirty =
    extraDescription.trim() !== savedDescription ||
    (extraAmount === "" ? 0 : extraAmount) !== savedExtra;

  const handleSaveExtra = async () => {
    const amount = extraAmount === "" ? 0 : extraAmount;
    try {
      await saveExtra.mutateAsync({ bookingId: booking.id, extra: { description: extraDescription, amount } });
      setSavedExtra(amount);
      setSavedDescription(extraDescription.trim());
      toast.success("Extra guardado");
    } catch (err) {
      toast.error("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cobros"
      subtitle={`${booking.booking_number ?? ""} · ${booking.seats} asiento(s) · asientos ${money(seatsTotal)}`}
      maxWidthClass="sm:max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[18px] border border-border px-3.5 py-3">
          <p className="text-body text-foreground">
            Pagado <strong className="font-mono tabular-nums">{money(paid)}</strong>
            <span className="text-foreground-muted"> de {money(total)}</span>
          </p>
          <p
            className={`text-caption ${
              pending === 0 ? "text-success-700 dark:text-success-400" : "text-warning-700 dark:text-warning-400"
            }`}
          >
            {paid > total
              ? `Cobrado de más: ${money(paid - total)}`
              : pending === 0 && total > 0
                ? "Pagó el viaje completo."
                : `Falta: ${money(pending)}`}
            {depositOwed > 0 && !closed && ` · anticipo pendiente: ${money(depositOwed)}`}
          </p>

          {payments.length > 0 && (
            <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border">
              {payments.map((p) => (
                <PaymentRow key={p.id} payment={p} onVoid={() => setVoiding(p)} />
              ))}
            </ul>
          )}

          {!closed && (
            <Button variant="secondary" onClick={() => setRegistering(true)} className="mt-3 w-full">
              Registrar pago
            </Button>
          )}
        </div>

        {!closed && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Extra (opcional)" hint="Aeropuerto, otro destino, equipaje…">
              <input
                type="text"
                value={extraDescription}
                onChange={(e) => setExtraDescription(e.target.value)}
                className={inputClasses}
                placeholder="Llevarlo al aeropuerto"
              />
            </Field>
            <Field label="Costo del extra">
              <input
                type="number"
                min={0}
                step="0.01"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputClasses}
              />
            </Field>
            {extraDirty && (
              <Button
                variant="secondary"
                onClick={() => void handleSaveExtra()}
                disabled={saveExtra.isPending}
                className="sm:col-span-2"
              >
                {saveExtra.isPending ? "Guardando…" : "Guardar extra"}
              </Button>
            )}
          </div>
        )}

        <TripRefunds
          bookingId={booking.id}
          closed={closed}
          paid={paid}
          defaultReason={closingReason(booking, tripCancelled)}
        />
      </div>

      {registering && (
        <TripPaymentForm
          booking={booking}
          pending={pending}
          depositOwed={depositOwed}
          onClose={() => setRegistering(false)}
          onSaved={() => setRegistering(false)}
        />
      )}
      {voiding && <VoidTripPaymentSheet payment={voiding} onClose={() => setVoiding(null)} />}
    </Sheet>
  );
}

function PaymentRow({ payment: p, onVoid }: { payment: TripBookingPayment; onVoid: () => void }) {
  const { profile } = useAuth();
  const { format: money } = useMoney();
  const canManage = profile?.role === "owner" || profile?.role === "admin";
  const createdBy = useMemberName(p.created_by);
  const voidedBy = useMemberName(p.voided_by);
  const voided = !!p.voided_at;

  const openReceipt = async () => {
    // Opened before the await: browsers block a window opened later
    const win = window.open("", "_blank");
    const url = p.receipt_path ? await AppointmentPaymentsService.receiptUrl(p.receipt_path) : null;
    if (win && url) win.location.href = url;
    else win?.close();
  };

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`font-mono text-body font-semibold tabular-nums ${
            voided ? "text-foreground-subtle line-through" : "text-foreground"
          }`}
        >
          {money(Number(p.amount))}
        </span>
        <span className="text-caption text-foreground-muted">{dateTime(p.paid_at)}</span>
      </div>
      <p className={`text-meta ${voided ? "text-foreground-subtle" : "text-foreground"}`}>
        {paymentMethodText(p.method, p.method_other)}
        {p.reference ? ` · Ref. ${p.reference}` : ""}
      </p>
      {p.notes && <p className="text-caption text-foreground-muted">{p.notes}</p>}
      {createdBy && <p className="text-caption text-foreground-subtle">Registrado por {createdBy}</p>}
      {voided && (
        <p className="text-caption text-danger-600 dark:text-danger-400">
          Anulado el {dateTime(p.voided_at ?? "")}
          {voidedBy ? ` por ${voidedBy}` : ""} · {p.void_reason}
        </p>
      )}
      <div className="mt-1 flex gap-3">
        {p.receipt_path && (
          <button
            type="button"
            onClick={() => void openReceipt()}
            className="cursor-pointer text-meta font-semibold text-primary underline-offset-2 hover:underline"
          >
            Ver comprobante
          </button>
        )}
        {canManage && !voided && (
          <button
            type="button"
            onClick={onVoid}
            className="cursor-pointer text-meta font-semibold text-danger-600 underline-offset-2 hover:underline dark:text-danger-400"
          >
            Anular
          </button>
        )}
      </div>
    </li>
  );
}

function VoidTripPaymentSheet({ payment, onClose }: { payment: TripBookingPayment; onClose: () => void }) {
  const toast = useToast();
  const { format: money } = useMoney();
  const voidPayment = useVoidTripPayment();
  const [reason, setReason] = useState("");
  const valid = voidPaymentReasonSchema.safeParse(reason).success;

  return (
    <ConfirmSheet
      open
      onClose={onClose}
      onConfirm={async () => {
        try {
          await voidPayment.mutateAsync({ paymentId: payment.id, reason: reason.trim() });
          toast.success("Pago anulado");
          onClose();
        } catch (err) {
          toast.error("No se pudo anular", err instanceof Error ? err.message : undefined);
        }
      }}
      title="Anular pago"
      confirmLabel="Anular"
      busyLabel="Anulando…"
      busy={voidPayment.isPending}
      confirmDisabled={!valid}
    >
      <p className="text-sm text-foreground-muted">
        El pago de {money(Number(payment.amount))} queda tachado y deja de contar. No se borra: se ve quién lo
        anuló, cuándo y por qué. Si cubría el anticipo, el anticipo vuelve a quedar pendiente.
      </p>
      <textarea
        rows={2}
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (por ejemplo, la transferencia no llegó)"
        aria-label="Motivo"
        className={`mt-3 ${inputClasses}`}
      />
    </ConfirmSheet>
  );
}
