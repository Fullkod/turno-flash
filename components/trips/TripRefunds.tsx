"use client";

import { useMemberName } from "@/components/appointments/AppointmentPayments";
import { FieldError } from "@/components/appointments/RegisterPaymentSheet";
import { HowFields, issuesToErrors, type RefundErrors } from "@/components/appointments/RefundSheet";
import {
  Button,
  ConfirmSheet,
  Field,
  Sheet,
  sheetInputClasses as inputClasses,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks";
import { useBusinessSettings } from "@/hooks/useBusinessSettings.query";
import { useMoney } from "@/hooks/useMoney";
import {
  useDecideTripRefund,
  useRegisterTripRefund,
  useTripRefunds,
} from "@/hooks/useTripBookingMoney.query";
import {
  appointmentRefundSchema,
  processRefundSchema,
  rejectRefundReasonSchema,
} from "@/schemas/appointment-refund.schema";
import type { PaymentMethod } from "@/services/appointment-payments.service";
import type { TripBookingRefund } from "@/services/trip-booking-money.service";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/utils/deposit";
import { REFUND_STATUS_LABEL, paymentMethodText } from "@/utils/payment";
import { useState } from "react";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_CLASS: Record<TripBookingRefund["status"], string> = {
  pending: "text-warning-700 dark:text-warning-400",
  processed: "text-success-700 dark:text-success-400",
  rejected: "text-danger-600 dark:text-danger-400",
};

const EVENT_TEXT: Record<TripBookingRefund["status"], string> = {
  pending: "Registrada",
  processed: "Devuelta",
  rejected: "Rechazada",
};

const linkClass = "cursor-pointer text-meta font-semibold underline-offset-2 hover:underline";

/**
 * Refunds of a cancelled trip booking, of a cancelled departure or of a no-show
 * (TUR0011, same rules as the appointment ones of TUR0010).
 */
export function TripRefunds({
  bookingId,
  closed,
  paid,
  defaultReason,
}: {
  bookingId: string;
  closed: boolean;
  paid: number;
  defaultReason: string;
}) {
  const { format: money } = useMoney();
  const { data: settings } = useBusinessSettings();
  const { data: refunds = [] } = useTripRefunds(bookingId, closed);
  const [registering, setRegistering] = useState(false);
  const total = (status: TripBookingRefund["status"]) =>
    refunds.filter((r) => r.status === status).reduce((sum, r) => sum + Number(r.amount), 0);
  const refunded = total("processed");
  const pending = total("pending");
  const available = Math.max(paid - refunded - pending, 0);
  const canRegister = (settings?.refunds_enabled ?? true) && available > 0;

  if (!closed || (!refunds.length && !canRegister)) return null;

  return (
    <div className="rounded-[18px] border border-border px-3.5 py-3">
      <div className="text-caption text-foreground-subtle">Devoluciones</div>
      <p className="mt-[3px] text-body text-foreground">
        Devuelto <strong className="font-mono tabular-nums">{money(refunded)}</strong>
        <span className="text-foreground-muted"> de {money(paid)} pagado</span>
      </p>
      {pending > 0 && (
        <p className="text-caption text-warning-700 dark:text-warning-400">
          Devolución pendiente: {money(pending)}
        </p>
      )}

      {refunds.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border">
          {refunds.map((r) => (
            <RefundRow key={r.id} refund={r} />
          ))}
        </ul>
      )}

      {canRegister && (
        <Button variant="secondary" onClick={() => setRegistering(true)} className="mt-3 w-full">
          Registrar devolución
        </Button>
      )}

      {registering && (
        <RegisterTripRefundSheet
          bookingId={bookingId}
          available={available}
          defaultReason={defaultReason}
          onClose={() => setRegistering(false)}
        />
      )}
    </div>
  );
}

