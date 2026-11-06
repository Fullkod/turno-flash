import type {
  ManualBookingFormState,
  TripBookingWithCustomer,
} from "@/types/trips";
import { TripPaymentsService } from "@/services/trip-booking-money.service";
import { Logger } from "@/utils/logger";
import { DEFAULT_COUNTRY_CODE, toInternationalPhone } from "@/utils/phone";
import { createClient } from "@/utils/supabase/client";

/** Readable message for the capacity guards of migration 053, or null. */
export function capacityError(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? "";
  const below = message.match(/seats_below_taken:(\d+)/);
  if (below) {
    return `Ya hay ${below[1]} asientos reservados: el cupo no puede ser menor.`;
  }
  const left = message.match(/no_seats_left:(\d+)/);
  if (left) {
    return Number(left[1]) > 0
      ? `Solo quedan ${left[1]} asientos en esta salida.`
      : "Esta salida ya no tiene asientos libres.";
  }
  if (message.includes("trip_cancelled")) {
    return "Esta salida está cancelada: ya no acepta reservas.";
  }
  return null;
}

/**
 * Service Layer for trip bookings (PRP-002).
 *
 * The two states never move together, by explicit product decision:
 *   approve/reject -> status         (does the business accept the passenger?)
 *   deposit        -> deposit_status (did the money arrive?)
 * Every method here touches one axis and leaves the other alone.
 */
export class TripBookingService {
  static async getByTrip(tripId: string): Promise<{
    success: boolean;
    error?: string;
    bookings?: TripBookingWithCustomer[];
  }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_bookings")
        .select(
          "*, customer:customers(id, first_name, last_name, phone, email), pickup_point:trip_pickup_points(id, name)"
        )
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return {
        success: true,
        bookings: (data ?? []) as unknown as TripBookingWithCustomer[],
      };
    } catch (error) {
      void Logger.error("Error loading trip bookings", error, { tripId });
      return { success: false, error: "No se pudieron cargar las reservas" };
    }
  }

  /**
   * What is charged on top of the seats. The money received is not written
   * here: it is the sum of the payments (TripPaymentsService, migration 098).
   */
  static async setExtra(
    bookingId: string,
    extra: { description: string; amount: number }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_bookings")
        .update({
          extra_description: extra.description.trim() || null,
          extra_amount: Math.max(extra.amount, 0),
        })
        .eq("id", bookingId)
        .select("id");
      if (error) throw error;
      // RLS rejects silently (expired license, no permission): 0 rows, no error
      if (!data?.length) throw new Error("not_saved");
      return { success: true };
    } catch (error) {
      void Logger.error("Error updating trip booking extra", error, { bookingId });
      return { success: false, error: "No se pudo guardar el extra" };
    }
  }

  /** Seat only. Says nothing about the deposit. */
  static async setStatus(
    bookingId: string,
    status: "confirmed" | "cancelled" | "completed" | "no_show",
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_bookings")
        .update({
          status,
          ...(status === "cancelled"
            ? {
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason?.trim() || "cancelled_by_business",
              }
            : {}),
        })
        .eq("id", bookingId)
        .select("id");
      if (error) throw error;
      // RLS rejects silently (expired license, no permission): 0 rows, no error
      if (!data?.length) throw new Error("not_saved");
      return { success: true };
    } catch (error) {
      void Logger.error("Error updating trip booking status", error, {
        bookingId,
      });
      return {
        success: false,
        error: capacityError(error) ?? "No se pudo actualizar la reserva",
      };
    }
  }

  static async updatePassengerNames(
    bookingId: string,
    names: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_bookings")
        .update({
          passenger_names: names.map((name) => name.trim()).filter(Boolean),
        })
        .eq("id", bookingId)
        .select("id");
      if (error) throw error;
      // RLS rejects silently (expired license, no permission): 0 rows, no error
      if (!data?.length) throw new Error("not_saved");
      return { success: true };
    } catch (error) {
      void Logger.error("Error updating passenger names", error, { bookingId });
      return { success: false, error: "No se pudieron guardar los nombres" };
    }
  }

  /**
   * Booking taken by the business (phone, counter). The public page goes
   * through the edge function instead; here the seat check is the one the
   * form already did, plus the database constraints.
   *
   * Unlike the public flow, passenger names are optional: a phone booking gets
   * taken fast and the names are filled in before the trip.
   */
  static async createManual(params: {
    organizationId: string;
    tripId: string;
    form: ManualBookingFormState;
    /** Already resolved by the caller from the chosen stop, or the trip. */
    pricePerSeat: number;
    depositPerSeat: number;
  }): Promise<{ success: boolean; error?: string }> {
    const { organizationId, tripId, form } = params;
    const seats = form.seats === "" ? 0 : form.seats;

    if (!form.first_name.trim() || !form.last_name.trim()) {
      return { success: false, error: "Falta el nombre de quien reserva" };
    }
    if (seats < 1) {
      return { success: false, error: "Indica cuántos asientos reserva" };
    }
    // customers.phone is NOT NULL, and without a phone there is no way to warn
    // the passenger if the trip changes.
    if (!form.phone.trim()) {
      return { success: false, error: "Hace falta el teléfono de quien reserva" };
    }

    try {
      const supabase = createClient();

      // Reuse the customer by phone, same idea as the public flow.
      const phone = toInternationalPhone(form.phone);
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let customerId: string | null = existing?.id ?? null;

      if (!customerId) {
        const { data: created, error: customerError } = await supabase
          .from("customers")
          .insert({
            organization_id: organizationId,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            phone,
            phone_country_code: DEFAULT_COUNTRY_CODE,
            email: form.email.trim() || null,
            is_active: true,
          })
          .select("id")
          .single();
        if (customerError) throw customerError;
        customerId = created.id;
      }

      const depositAmount = params.depositPerSeat * seats;
      const amountPaid = form.amount_paid === "" ? 0 : form.amount_paid;
      const { data: booking, error } = await supabase.from("trip_bookings").insert({
        organization_id: organizationId,
        trip_id: tripId,
        customer_id: customerId,
        seats,
        passenger_names: form.passenger_names
          .map((name) => name.trim())
          .filter(Boolean),
        // Loaded by the business itself: there is nothing left to approve
        status: "confirmed",
        source: "admin",
        trip_type: form.trip_type,
        price_total: params.pricePerSeat * seats,
        deposit_amount: depositAmount,
        // amount_paid, deposit_status and deposit_paid_at follow the payments (037, 098).
        pickup_point_id: form.pickup_point_id || null,
        extra_description: form.extra_description.trim() || null,
        extra_amount: form.extra_amount === "" ? 0 : form.extra_amount,
        notes: form.notes.trim() || null,
      }).select("id").single();
      if (error) throw error;

      // What was already handed over becomes the first payment of the booking
      if (amountPaid > 0) {
        const paid = await TripPaymentsService.register(
          { id: booking.id, organization_id: organizationId },
          {
            amount: amountPaid,
            paidAt: null,
            method: form.payment_method,
            methodOther: null,
            reference: null,
            notes: null,
            receipt: null,
          }
        );
        if (!paid.success) {
          return {
            success: false,
            error: `La reserva quedó cargada, pero el cobro no: ${paid.error}`,
          };
        }
      }
      return { success: true };
    } catch (error) {
      void Logger.error("Error creating manual trip booking", error, { tripId });
      return {
        success: false,
        error: capacityError(error) ?? "No se pudo cargar la reserva",
      };
    }
  }
}
