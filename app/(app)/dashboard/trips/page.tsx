"use client";

import { PageMetadata } from "@/components/page-metadata";
import { ProtectedRoute } from "@/components/protected-route";
import { TripCard } from "@/components/trips/TripCard";
import { TripFormSheet } from "@/components/trips/TripFormSheet";
import { Button, ConfirmSheet, ListGroup } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import {
  useCancelTrip,
  useCreateTrip,
  useDebounce,
  useDuplicateTrip,
  useOrganizationModules,
  useSetTripPublished,
  useToast,
  useTripsQuery,
  useUpdateTrip,
} from "@/hooks";
import type {
  PickupPointFormState,
  TripFormData,
  TripFormState,
  TripWithOccupancy,
} from "@/types/trips";
import { shareTrip } from "@/utils/trip-share";
import { Bus, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, Suspense, useCallback, useMemo, useState } from "react";
import { useCreateParam } from "@/hooks/useCreateParam";
import { addDays, getLocalDateString } from "@/utils/date";

/** Tomorrow, so a new departure never starts in the past. */
function defaultDepartureDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getLocalDateString(date);
}

const EMPTY_FORM: TripFormState = {
  title: "",
  description: "",
  pickup_location: "",
  destination: "",
  departure_date: "",
  departure_time: "08:00",
  return_time: "",
  total_seats: 20,
  max_seats_per_booking: 8,
  price_per_seat: 0,
  deposit_per_seat: 0,
  round_trip_enabled: false,
  price_round_trip: 0,
  currency: "USD",
  requires_approval: true,
  is_published: true,
  driver_name: "",
  driver_phone: "",
  vehicle_description: "",
  vehicle_photo_path: "",
  booking_opens_at: "",
  booking_closes_at: "",
  internal_notes: "",
};

/** ISO instant -> value a datetime-local input accepts, in local time. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** An empty numeric field means "nothing typed yet", which is 0 on save. */
function toNumber(value: number | ""): number {
  return value === "" ? 0 : value;
}

function toFormData(state: TripFormState): TripFormData {
  return {
    ...state,
    total_seats: toNumber(state.total_seats),
    max_seats_per_booking: toNumber(state.max_seats_per_booking),
    price_per_seat: toNumber(state.price_per_seat),
    deposit_per_seat: toNumber(state.deposit_per_seat),
    price_round_trip: toNumber(state.price_round_trip),
  };
}

function TripsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const {
    modules,
    loading: modulesLoading,
    ready: modulesReady,
  } = useOrganizationModules();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TripWithOccupancy | null>(null);
  const [formData, setFormData] = useState<TripFormState>(EMPTY_FORM);
  const [cancelling, setCancelling] = useState<TripWithOccupancy | null>(null);
  const [duplicating, setDuplicating] = useState<TripWithOccupancy | null>(null);
  const [duplicateDate, setDuplicateDate] = useState("");
  const [pickupPoints, setPickupPoints] = useState<PickupPointFormState[]>([]);

  const canManage = useMemo(
    () => profile?.role === "admin" || profile?.role === "owner",
    [profile]
  );

  const { trips, loading, error } = useTripsQuery();

  const filteredTrips = useMemo(() => {
    if (!debouncedSearch) return trips;
    const term = debouncedSearch.toLowerCase();
    return trips.filter(
      (trip) =>
        trip.title.toLowerCase().includes(term) ||
        trip.description?.toLowerCase().includes(term) ||
        trip.pickup_location?.toLowerCase().includes(term)
    );
  }, [trips, debouncedSearch]);

  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const setPublished = useSetTripPublished();
  const cancelTrip = useCancelTrip();
  const duplicateTrip = useDuplicateTrip();

  const patchForm = useCallback((patch: Partial<TripFormState>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * The departure as a WhatsApp message. This is how these businesses sell:
   * they paste the trip into their groups, so the text carries the stops with
   * their prices and the link to book.
   */
  const handleShare = useCallback(
    (trip: TripWithOccupancy) => {
      shareTrip(trip, { currency: modules.currency, slug: modules.slug }).catch(
        () => toast.error("No se pudo compartir", "Inténtalo de nuevo")
      );
    },
    [modules.currency, modules.slug, toast]
  );

  const handleCreate = useCallback(() => {
    setEditing(null);
    setFormData({ ...EMPTY_FORM, departure_date: defaultDepartureDate() });
    setPickupPoints([]);
    setShowForm(true);
  }, []);

  useCreateParam(handleCreate, canManage);

  const handleEdit = useCallback((trip: TripWithOccupancy) => {
    setEditing(trip);
    setFormData({
      title: trip.title,
      description: trip.description ?? "",
      pickup_location: trip.pickup_location ?? "",
      destination: trip.destination ?? "",
      departure_date: trip.departure_date,
      departure_time: trip.departure_time.slice(0, 5),
      return_time: trip.return_time ? trip.return_time.slice(0, 5) : "",
      total_seats: trip.total_seats,
      max_seats_per_booking: trip.max_seats_per_booking,
      price_per_seat: trip.price_per_seat,
      deposit_per_seat: trip.deposit_per_seat,
      round_trip_enabled: trip.round_trip_enabled,
      price_round_trip: trip.price_round_trip ?? trip.price_per_seat,
      currency: trip.currency,
      requires_approval: trip.requires_approval,
      is_published: trip.is_published,
      driver_name: trip.driver_name ?? "",
      driver_phone: trip.driver_phone ?? "",
      vehicle_description: trip.vehicle_description ?? "",
      vehicle_photo_path: trip.vehicle_photo_path ?? "",
      booking_opens_at: toLocalInput(trip.booking_opens_at),
      booking_closes_at: toLocalInput(trip.booking_closes_at),
      internal_notes: trip.internal_notes ?? "",
    });
    setPickupPoints(
      trip.pickup_points.map((point) => ({
        id: point.id,
        name: point.name,
        details: point.details ?? "",
        pickup_time: point.pickup_time ? point.pickup_time.slice(0, 5) : "",
        price_per_seat: point.price_per_seat,
        price_round_trip: point.price_round_trip ?? "",
        deposit_per_seat: point.deposit_per_seat,
      }))
    );
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const data = toFormData(formData);
      const loadingToast = toast.loading(
        editing ? "Guardando..." : "Creando salida..."
      );
      try {
        if (editing) {
          await updateTrip.mutateAsync({ tripId: editing.id, data, pickupPoints });
          toast.dismiss(loadingToast);
          toast.success("Salida actualizada", `"${data.title}" quedó al día`);
        } else {
          await createTrip.mutateAsync({ data, pickupPoints });
          toast.dismiss(loadingToast);
          toast.success("Salida creada", `"${data.title}" ya está en tu lista`);
        }
        setShowForm(false);
        setEditing(null);
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error(
          "Error",
          err instanceof Error ? err.message : "No se pudo guardar la salida"
        );
      }
    },
    [createTrip, editing, formData, pickupPoints, toast, updateTrip]
  );

  const handleTogglePublished = useCallback(
    async (trip: TripWithOccupancy) => {
      try {
        await setPublished.mutateAsync({
          tripId: trip.id,
          isPublished: !trip.is_published,
        });
        toast.success(
          trip.is_published ? "Salida oculta" : "Salida publicada",
          trip.is_published
            ? `"${trip.title}" ya no aparece en tu página`
            : `"${trip.title}" ya se puede reservar`
        );
      } catch (err) {
        toast.error(
          "Error",
          err instanceof Error ? err.message : "No se pudo cambiar la publicación"
        );
      }
    },
    [setPublished, toast]
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelling) return;
    try {
      await cancelTrip.mutateAsync(cancelling.id);
      toast.success("Salida cancelada", `"${cancelling.title}" ya no se vende`);
      setCancelling(null);
    } catch (err) {
      toast.error(
        "Error",
        err instanceof Error ? err.message : "No se pudo cancelar la salida"
      );
    }
  }, [cancelTrip, cancelling, toast]);

  const handleConfirmDuplicate = useCallback(async () => {
    if (!duplicating || !duplicateDate) return;
    try {
      await duplicateTrip.mutateAsync({
        trip: duplicating,
        departureDate: duplicateDate,
      });
      toast.success("Salida duplicada", "Revisa la nueva fecha en la lista");
      setDuplicating(null);
    } catch (err) {
      toast.error(
        "Error",
        err instanceof Error ? err.message : "No se pudo duplicar la salida"
      );
    }
  }, [duplicateDate, duplicateTrip, duplicating, toast]);

  const moduleOff = modulesReady && !modules.trips;

  if (loading || modulesLoading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 h-6 w-6 animate-spin rounded-full border-2 border-border-2 border-t-foreground" />
            <p className="text-sm text-foreground-muted">Cargando viajes...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const subtitle = moduleOff
    ? "Módulo no disponible"
    : `${trips.length} salida${trips.length === 1 ? "" : "s"} próxima${
        trips.length === 1 ? "" : "s"
      }${debouncedSearch ? ` · filtro: "${debouncedSearch}"` : ""}`;

  return (
    <ProtectedRoute>
      <PageMetadata
        title="Viajes"
        description="Publica las salidas de tus viajes con su fecha, cantidad de asientos, precio y anticipo, y sigue la ocupación de cada una."
      />

      <div className="relative min-h-screen bg-background pb-24">
        <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-background/90 lg:backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 pb-3 pt-4 lg:px-8 lg:pt-8">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="font-display text-display text-foreground">
                  Viajes
                </h1>
                <p className="text-xs text-foreground-muted">{subtitle}</p>
              </div>
              {canManage && !moduleOff && (
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  className="max-sm:hidden"
                >
                  <Plus className="h-4 w-4" />
                  Nueva salida
                </Button>
              )}
            </div>

            {!canManage && !moduleOff && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-foreground-muted">
                Solo el dueño puede crear o cambiar salidas. Tú puedes entrar a
                cada salida y gestionar sus pasajes.
              </p>
            )}

            {!moduleOff && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Buscar salidas…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-5 py-4 lg:px-8">
          {error && (
            <div className="mb-4 rounded-card bg-danger-100 p-4 text-meta text-danger-600 dark:bg-danger-900 dark:text-danger-400">
              {error}
            </div>
          )}

          {moduleOff ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-foreground-subtle">
                <Bus className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                La venta de asientos no está activa
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">
                Este módulo se elige al registrarse. Si quieres vender asientos de
                viaje, pídeselo al equipo de Turno Flash y lo activamos.
              </p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-foreground-subtle">
                <Bus className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {searchTerm ? "Sin resultados" : "Sin salidas próximas"}
              </h3>
              <p className="mt-1 text-sm text-foreground-muted">
                {searchTerm
                  ? "Prueba con otro término."
                  : "Crea la primera salida y después duplícala para los días siguientes."}
              </p>
              {canManage && !searchTerm && (
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  className="mx-auto mt-4"
                >
                  <Plus className="h-4 w-4" />
                  Crear salida
                </Button>
              )}
            </div>
          ) : (
            <ListGroup className="mx-auto max-w-5xl">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  canManage={canManage}
                  onEdit={handleEdit}
                  onOpenPassengers={(t) =>
                    router.push(`/dashboard/trips/details?id=${t.id}`)
                  }
                  onTogglePublished={handleTogglePublished}
                  onDuplicate={(t) => {
                    setDuplicating(t);
                    // Same weekday next week, never in the past (P2-17)
                    const nextWeek = addDays(t.departure_date, 7);
                    const today = getLocalDateString();
                    setDuplicateDate(nextWeek < today ? addDays(today, 1) : nextWeek);
                  }}
                  onShare={handleShare}
                  onCancel={setCancelling}
                />
              ))}
            </ListGroup>
          )}
        </div>

      </div>

      <TripFormSheet
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editing}
        organizationId={profile?.organization_id ?? ""}
        formData={formData}
        onChange={patchForm}
        onSubmit={handleSubmit}
        isSubmitting={createTrip.isPending || updateTrip.isPending}
        pickupPoints={pickupPoints}
        onPickupPointsChange={setPickupPoints}
      />

      <ConfirmSheet
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={handleConfirmCancel}
        title="Cancelar salida"
        confirmLabel="Cancelar salida"
        busyLabel="Cancelando…"
        busy={cancelTrip.isPending}
      >
        <p className="text-sm text-foreground-muted">
          {cancelling?.seats_taken
            ? `Hay ${cancelling.seats_taken} asiento(s) reservado(s). La salida deja de publicarse y, si tienes WhatsApp conectado, les avisamos a los pasajeros.`
            : "La salida deja de publicarse y no aceptará más reservas."}
        </p>
      </ConfirmSheet>

      <ConfirmSheet
        open={!!duplicating}
        onClose={() => setDuplicating(null)}
        onConfirm={handleConfirmDuplicate}
        title="Duplicar salida"
        confirmLabel="Duplicar"
        busyLabel="Duplicando…"
        busy={duplicateTrip.isPending}
        confirmVariant="primary"
        confirmDisabled={!duplicateDate || duplicateDate < getLocalDateString()}
      >
        <p className="text-sm text-foreground-muted">
          Se copia todo (horario, asientos, precio y anticipo) con la fecha que
          elijas. Las reservas no se copian.
        </p>
        <input
          type="date"
          value={duplicateDate}
          min={getLocalDateString()}
          onChange={(e) => setDuplicateDate(e.target.value)}
          className="mt-3 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900"
        />
      </ConfirmSheet>
    </ProtectedRoute>
  );
}

export default function TripsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <div className="flex min-h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-6 w-6 animate-spin rounded-full border-2 border-border-2 border-t-foreground" />
              <p className="text-sm text-foreground-muted">Cargando viajes...</p>
            </div>
          </div>
        </ProtectedRoute>
      }
    >
      <TripsContent />
    </Suspense>
  );
}
