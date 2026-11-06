"use client";

import { FieldError, METHOD_OPTIONS } from "@/components/appointments/RegisterPaymentSheet";
import { Button, Field, Select, Sheet, sheetInputClasses as inputClasses } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks";
import { useMoney } from "@/hooks/useMoney";
import {
  useDecideAppointmentRefund,
  useRegisterAppointmentRefund,
} from "@/hooks/useAppointmentRefunds.query";
import { appointmentRefundSchema, processRefundSchema } from "@/schemas/appointment-refund.schema";
import type { PaymentMethod } from "@/services/appointment-payments.service";
import type { AppointmentRefund } from "@/services/appointment-refunds.service";
import type { AppointmentWithDetails } from "@/types/appointments";
import { cancellationLabel } from "@/utils/cancellation";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/utils/deposit";
import { useState } from "react";

export type RefundErrors = Partial<Record<"amount" | "reason" | "method" | "methodOther" | "refundedAt", string>>;
type Errors = RefundErrors;

export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const next: Errors = {};
  for (const issue of issues) {
    const key = issue.path[0] as keyof Errors;
    next[key] ??= issue.message;
  }
  return next;
}

/** How and when the money went back: method (+ which one) and date. */
export function HowFields({
  method,
  setMethod,
  methodOther,
  setMethodOther,
  refundedAt,
  setRefundedAt,
  errors,
}: {
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  methodOther: string;
  setMethodOther: (v: string) => void;
  refundedAt: string;
  setRefundedAt: (v: string) => void;
  errors: Errors;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cómo">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha">
          <input
            type="datetime-local"
            value={refundedAt}
            onChange={(e) => setRefundedAt(e.target.value)}
            aria-invalid={!!errors.refundedAt}
            className={inputClasses}
          />
        </Field>
      </div>
      <FieldError message={errors.method ?? errors.refundedAt} />
      {method === "other" && (
        <Field label="¿Cuál?">
          <input
            value={methodOther}
            maxLength={60}
            onChange={(e) => setMethodOther(e.target.value)}
            aria-invalid={!!errors.methodOther}
            className={inputClasses}
          />
          <FieldError message={errors.methodOther} />
        </Field>
      )}
    </>
  );
}

/**
 * "Registrar devolución" (TUR0010): any part of what is left to refund. Staff
 * leave it pending; an owner/admin can say it is already done.
 */
export function RegisterRefundSheet({
  appointment: a,
  available,
  onClose,
  onSaved,
}: {
  appointment: AppointmentWithDetails;
  available: number;
  onClose: () => void;
  onSaved: (fresh: AppointmentWithDetails | null) => void;
}) {
  const toast = useToast();
  const { profile } = useAuth();
  const canManage = profile?.role === "owner" || profile?.role === "admin";
  const { format: money } = useMoney();
  const register = useRegisterAppointmentRefund();
  const [amount, setAmount] = useState(String(available));
  const [reason, setReason] = useState(
    () => cancellationLabel(a.cancellation_category, a.cancellation_reason) ?? ""
  );
  const [processed, setProcessed] = useState(canManage);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [methodOther, setMethodOther] = useState("");
  const [refundedAt, setRefundedAt] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [errors, setErrors] = useState<Errors>({});

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
      const fresh = await register.mutateAsync({
        appointmentId: a.id,
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
      onSaved(fresh);
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
                  name="refund-processed"
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

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="flex-1 justify-center">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="flex-2 justify-center">
            {busy ? "Guardando…" : "Registrar"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** "Marcar devuelta" of a pending refund (owner or admin). */
export function ProcessRefundSheet({
  appointmentId,
  refund,
  onClose,
  onSaved,
}: {
  appointmentId: string;
  refund: AppointmentRefund;
  onClose: () => void;
  onSaved: (fresh: AppointmentWithDetails | null) => void;
}) {
  const toast = useToast();
  const { format: money } = useMoney();
  const decide = useDecideAppointmentRefund();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [methodOther, setMethodOther] = useState("");
  const [refundedAt, setRefundedAt] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [errors, setErrors] = useState<Errors>({});

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
      const fresh = await decide.mutateAsync({
        appointmentId,
        refundId: refund.id,
        decision: {
          status: "processed",
          method: v.method,
          methodOther: v.method === "other" ? v.methodOther : null,
          refundedAt: v.refundedAt,
        },
      });
      toast.success("Devolución hecha", money(Number(refund.amount)));
      onSaved(fresh);
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
          cliente.
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
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="flex-1 justify-center">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="flex-2 justify-center">
            {busy ? "Guardando…" : "Marcar devuelta"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
