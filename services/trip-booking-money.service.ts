import {
  uploadPaymentReceipt,
  type NewAppointmentPayment,
} from "@/services/appointment-payments.service";
import type {
  NewAppointmentRefund,
  RefundDecision,
} from "@/services/appointment-refunds.service";
import type { Database } from "@/types/database.types";
import { Logger } from "@/utils/logger";
import { createClient } from "@/utils/supabase/client";

type Tables = Database["public"]["Tables"];
type Functions = Database["public"]["Functions"];

export type TripBookingPayment = Tables["trip_booking_payments"]["Row"];
export type TripBookingRefundEvent = Tables["trip_booking_refund_events"]["Row"];
export type TripBookingRefund = Tables["trip_booking_refunds"]["Row"] & {
  events: TripBookingRefundEvent[];
};
/** A trip payment has no deposit flag: the deposit state follows the amount (037). */
export type NewTripPayment = Omit<NewAppointmentPayment, "isDeposit">;

const RPC_ERRORS: Record<string, string> = {
  payment_forbidden: "No tienes permiso para esto.",
  payment_not_found: "No se encontró la reserva o el pago. Actualiza la pantalla.",
  invalid_amount: "El importe no es válido.",
  invalid_paid_at: "La fecha del pago no puede ser futura.",
  invalid_receipt: "El comprobante no es válido.",
  invalid_reason: "Escribe el motivo.",
  payment_already_voided: "Ese pago ya estaba anulado.",
  payment_refunded:
    "Ese dinero ya se devolvió o tiene una devolución pendiente. Rechaza antes la devolución pendiente.",
  refund_forbidden: "No tienes permiso para esto.",
  refund_not_found: "No se encontró la reserva o la devolución. Actualiza la pantalla.",
  refund_not_cancelled:
    "Solo se devuelve en reservas canceladas, de salidas canceladas o de pasajeros que no vinieron.",
  refunds_disabled: "Tu negocio no hace devoluciones (Ajustes).",
  refund_not_pending: "Esa devolución ya estaba resuelta.",
  invalid_method: "Elige cómo devolviste el dinero.",
  invalid_refunded_at: "La fecha no puede ser futura.",
};

function rpcError(message: string, fallback: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return key ? RPC_ERRORS[key] : `${fallback}: ${message}`;
}

/** Payments of a trip booking (TUR0011, migration 098). */
export class TripPaymentsService {
  static async list(bookingId: string): Promise<TripBookingPayment[]> {
    const { data, error } = await createClient()
      .from("trip_booking_payments")
      .select("*")
      .eq("trip_booking_id", bookingId)
      .order("paid_at", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      void Logger.error("Error loading trip payments", error, { bookingId });
      throw new Error("No se pudieron cargar los pagos");
    }
    return data ?? [];
  }

  /** Uploads the receipt (if any) and registers the payment. */
  static async register(
    booking: { id: string; organization_id: string },
    payment: NewTripPayment
  ): Promise<{ success: boolean; error?: string }> {
    let receiptPath: string | null = null;
    if (payment.receipt) {
      const uploaded = await uploadPaymentReceipt(booking.organization_id, booking.id, payment.receipt);
      if ("error" in uploaded) return { success: false, error: uploaded.error };
      receiptPath = uploaded.path;
    }

    // Every argument but the id, amount and method may be NULL in SQL; the generated types do not say so
    const args = {
      p_booking_id: booking.id,
      p_amount: payment.amount,
      p_paid_at: payment.paidAt,
      p_method: payment.method,
      p_method_other: payment.methodOther,
      p_reference: payment.reference,
      p_notes: payment.notes,
      p_receipt_path: receiptPath,
    } as unknown as Functions["register_trip_payment"]["Args"];
    const { error } = await createClient().rpc("register_trip_payment", args);
    if (!error) return { success: true };

    void Logger.error("Error registering trip payment", error);
    return { success: false, error: rpcError(error.message, "No se pudo registrar el pago") };
  }

  /** Owner or admin: the payment stays, crossed out, and stops counting. */
  static async void(paymentId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await createClient().rpc("void_trip_payment", {
      p_payment_id: paymentId,
      p_reason: reason,
    });
    if (!error) return { success: true };

    void Logger.error("Error voiding trip payment", error);
    return { success: false, error: rpcError(error.message, "No se pudo anular el pago") };
  }
}

/** Refunds of a trip booking and their history (TUR0011, migration 099). */
export class TripRefundsService {
  static async list(bookingId: string): Promise<TripBookingRefund[]> {
    const supabase = createClient();
    const { data: refunds, error } = await supabase
      .from("trip_booking_refunds")
      .select("*")
      .eq("trip_booking_id", bookingId)
      .order("created_at", { ascending: true });
    if (error) {
      void Logger.error("Error loading trip refunds", error, { bookingId });
      throw new Error("No se pudieron cargar las devoluciones");
    }
    if (!refunds?.length) return [];

    const { data: events, error: eventsError } = await supabase
      .from("trip_booking_refund_events")
      .select("*")
      .in(
        "refund_id",
        refunds.map((r) => r.id)
      )
      .order("changed_at", { ascending: true });
    if (eventsError) {
      void Logger.error("Error loading trip refund history", eventsError, { bookingId });
      throw new Error("No se pudo cargar el historial de las devoluciones");
    }
    return refunds.map((r) => ({
      ...r,
      events: (events ?? []).filter((e) => e.refund_id === r.id),
    }));
  }

  static async register(
    bookingId: string,
    refund: NewAppointmentRefund
  ): Promise<{ success: boolean; error?: string }> {
    // Method, its text and the date may be NULL in SQL; the generated types do not say so
    const args = {
      p_booking_id: bookingId,
      p_amount: refund.amount,
      p_reason: refund.reason,
      p_method: refund.method,
      p_method_other: refund.methodOther,
      p_processed: refund.processed,
      p_refunded_at: refund.refundedAt,
    } as unknown as Functions["register_trip_refund"]["Args"];
    const { error } = await createClient().rpc("register_trip_refund", args);
    if (!error) return { success: true };

    void Logger.error("Error registering trip refund", error);
    return { success: false, error: rpcError(error.message, "No se pudo registrar la devolución") };
  }

  static async decide(
    refundId: string,
    decision: RefundDecision
  ): Promise<{ success: boolean; error?: string }> {
    const processed = decision.status === "processed";
    const args = {
      p_refund_id: refundId,
      p_status: decision.status,
      p_note: processed ? null : decision.reason,
      p_method: processed ? decision.method : null,
      p_method_other: processed ? decision.methodOther : null,
      p_refunded_at: processed ? decision.refundedAt : null,
    } as unknown as Functions["set_trip_refund_status"]["Args"];
    const { error } = await createClient().rpc("set_trip_refund_status", args);
    if (!error) return { success: true };

    void Logger.error("Error deciding trip refund", error);
    return { success: false, error: rpcError(error.message, "No se pudo guardar la devolución") };
  }
}
