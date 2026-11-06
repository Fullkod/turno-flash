"use client";

import { METHOD_OPTIONS } from "@/components/appointments/RegisterPaymentSheet";
import { FINANCE_STATUS_LABEL } from "@/utils/finance-period";
import { Field, SearchInput, Select } from "@/components/ui";
import { useServices } from "@/hooks/useServices.query";
import { useStaff } from "@/hooks/useStaff.query";
import { useTripsQuery } from "@/hooks/useTrips.query";
import type { FinanceFilters as Filters } from "@/schemas/finance.schema";
import type { FinanceModule, FinancePaymentStatus } from "@/types/finance";
import { useMemo } from "react";

const STATUSES = Object.entries(FINANCE_STATUS_LABEL) as [FinancePaymentStatus, string][];

/**
 * The filters of one tab of Finanzas. The lists (services, staff, departures)
 * are the business's own, so a platform admin looking at another business
 * (`ownBusiness` false) only gets the filters that need no list.
 */
export function FinanceFilters({
  module,
  filters,
  search,
  onSearch,
  onChange,
  ownBusiness,
}: {
  module: FinanceModule;
  filters: Filters;
  /** The search box, applied a moment after typing stops */
  search: string;
  onSearch: (value: string) => void;
  onChange: (patch: Partial<Filters>) => void;
  ownBusiness: boolean;
}) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ [key]: e.target.value || undefined });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">
        <Field label={module === "trips" ? "Pasajero" : "Cliente"}>
          <SearchInput
            value={search}
            onChange={onSearch}
            placeholder={module === "trips" ? "Nombre o teléfono del pasajero" : "Nombre o teléfono del cliente"}
            aria-label={module === "trips" ? "Buscar pasajero" : "Buscar cliente"}
          />
        </Field>
      </div>

      {ownBusiness &&
        (module === "appointments" ? (
          <AppointmentLists filters={filters} set={set} />
        ) : (
          <TripLists filters={filters} set={set} onChange={onChange} />
        ))}

      <Field label="Forma de pago">
        <Select value={filters.method ?? ""} onChange={set("method")}>
          <option value="">Todas</option>
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Estado del pago">
        <Select value={filters.payment_status ?? ""} onChange={set("payment_status")}>
          <option value="">Todos</option>
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

type Setter = (key: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => void;

function AppointmentLists({ filters, set }: { filters: Filters; set: Setter }) {
  const { services } = useServices();
  const { staff } = useStaff();
  return (
    <>
      <Field label="Servicio">
        <Select value={filters.service_id ?? ""} onChange={set("service_id")}>
          <option value="">Todos</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Profesional">
        <Select value={filters.staff_id ?? ""} onChange={set("staff_id")}>
          <option value="">Todos</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nickname || `${s.first_name} ${s.last_name}`.trim()}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

function TripLists({
  filters,
  set,
  onChange,
}: {
  filters: Filters;
  set: Setter;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const { trips } = useTripsQuery();
  const destinations = useMemo(
    () =>
      [...new Set(trips.map((t) => t.destination?.trim()).filter((d): d is string => !!d))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [trips]
  );
  const trip = trips.find((t) => t.id === filters.trip_id);

  return (
    <>
      <Field label="Salida">
        <Select
          value={filters.trip_id ?? ""}
          // The stop belongs to one departure: a new departure clears it
          onChange={(e) => onChange({ trip_id: e.target.value || undefined, pickup_point_id: undefined })}
        >
          <option value="">Todas</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} · {t.departure_date.split("-").reverse().join("/")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Destino">
        <Select value={filters.destination ?? ""} onChange={set("destination")}>
          <option value="">Todos</option>
          {destinations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value="__none__">Sin destino</option>
        </Select>
      </Field>
      {trip && trip.pickup_points.length > 0 && (
        <Field label="Punto de recogida">
          <Select value={filters.pickup_point_id ?? ""} onChange={set("pickup_point_id")}>
            <option value="">Todos</option>
            {trip.pickup_points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Viaje">
        <Select value={filters.trip_type ?? ""} onChange={set("trip_type")}>
          <option value="">Ida e ida y vuelta</option>
          <option value="one_way">Solo ida</option>
          <option value="round_trip">Ida y vuelta</option>
        </Select>
      </Field>
    </>
  );
}
