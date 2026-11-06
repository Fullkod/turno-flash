// Supabase Edge Function: wa-trip-send
//
// WhatsApp messages of the seat booking module (PRP-002). Invoked by the
// triggers of migration 044; wa-send stays untouched and keeps serving
// appointments.
//
// Body: { bookingId: string, intent: "trip_booked" | "trip_approved"
//         | "trip_deposit_paid" | "trip_notify_business"
//         | "trip_booking_cancelled" | "trip_departure_cancelled"
//         | "trip_refund_processed" | "trip_refund_rejected", refundId? }
//
// One intent per EVENT: approving a booking and receiving its deposit are
// independent, so each one has its own message. Refunds (099) are one message
// per refund (a booking can have several), deduplicated by notice_sent_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  phoneToChatId,
  sendText,
  type OpenWaResponse,
  type SendTextData,
} from "../_shared/openwa.ts";
import { isServiceRole } from "../_shared/auth.ts";
import {
  type BusinessContact,
  type FrameOptions,
  frameCustomerMessage,
} from "../_shared/wa-message.ts";

// Passenger messages that carry the business contact: the booking (deposit
// by transfer raises questions) and both cancellations (refunds). Approval and
// deposit receipts stay short. trip_notify_business is not framed.
const PASSENGER_FRAME: Partial<Record<Intent, FrameOptions>> = {
  trip_booked: { contact: true, reply: "none" },
  trip_approved: { contact: false, reply: "none" },
  trip_deposit_paid: { contact: false, reply: "none" },
  trip_booking_cancelled: { contact: true, reply: "none" },
  trip_departure_cancelled: { contact: true, reply: "none" },
  trip_refund_processed: { contact: false, reply: "none" },
  trip_refund_rejected: { contact: true, reply: "none" },
};

type Intent =
  | "trip_booked"
  | "trip_approved"
  | "trip_deposit_paid"
  | "trip_notify_business"
  | "trip_booking_cancelled"
  | "trip_departure_cancelled"
  | "trip_refund_processed"
  | "trip_refund_rejected";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "efectivo",
  transfer: "transferencia",
  card: "tarjeta",
};

