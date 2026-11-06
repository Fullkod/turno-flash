"use client";

import { useMoney } from "@/hooks/useMoney";

import { METHOD_OPTIONS } from "@/components/appointments/RegisterPaymentSheet";
import {
  Button,
  Field,
  Sheet,
  Select,
  sheetInputClasses as inputClasses,
  SheetFooter,
} from "@/components/ui";
import {
  seatPrice,
  type ManualBookingFormState,
  type TripWithOccupancy,
} from "@/types/trips";
import { FormEvent } from "react";

export interface ManualBookingSheetProps {
  open: boolean;
  onClose: () => void;
  trip: TripWithOccupancy;
  form: ManualBookingFormState;
  onChange: (patch: Partial<ManualBookingFormState>) => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
  isSubmitting: boolean;
}

export function ManualBookingSheet({
  open,
  onClose,
  trip,
  form,
  onChange,
  onSubmit,
  isSubmitting,
}: ManualBookingSheetProps) {
  const { format: money } = useMoney();
  const seats = form.seats === "" ? 0 : form.seats;
  const point = trip.pickup_points.find(
    (candidate) => candidate.id === form.pickup_point_id
  );
  const pricePerSeat = seatPrice(trip, point, form.trip_type);
  const depositPerSeat = point
    ? point.deposit_per_seat
    : trip.deposit_per_seat;
  const depositTotal = depositPerSeat * seats;
  const priceTotal = pricePerSeat * seats;
  const paid = form.amount_paid === "" ? 0 : form.amount_paid;
  const extra = form.extra_amount === "" ? 0 : form.extra_amount;

  /** One field per seat, kept in sync when the quantity changes. */
  const handleSeatsChange = (raw: string) => {
    if (raw === "") {
      onChange({ seats: "" });
      return;
    }
    const next = Number(raw);
    if (Number.isNaN(next)) return;
    const names = [...form.passenger_names];
    names.length = Math.max(next, 0);
    onChange({
      seats: next,
      passenger_names: Array.from(names, (name) => name ?? ""),
    });
  };

  const handleNameChange = (index: number, value: string) => {
    const names = [...form.passenger_names];
    names[index] = value;
    onChange({ passenger_names: names });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cargar reserva"
      subtitle={`${trip.title} · ${
        trip.seats_left === 1
          ? "queda 1 asiento"
          : `quedan ${trip.seats_left} asientos`
      }`}
      maxWidthClass="sm:max-w-2xl"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => onChange({ first_name: e.target.value })}
              className={inputClasses}
              placeholder="María"
            />
          </Field>

          <Field label="Apellido">
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => onChange({ last_name: e.target.value })}
              className={inputClasses}
              placeholder="González"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Teléfono"
            hint="Si ya es cliente, se reutiliza su ficha."
          >
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              className={inputClasses}
              placeholder="+53 5 123 4567"
            />
          </Field>

          <Field label="Email (opcional)">
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className={inputClasses}
              placeholder="maria@ejemplo.com"
            />
          </Field>
        </div>

        {trip.round_trip_enabled && (
          <Field label="Tipo de viaje">
            <Select
              value={form.trip_type}
              onChange={(e) =>
                onChange({
                  trip_type:
                    e.target.value === "round_trip" ? "round_trip" : "one_way",
                })
              }
            >
              <option value="one_way">
                Solo ida · {money(seatPrice(trip, point, "one_way"))}
              </option>
              <option value="round_trip">
                Ida y vuelta · {money(seatPrice(trip, point, "round_trip"))}
              </option>
            </Select>
          </Field>
        )}

        {trip.pickup_points.length > 0 && (
          <Field
            label="Punto de recogida"
            hint="Define el precio y el anticipo de esta reserva."
          >
            <Select
              required
              value={form.pickup_point_id}
              onChange={(e) => onChange({ pickup_point_id: e.target.value })}
            >
              <option value="">Elige dónde lo recogen…</option>
              {trip.pickup_points.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.name}
                  {point.pickup_time ? ` · ${point.pickup_time.slice(0, 5)}` : ""}
                  {` · ${money(seatPrice(trip, point, form.trip_type))}`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Asientos">
          <input
            type="number"
            required
            min={1}
            max={Math.max(trip.seats_left, 1)}
            value={form.seats}
            onChange={(e) => handleSeatsChange(e.target.value)}
            className={inputClasses}
          />
        </Field>

        {seats > 0 && (
          <Field
            label="Nombres de los pasajeros"
            hint="Puedes dejarlos vacíos ahora y completarlos antes del viaje."
          >
            <div className="flex flex-col gap-2">
              {Array.from({ length: seats }, (_, index) => (
                <input
                  key={index}
                  type="text"
                  value={form.passenger_names[index] ?? ""}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  className={inputClasses}
                  placeholder={`Pasajero ${index + 1}`}
                />
              ))}
            </div>
          </Field>
        )}

        <Field label="Nota (opcional)">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className={inputClasses}
            placeholder="Sube en la segunda parada…"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Ya cobrado"
            hint={`Total de esta reserva: ${money(priceTotal + extra)}`}
          >
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.amount_paid}
              onChange={(e) =>
                onChange({
                  amount_paid:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              className={inputClasses}
              placeholder="0"
            />
          </Field>

          <Field label="Falta por cobrar">
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground">
              {money(Math.max(priceTotal + extra - paid, 0))}
            </div>
          </Field>
        </div>

        {depositTotal > 0 && (
          <button
            type="button"
            onClick={() => onChange({ amount_paid: depositTotal })}
            className="w-fit rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Cobré el anticipo ({money(depositTotal)})
          </button>
        )}

        {paid > 0 && (
          <Field label="Cómo pagó">
            <Select
              value={form.payment_method}
              onChange={(e) =>
                onChange({
                  payment_method: e.target.value as ManualBookingFormState["payment_method"],
                })
              }
            >
              {METHOD_OPTIONS.filter((o) => o.value !== "other").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Extra (opcional)" hint="Aeropuerto, otro destino, equipaje…">
            <input
              type="text"
              value={form.extra_description}
              onChange={(e) => onChange({ extra_description: e.target.value })}
              className={inputClasses}
              placeholder="Llevarlo al aeropuerto"
            />
          </Field>
          <Field label="Costo del extra">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.extra_amount}
              onChange={(e) =>
                onChange({
                  extra_amount:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              className={inputClasses}
            />
          </Field>
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 justify-center"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || trip.seats_left <= 0}
            className="flex-2 justify-center"
          >
            {isSubmitting
              ? "Guardando…"
              : trip.seats_left <= 0
                ? "Sin asientos libres"
                : "Cargar reserva"}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
