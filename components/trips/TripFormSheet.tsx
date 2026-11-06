"use client";

import {
  Button,
  Field,
  RichTextEditor,
  Sheet,
  sheetInputClasses as inputClasses,
  SheetFooter,
} from "@/components/ui";
import type {
  NumericField,
  PickupPointFormState,
  TripFormState,
  TripWithOccupancy,
} from "@/types/trips";
import { ChevronDown } from "lucide-react";
import { PickupPointsEditor } from "./PickupPointsEditor";
import { VehiclePhotoField } from "./VehiclePhotoField";
import { FormEvent } from "react";

export interface TripFormSheetProps {
  open: boolean;
  onClose: () => void;
  editing: TripWithOccupancy | null;
  organizationId: string;
  formData: TripFormState;
  onChange: (patch: Partial<TripFormState>) => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
  isSubmitting: boolean;
  pickupPoints: PickupPointFormState[];
  onPickupPointsChange: (points: PickupPointFormState[]) => void;
}

/**
 * Empty stays empty instead of becoming 0: otherwise clearing the field to
 * type another number leaves a 0 in front that has to be deleted every time.
 */
function parseNumeric(value: string): NumericField {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? "" : parsed;
}

export function TripFormSheet({
  open,
  onClose,
  editing,
  organizationId,
  formData,
  onChange,
  onSubmit,
  isSubmitting,
  pickupPoints,
  onPickupPointsChange,
}: TripFormSheetProps) {
  const isEdit = !!editing;
  // From the saved trip, not the form: typing must not collapse the section
  const hasOptionalData = Boolean(
    editing &&
      (editing.driver_name ||
        editing.driver_phone ||
        editing.vehicle_description ||
        editing.vehicle_photo_path ||
        editing.booking_opens_at ||
        editing.booking_closes_at ||
        editing.internal_notes)
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar salida" : "Nueva salida"}
      subtitle="Una salida es un viaje concreto, con su fecha y sus asientos."
      maxWidthClass="sm:max-w-3xl"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Título">
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={inputClasses}
            placeholder="Excursión a la playa"
          />
        </Field>

        <Field
          label="Destino (opcional)"
          hint="Hacia dónde va. Sirve para filtrar el dinero en Finanzas."
        >
          <input
            type="text"
            maxLength={120}
            value={formData.destination}
            onChange={(e) => onChange({ destination: e.target.value })}
            className={inputClasses}
            placeholder="Varadero"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Descripción"
            hint="Lo que ve el cliente: ruta, qué incluye, qué llevar."
          >
            <RichTextEditor
              label="Descripción del viaje"
              value={formData.description}
              onChange={(description) => onChange({ description })}
              placeholder={
                "*Salida por la costa* con parada en el mirador." +
                "\n" +
                "Incluye chofer y guía." +
                "\n" +
                "_Llevar toalla y protector solar._"
              }
            />
          </Field>

          <Field
            label="Punto de encuentro"
            hint="Dónde y cómo encontrar el autobús."
          >
            <RichTextEditor
              label="Punto de encuentro"
              value={formData.pickup_location}
              onChange={(pickup_location) => onChange({ pickup_location })}
              rows={4}
              placeholder={
                "*Terminal central, andén 3.*" +
                "\n" +
                "Frente a la cafetería, 15 minutos antes de la salida."
              }
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fecha">
            <input
              type="date"
              required
              value={formData.departure_date}
              onChange={(e) => onChange({ departure_date: e.target.value })}
              className={inputClasses}
            />
          </Field>

          <Field label="Sale">
            <input
              type="time"
              required
              value={formData.departure_time}
              onChange={(e) => onChange({ departure_time: e.target.value })}
              className={inputClasses}
            />
          </Field>

          <Field label="Regresa" hint="Opcional, el mismo día.">
            <input
              type="time"
              value={formData.return_time}
              onChange={(e) => onChange({ return_time: e.target.value })}
              className={inputClasses}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Asientos">
            <input
              type="number"
              required
              min={1}
              max={200}
              value={formData.total_seats}
              onChange={(e) =>
                onChange({ total_seats: parseNumeric(e.target.value) })
              }
              className={inputClasses}
            />
          </Field>

          <Field label="Máx. por reserva">
            <input
              type="number"
              required
              min={1}
              max={50}
              value={formData.max_seats_per_booking}
              onChange={(e) =>
                onChange({
                  max_seats_per_booking: parseNumeric(e.target.value),
                })
              }
              className={inputClasses}
            />
          </Field>

          <Field label="Precio solo ida / asiento" hint="Por defecto">
            <input
              type="number"
              min={0}
              step="0.01"
              value={formData.price_per_seat}
              onChange={(e) =>
                onChange({ price_per_seat: parseNumeric(e.target.value) })
              }
              className={inputClasses}
            />
          </Field>

          <Field label="Anticipo / asiento" hint="Por defecto">
            <input
              type="number"
              min={0}
              step="0.01"
              value={formData.deposit_per_seat}
              onChange={(e) =>
                onChange({ deposit_per_seat: parseNumeric(e.target.value) })
              }
              className={inputClasses}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={formData.round_trip_enabled}
              onChange={(e) =>
                onChange({ round_trip_enabled: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs">
              <span className="block font-semibold text-foreground">
                Vendo esta salida también de ida y vuelta
              </span>
              <span className="mt-0.5 block text-foreground-muted">
                El cliente elige al reservar. Es el mismo ómnibus y los mismos
                asientos, solo cambia el precio.
              </span>
            </span>
          </label>

          {formData.round_trip_enabled && (
            <div className="mt-3 sm:max-w-xs">
              <Field
                label="Precio ida y vuelta / asiento"
                hint="Por defecto. Cada punto de recogida puede tener el suyo."
              >
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.price_round_trip}
                  onChange={(e) =>
                    onChange({ price_round_trip: parseNumeric(e.target.value) })
                  }
                  className={inputClasses}
                />
              </Field>
            </div>
          )}
        </div>

        <PickupPointsEditor
          points={pickupPoints}
          onChange={onPickupPointsChange}
          fallbackPrice={formData.price_per_seat}
          fallbackDeposit={formData.deposit_per_seat}
          roundTrip={formData.round_trip_enabled}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs">
            <input
              type="checkbox"
              checked={formData.requires_approval}
              onChange={(e) => onChange({ requires_approval: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs">
              <span className="block font-semibold text-foreground">
                Tengo que aprobar cada reserva
              </span>
              <span className="mt-0.5 block text-foreground-muted">
                Sin marcar, quien reserve queda confirmado al instante. Cobrar el
                anticipo es aparte: registrarlo no aprueba ni rechaza nada.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => onChange({ is_published: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs">
              <span className="block font-semibold text-foreground">
                Mostrar en mi página de reservas
              </span>
              <span className="mt-0.5 block text-foreground-muted">
                Sin marcar, la salida existe solo para ti y puedes cargar
                reservas a mano.
              </span>
            </span>
          </label>
        </div>

        {/* Optional, so the form stays short; open when editing a trip that uses them */}
        <details
          open={hasOptionalData}
          className="group rounded-lg border border-border"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-foreground">
            Más opciones: chofer, cuándo reservar, notas
            <ChevronDown className="h-4 w-4 text-foreground-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-4 border-t border-border p-3">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-caption font-semibold text-foreground-muted">
                Chofer y vehículo (opcional)
              </p>
              <p className="mt-0.5 text-caption text-foreground-subtle">
                Se suele avisar el día antes del viaje. Puedes dejarlo vacío y
                completarlo después.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <Field label="Chofer">
                  <input
                    type="text"
                    value={formData.driver_name}
                    onChange={(e) => onChange({ driver_name: e.target.value })}
                    className={inputClasses}
                    placeholder="Juan Pérez"
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    type="tel"
                    value={formData.driver_phone}
                    onChange={(e) => onChange({ driver_phone: e.target.value })}
                    className={inputClasses}
                    placeholder="+53 5555 5555"
                  />
                </Field>
                <Field label="Vehículo">
                  <input
                    type="text"
                    value={formData.vehicle_description}
                    onChange={(e) =>
                      onChange({ vehicle_description: e.target.value })
                    }
                    className={inputClasses}
                    placeholder="Ómnibus 2079"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <VehiclePhotoField
                  value={formData.vehicle_photo_path}
                  organizationId={organizationId}
                  onChange={(vehicle_photo_path) => onChange({ vehicle_photo_path })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-caption font-semibold text-foreground-muted">
                Cuándo se puede reservar (opcional)
              </p>
              <p className="mt-0.5 text-caption text-foreground-subtle">
                Para abrir las reservas a partir de un día y hora concretos. Vacío = se
                puede reservar desde que publicas y hasta que sale.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Abren">
                  <input
                    type="datetime-local"
                    value={formData.booking_opens_at}
                    onChange={(e) => onChange({ booking_opens_at: e.target.value })}
                    className={inputClasses}
                  />
                </Field>
                <Field label="Cierran">
                  <input
                    type="datetime-local"
                    value={formData.booking_closes_at}
                    onChange={(e) => onChange({ booking_closes_at: e.target.value })}
                    className={inputClasses}
                  />
                </Field>
              </div>
            </div>

            <Field label="Notas internas" hint="Solo las ves tú y tu equipo.">
              <textarea
                rows={2}
                value={formData.internal_notes}
                onChange={(e) => onChange({ internal_notes: e.target.value })}
                className={inputClasses}
                placeholder="Chofer, vehículo, recordatorios…"
              />
            </Field>
          </div>
        </details>

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
            disabled={isSubmitting}
            className="flex-2 justify-center"
          >
            {isSubmitting
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear salida"}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