/** The refund of trip_refund_processed / trip_refund_rejected (099). */
interface RefundRow {
  status: string;
  notice_sent_at: string | null;
  amount: number;
  method: string | null;
  method_other: string | null;
  rejection_reason: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface BookingRow {
  id: string;
  organization_id: string;
  booking_number: string | null;
  seats: number;
  trip_type: string;
  status: string;
  price_total: number | null;
  deposit_amount: number | null;
  deposit_status: string;
  amount_paid: number;
  extra_amount: number;
  hold_expires_at: string | null;
  passenger_names: string[] | null;
  customers: {
    first_name: string;
    last_name: string;
    phone: string;
    phone_country_code: string | null;
    whatsapp_number: string | null;
  } | null;
  trips: {
    title: string;
    timezone: string | null;
    departure_date: string;
    departure_time: string;
    return_time: string | null;
    requires_approval: boolean;
    driver_name: string | null;
    driver_phone: string | null;
    vehicle_description: string | null;
  } | null;
  trip_pickup_points: {
    name: string;
    pickup_time: string | null;
  } | null;
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "15 de septiembre" from a plain YYYY-MM-DD, with no timezone shifting. */
function longDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)} de ${MONTHS[Number(month) - 1] ?? ""}`;
}

function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : "";
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      useGrouping: "always",
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { success: false, error: "Método no permitido" });
  }

  // Only triggers and crons (service role) may call this function.
  if (!isServiceRole(req)) {
    return json(403, { success: false, error: "No autorizado" });
  }

  try {
    const { bookingId, intent, refundId } = (await req.json()) as {
      bookingId: string;
      intent: Intent;
      refundId?: string;
    };
    if (!bookingId || !intent) {
      return json(400, {
        success: false,
        error: "bookingId and intent are required",
      });
    }
    const isRefund =
      intent === "trip_refund_processed" || intent === "trip_refund_rejected";
    if (isRefund && !refundId) {
      return json(400, {
        success: false,
        error: `refundId is required for intent=${intent}`,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: booking, error: bookingError } = await supabase
      .from("trip_bookings")
      .select(
        `id, organization_id, booking_number, seats, trip_type, status,
         price_total, deposit_amount, deposit_status, amount_paid, extra_amount,
         hold_expires_at, passenger_names,
         customers ( first_name, last_name, phone, phone_country_code, whatsapp_number ),
         trips ( title, departure_date, departure_time, return_time, requires_approval, timezone,
                 driver_name, driver_phone, vehicle_description ),
         trip_pickup_points ( name, pickup_time )`
      )
      .eq("id", bookingId)
      .single<BookingRow>();

    if (bookingError || !booking) {
      return json(404, {
        success: false,
        error: `Booking not found: ${bookingError?.message ?? "unknown"}`,
      });
    }

    // A blocked business (expired license or deactivated) sends nothing
    const { data: usable } = await supabase.rpc("org_license_usable", {
      p_org_id: booking.organization_id,
    });
    if (usable !== true) {
      return json(200, {
        success: false,
        skipped: true,
        reason: "license_blocked",
      });
    }

    const { data: settings } = await supabase
      .from("business_settings")
      .select(
        "openwa_session_id, whatsapp_integration_enabled, deposit_instructions"
      )
      .eq("organization_id", booking.organization_id)
      .single<{
        openwa_session_id: string | null;
        whatsapp_integration_enabled: boolean;
        deposit_instructions: string | null;
      }>();

    if (!settings?.whatsapp_integration_enabled) {
      return json(200, {
        success: false,
        skipped: true,
        reason: "WhatsApp not enabled for this organization",
      });
    }
    if (!settings.openwa_session_id) {
      return json(200, {
        success: false,
        skipped: true,
        reason: "openwa_session_id missing in business_settings",
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name, currency, whatsapp_phone, contact_name")
      .eq("id", booking.organization_id)
      .single<{
        name: string;
        currency: string | null;
        whatsapp_phone: string | null;
        contact_name: string | null;
      }>();

    let refund: RefundRow | null = null;
    if (isRefund) {
      const { data: ref } = await supabase
        .from("trip_booking_refunds")
        .select("status, notice_sent_at, amount, method, method_other, rejection_reason")
        .eq("id", refundId!)
        .eq("trip_booking_id", bookingId)
        .maybeSingle<RefundRow>();
      const expected = intent === "trip_refund_processed" ? "processed" : "rejected";
      const skip = !ref
        ? "Refund not found"
        : ref.status !== expected
          ? `Refund is ${ref.status}`
          : ref.notice_sent_at
            ? "Refund notice already sent"
            : null;
      if (skip) {
        return json(200, { success: true, skipped: true, reason: skip });
      }
      refund = ref;
    } else {
      // Every other intent is sent once per booking: a retry of the trigger,
      // or two updates in a row, must not spam the passenger.
      const { data: existing } = await supabase
        .from("wa_outbound_messages")
        .select("id")
        .eq("trip_booking_id", bookingId)
        .eq("intent", intent)
        .in("status", ["pending", "sent", "delivered", "read"])
        .limit(1)
        .maybeSingle();

      if (existing) {
        return json(200, {
          success: true,
          skipped: true,
          reason: `Already sent (intent=${intent})`,
        });
      }
    }

    // Who reads it: the business for the heads-up, the passenger otherwise.
    let chatId: string | null = null;
    if (intent === "trip_notify_business") {
      chatId = org?.whatsapp_phone ? phoneToChatId(org.whatsapp_phone) : null;
    } else if (booking.customers) {
      const phone =
        booking.customers.whatsapp_number || booking.customers.phone;
      chatId = phone
        ? phoneToChatId(phone, booking.customers.phone_country_code ?? "")
        : null;
    }

    if (!chatId) {
      return json(200, {
        success: false,
        skipped: true,
        reason: "No target phone for this intent",
      });
    }

    const body = buildMessage(
      booking,
      intent,
      org?.currency ?? "USD",
      settings.deposit_instructions,
      refund
    );
    const frame = PASSENGER_FRAME[intent];
    const business: BusinessContact = {
      name: org?.name ?? "",
      contactName: org?.contact_name ?? null,
      phone: org?.whatsapp_phone ?? null,
    };
    const text = frame ? frameCustomerMessage(business, body, frame) : body;

    const result: OpenWaResponse<SendTextData> = await sendText({
      sessionId: settings.openwa_session_id,
      chatId,
      text,
    });

    await supabase.from("wa_outbound_messages").insert({
      organization_id: booking.organization_id,
      trip_booking_id: bookingId,
      intent,
      chat_id: chatId,
      message_id: result.data?.messageId ?? null,
      status: result.success ? "sent" : "failed",
      body: text,
      error_code: result.success ? null : (result.error?.code ?? "UNKNOWN"),
      error_message: result.success ? null : (result.error?.message ?? null),
    });
    // OpenWA can answer HTTP 500 after delivering: never send a refund notice twice
    if (isRefund) {
      await supabase
        .from("trip_booking_refunds")
        .update({ notice_sent_at: new Date().toISOString() })
        .eq("id", refundId!);
    }

    if (!result.success) {
      return json(200, {
        success: false,
        error: result.error?.message ?? "OpenWA error",
      });
    }

    return json(200, {
      success: true,
      messageId: result.data?.messageId,
      intent,
    });
  } catch (err) {
    console.error("[wa-trip-send] error:", err);
    return json(500, { success: false, error: String(err) });
  }
});

function buildMessage(
  booking: BookingRow,
  intent: Intent,
  currency: string,
  depositInstructions: string | null,
  refund: RefundRow | null
): string {
  const trip = booking.trips;
  const customer = booking.customers;
  const name = customer?.first_name ?? "";
  const when = trip
    ? `${longDate(trip.departure_date)} a las ${hhmm(trip.departure_time)}`
    : "";
  const seats = `${booking.seats} asiento${booking.seats === 1 ? "" : "s"}`;
  const roundTrip = booking.trip_type === "round_trip" ? " (ida y vuelta)" : "";
  const pickup = booking.trip_pickup_points
    ? `\n📍 Te recogemos en: ${booking.trip_pickup_points.name}${
        booking.trip_pickup_points.pickup_time
          ? ` (${hhmm(booking.trip_pickup_points.pickup_time)})`
          : ""
      }`
    : "";
  const ref = booking.booking_number ? `\nN° de reserva: ${booking.booking_number}` : "";
  const total = (booking.price_total ?? 0) + (booking.extra_amount ?? 0);
  const pending = Math.max(total - (booking.amount_paid ?? 0), 0);
  const deposit = booking.deposit_amount ?? 0;
  const refundNote =
    (booking.amount_paid ?? 0) > 0
      ? `Por los *${money(booking.amount_paid, currency)}* que ya pagaste, escríbele al negocio para coordinar la devolución.`
      : "";

  const header = `*${trip?.title ?? "Tu viaje"}*\n🗓️ ${when}\n💺 ${seats}${roundTrip}${pickup}${ref}`;

  switch (intent) {
    case "trip_booked": {
      const opening =
        booking.status === "pending"
          ? `Hola ${name}! Recibimos tu solicitud de reserva.`
          : `Hola ${name}! Tu reserva quedó hecha.`;
      const depositBlock =
        booking.deposit_status === "pending" && deposit > 0
          ? `\n\n💵 Para guardarte ${
              booking.seats === 1 ? "el asiento" : "los asientos"
            } falta el anticipo de *${money(deposit, currency)}*${
              booking.hold_expires_at
                ? `, antes del ${new Date(booking.hold_expires_at).toLocaleString(
                    "es",
                    {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: booking.trips?.timezone || "America/Havana",
                    }
                  )}`
                : ""
            }.${depositInstructions ? `\n${depositInstructions}` : ""}`
          : "";
      const approvalNote =
        booking.status === "pending"
          ? "\n\nTe confirmamos apenas la revisemos."
          : "";
      return `${opening}\n\n${header}\n\nTotal: *${money(total, currency)}*${depositBlock}${approvalNote}`;
    }

    case "trip_approved":
      return (
        `Hola ${name}! ✅ Tu reserva quedó *confirmada*.\n\n${header}\n\n` +
        (pending > 0
          ? `Falta abonar *${money(pending, currency)}*.`
          : "Está todo abonado. 🙌")
      );

    case "trip_deposit_paid":
      return (
        `Hola ${name}! 💵 Recibimos tu anticipo de *${money(
          booking.deposit_amount ?? 0,
          currency
        )}*.\n\n${header}\n\n` +
        (pending > 0
          ? `Quedan *${money(pending, currency)}* para abonar el día del viaje.`
          : "Está todo abonado. 🙌")
      );

    case "trip_booking_cancelled":
      return (
        `Hola ${name}. Tu reserva fue *cancelada*.