function RefundRow({ refund: r }: { refund: TripBookingRefund }) {
  const { profile } = useAuth();
  const { format: money } = useMoney();
  const canManage = profile?.role === "owner" || profile?.role === "admin";
  const [deciding, setDeciding] = useState<"processed" | "rejected" | null>(null);

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-body font-semibold tabular-nums text-foreground">
          {money(Number(r.amount))}
        </span>
        <span className={`text-meta font-semibold ${STATUS_CLASS[r.status]}`}>
          {REFUND_STATUS_LABEL[r.status]}
        </span>
      </div>
      <p className="text-meta text-foreground">
        {r.reason}
        {r.status === "processed" && r.method ? ` · ${paymentMethodText(r.method, r.method_other)}` : ""}
        {r.status === "processed" && r.refunded_at ? ` · ${dateTime(r.refunded_at)}` : ""}
      </p>
      {r.status === "rejected" && r.rejection_reason && (
        <p className="text-caption text-danger-600 dark:text-danger-400">No procede: {r.rejection_reason}</p>
      )}
      <ol className="mt-1 flex flex-col gap-0.5">
        {r.events.map((e) => (
          <EventLine key={e.id} status={e.status} by={e.changed_by} at={e.changed_at} />
        ))}
      </ol>
      {canManage && r.status === "pending" && (
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={() => setDeciding("processed")} className={`${linkClass} text-primary`}>
            Marcar devuelta
          </button>
          <button
            type="button"
            onClick={() => setDeciding("rejected")}
            className={`${linkClass} text-danger-600 dark:text-danger-400`}
          >
            Rechazar
          </button>
        </div>
      )}

      {deciding === "processed" && <ProcessTripRefundSheet refund={r} onClose={() => setDeciding(null)} />}
      {deciding === "rejected" && <RejectTripRefundSheet refund={r} onClose={() => setDeciding(null)} />}
    </li>
  );
}

function EventLine({ status, by, at }: { status: TripBookingRefund["status"]; by: string | null; at: string }) {
  const name = useMemberName(by);
  return (
    <li className="text-caption text-foreground-subtle">
      {EVENT_TEXT[status]}
      {name ? ` por ${name}` : ""} · {dateTime(at)}
    </li>
  );
}

function FormButtons({ busy, label, onClose }: { busy: boolean; label: string; onClose: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="flex-1 justify-center">
        Cancelar
      </Button>
      <Button type="submit" disabled={busy} className="flex-2 justify-center">
        {busy ? "Guardando…" : label}
      </Button>
    </div>
  );
}

