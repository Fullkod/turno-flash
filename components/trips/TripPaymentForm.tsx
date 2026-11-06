"use client";

import { FieldError, METHOD_OPTIONS } from "@/components/appointments/RegisterPaymentSheet";
import {
  Button,
  Field,
  Select,
  Sheet,
  sheetInputClasses as inputClasses,
} from "@/components/ui";
import { useToast } from "@/hooks";
import { useMoney } from "@/hooks/useMoney";
import { useRegisterTripPayment } from "@/hooks/useTripBookingMoney.query";
import { appointmentPaymentSchema } from "@/schemas/appointment-payment.schema";
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  type PaymentMethod,
} from "@/services/appointment-payments.service";
import type { TripBookingWithCustomer } from "@/types/trips";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/utils/deposit";
import { useState } from "react";

type Errors = Partial<Record<"amount" | "paidAt" | "methodOther" | "reference" | "notes" | "receipt", string>>;

const shortcutClass =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted";

/**
 * "Registrar pago" of a trip booking (TUR0011): same fields as an appointment
 * payment. The common flow is a deposit by transfer and the rest in cash on
 * the bus, so it offers both amounts as shortcuts.
 */
export function TripPaymentForm({
  booking,
  pending,
  depositOwed,
  onClose,
  onSaved,
}: {
  booking: TripBookingWithCustomer;
  /** What is left to collect, extra included */
  pending: number;
  /** The deposit, while it is not covered yet; 0 otherwise */
  depositOwed: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { format: money } = useMoney();
  const register = useRegisterTripPayment();
  const [amount, setAmount] = useState(() => {
    const suggested = depositOwed || pending;
    return suggested > 0 ? String(suggested) : "";
  });
  const [paidAt, setPaidAt] = useState(() => toLocalDateTimeInput(new Date().toISOString()));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [methodOther, setMethodOther] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const pickReceipt = (file: File | null) => {
    setErrors((prev) => ({ ...prev, receipt: undefined }));
    if (file && !RECEIPT_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, receipt: "Tiene que ser una foto o un PDF" }));
      return;
    }
    // Photos are made smaller before uploading; a PDF goes as it is
    if (file && file.type === "application/pdf" && file.size > RECEIPT_MAX_BYTES) {
      setErrors((prev) => ({ ...prev, receipt: "El PDF pesa más de 5 MB" }));
      return;
    }
    setReceipt(file);
  };

  const save = async () => {
    const parsed = appointmentPaymentSchema.safeParse({
      amount: amount === "" ? undefined : Number(amount),
      paidAt: fromLocalDateTimeInput(paidAt) ?? "",
      method,
      methodOther,
      reference,
      notes,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    const v = parsed.data;
    try {
      await register.mutateAsync({
        booking,
        payment: {
          amount: v.amount,
          paidAt: v.paidAt,
          method: v.method,
          methodOther: v.method === "other" ? v.methodOther : null,
          reference: v.reference || null,
          notes: v.notes || null,
          receipt,
        },
      });
      toast.success("Pago registrado", money(v.amount));
      onSaved();
    } catch (err) {
      toast.error("No se pudo registrar", err instanceof Error ? err.message : undefined);
    }
  };

  const busy = register.isPending;

  return (
    <Sheet
      open
      onClose={busy ? () => {} : onClose}
      title="Registrar pago"
      subtitle={`${booking.booking_number ?? ""} · falta ${money(pending)}`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {(depositOwed > 0 || pending > 0) && (
          <div className="flex flex-wrap gap-2">
            {depositOwed > 0 && depositOwed !== pending && (
              <button type="button" onClick={() => setAmount(String(depositOwed))} className={shortcutClass}>
                El anticipo ({money(depositOwed)})
              </button>
            )}
            {pending > 0 && (
              <button type="button" onClick={() => setAmount(String(pending))} className={shortcutClass}>
                Todo lo que falta ({money(pending)})
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe">
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount}
              className={inputClasses}
            />
          </Field>
          <Field label="Fecha">
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              aria-invalid={!!errors.paidAt}
              className={inputClasses}
            />
          </Field>
        </div>
        <FieldError message={errors.amount ?? errors.paidAt} />

        <Field label="Método">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {method === "other" && (
          <Field label="¿Cuál?">
            <input
              value={methodOther}
              maxLength={60}
              onChange={(e) => setMethodOther(e.target.value)}
              aria-invalid={!!errors.methodOther}
              className={inputClasses}
              placeholder="Por ejemplo, Zelle"
            />
            <FieldError message={errors.methodOther} />
          </Field>
        )}

        <Field label="Referencia" hint="Opcional: número de la transferencia o del recibo.">
          <input
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
            className={inputClasses}
          />
        </Field>

        <Field label="Observaciones" hint="Opcional.">
          <textarea
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClasses}
          />
        </Field>

        <Field label="Comprobante" hint="Opcional: foto o PDF de hasta 5 MB. Solo lo ve tu negocio.">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => pickReceipt(e.target.files?.[0] ?? null)}
            className="block w-full text-meta text-foreground-muted file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-meta file:font-semibold file:text-foreground"
          />
          <FieldError message={errors.receipt} />
        </Field>

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