${header}` +
        (refundNote ? `\n\n${refundNote}` : "")
      );

    case "trip_departure_cancelled":
      return (
        `Hola ${name}. Lamentamos avisarte que esta salida fue *cancelada*:

${header}` +
        (refundNote ? `\n\n${refundNote}` : "")
      );

    case "trip_refund_processed": {
      const method =
        refund?.method_other?.trim() || PAYMENT_METHOD_LABEL[refund?.method ?? ""] || "";
      return (
        `💸 Hola ${name}! Te devolvimos *${money(Number(refund?.amount ?? 0), currency)}*` +
        `${method ? ` (${method})` : ""} de tu reserva.\n\n${header}`
      );
    }

    case "trip_refund_rejected":
      return (
        `Hola ${name}, revisamos tu devolución de *${money(Number(refund?.amount ?? 0), currency)}* ` +
        `y no procede.\n\n${header}` +
        (refund?.rejection_reason?.trim() ? `\n\nMotivo: ${refund.rejection_reason.trim()}` : "")
      );

    case "trip_notify_business": {
      const who = customer
        ? `${customer.first_name} ${customer.last_name} (${customer.phone})`
        : "Alguien";
      const passengers = (booking.passenger_names ?? []).filter(Boolean);
      return (
        `🚌 *Nueva reserva de viaje*\n\n${header}\n\n` +
        `Reservó: ${who}\n` +
        (passengers.length > 0 ? `Pasajeros: ${passengers.join(", ")}\n` : "") +
        `Total: ${money(total, currency)}\n` +
        (booking.status === "pending" ? "Queda pendiente de tu aprobación." : "")
      );
    }
  }
}