/** Any part of what is left to refund. Staff leave it pending; an owner/admin can say it is done. */
function RegisterTripRefundSheet({
  bookingId,
  available,
  defaultReason,
  onClose,
}: {
  bookingId: string;
  available: number;
  defaultReason: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const canManage = profile?.role === "owner" || profile?.role === "admin";
  const { format: money } = useMoney();
  const register = useRegisterTripRefund();
  const [amount, setAmount] = useState(String(available));
  const [reason, setReason] = useState(defaultReason);
  const [processed, setProcessed] = useState(canManage);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [methodOther, setMethodOther] = useState("");
  const [refundedAt, setRefundedAt] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [errors, setErrors] = useState<RefundErrors>({});

  const save = async () => {
    const parsed = appointmentRefundSchema.safeParse({
      amount: amount === "" ? undefined : Number(amount),
      available,
      reason,
      processed,
      method: processed ? method : null,
      methodOther,
      refundedAt: fromLocalDateTimeInput(refundedAt) ?? "",
    });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    const v = parsed.data;
    try {
      await register.mutateAsync({
        bookingId,
        refund: {
          amount: v.amount,
          reason: v.reason,
          processed: v.processed,
          method: v.processed ? v.method : null,
          methodOther: v.processed && v.method === "other" ? v.methodOther : null,
          refundedAt: v.processed ? v.refundedAt : null,
        },
      });
      toast.success(v.processed ? "Devolución registrada" : "Devolución pendiente", money(v.amount));
      onClose();
    } catch (err) {
      toast.error("No se pudo registrar", err instanceof Error ? err.message : undefined);
    }
  };

  const busy = register.isPending;

  return (
    <Sheet open onClose={busy ? () => {} : onClose} title="Registrar devolución">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Importe" hint={`Puedes devolver hasta ${money(available)}.`}>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            max={available}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            className={inputClasses}
          />
          <FieldError message={errors.amount} />
        </Field>

        <Field label="Motivo">
          <textarea
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!errors.reason}
            className={inputClasses}
          />
          <FieldError message={errors.reason} />
        </Field>

        {canManage ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-foreground">¿Ya la devolviste?</legend>
            {[
              { value: true, label: "Ya la devolví" },
              { value: false, label: "Queda pendiente" },
            ].map((o) => (
              <label
                key={o.label}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-border px-3 text-sm text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950"
              >
                <input
                  type="radio"
                  name="trip-refund-processed"
                  checked={processed === o.value}
                  onChange={() => setProcessed(o.value)}
                  className="accent-primary"
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-caption text-foreground-muted">
            La devolución queda pendiente y el dueño la aprueba o la rechaza.
          </p>
        )}

        {processed && (
          <HowFields
            method={method}
            setMethod={setMethod}
            methodOther={methodOther}
            setMethodOther={setMethodOther}
            refundedAt={refundedAt}
            setRefundedAt={setRefundedAt}
            errors={errors}
          />
        )}

        <FormButtons busy={busy} label="Registrar" onClose={onClose} />
      </form>
    </Sheet>
  );
}

function ProcessTripRefundSheet({ refund, onClose }: { refund: TripBookingRefund; onClose: () => void }) {
  const toast = useToast();
  const { format: money } = useMoney();
  const decide = useDecideTripRefund();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [methodOther, setMethodOther] = useState("");
  const [refundedAt, setRefundedAt] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [errors, setErrors] = useState<RefundErrors>({});

  const save = async () => {
    const parsed = processRefundSchema.safeParse({
      method,
      methodOther,
      refundedAt: fromLocalDateTimeInput(refundedAt) ?? "",
    });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    const v = parsed.data;
    try {
      await decide.mutateAsync({
        refundId: refund.id,
        decision: {
          status: "processed",
          method: v.method,
          methodOther: v.method === "other" ? v.methodOther : null,
          refundedAt: v.refundedAt,
        },
      });
      toast.success("Devolución hecha", money(Number(refund.amount)));
      onClose();
    } catch (err) {
      toast.error("No se pudo guardar", err instanceof Error ? err.message : undefined);
    }
  };

  const busy = decide.isPending;

  return (
    <Sheet open onClose={busy ? () => {} : onClose} title="Marcar devuelta">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-body text-foreground">
          Le devolviste <strong className="font-mono tabular-nums">{money(Number(refund.amount))}</strong> al
          pasajero.
        </p>
        <HowFields
          method={method}
          setMethod={setMethod}
          methodOther={methodOther}
          setMethodOther={setMethodOther}
          refundedAt={refundedAt}
          setRefundedAt={setRefundedAt}
          errors={errors}
        />
        <FormButtons busy={busy} label="Marcar devuelta" onClose={onClose} />
      </form>
    </Sheet>
  );
}

function RejectTripRefundSheet({ refund, onClose }: { refund: TripBookingRefund; onClose: () => void }) {
  const toast = useToast();
  const { format: money } = useMoney();
  const decide = useDecideTripRefund();
  const [reason, setReason] = useState("");
  const valid = rejectRefundReasonSchema.safeParse(reason).success;

  return (
    <ConfirmSheet
      open
      onClose={onClose}
      onConfirm={async () => {
        try {
          await decide.mutateAsync({ refundId: refund.id, decision: { status: "rejected", reason: reason.trim() } });
          toast.success("Devolución rechazada");
          onClose();
        } catch (err) {
          toast.error("No se pudo rechazar", err instanceof Error ? err.message : undefined);
        }
      }}
      title="Rechazar devolución"
      confirmLabel="Rechazar"
      busyLabel="Guardando…"
      busy={decide.isPending}
      confirmDisabled={!valid}
    >
      <p className="text-sm text-foreground-muted">
        La devolución de {money(Number(refund.amount))} queda rechazada y no se puede deshacer. Si tienes WhatsApp
        conectado, el pasajero recibe el motivo.
      </p>
      <textarea
        rows={2}
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (por ejemplo, canceló con menos de 24 h)"
        aria-label="Motivo"
        className={`mt-3 ${inputClasses}`}
      />
    </ConfirmSheet>
  );
}
