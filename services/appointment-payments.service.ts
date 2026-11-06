import type { Database } from "@/types/database.types";
import { downscaleImage } from "@/utils/image";
import { Logger } from "@/utils/logger";
import { createClient } from "@/utils/supabase/client";

export type PaymentMethod = Database["public"]["Enums"]["appointment_payment_method"];
export type AppointmentPayment =
  Database["public"]["Tables"]["appointment_payments"]["Row"];

/** A payment as the "Registrar pago" sheet sends it. */
export interface NewAppointmentPayment {
  amount: number;
  /** ISO; null = now */
  paidAt: string | null;
  method: PaymentMethod;
  methodOther: string | null;
  reference: string | null;
  notes: string | null;
  receipt: File | null;
  isDeposit: boolean;
}

// Private bucket of migration 095: <organization>/<appointment>/<file>
const RECEIPT_BUCKET = "appointment-receipts";
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const RPC_ERRORS: Record<string, string> = {
  payment_forbidden: "No tienes permiso para esto.",
  payment_not_found: "No se encontró el turno o el pago. Actualiza la pantalla.",
  invalid_amount: "El importe no es válido.",
  invalid_paid_at: "La fecha del pago no puede ser futura.",
  invalid_receipt: "El comprobante no es válido.",
  deposit_not_open: "Este turno no tiene un anticipo por cobrar.",
  deposit_already_registered: "El anticipo de este turno ya está registrado.",
  invalid_reason: "Escribe el motivo.",
  payment_already_voided: "Ese pago ya estaba anulado.",
  payment_refunded: "Ese dinero ya se devolvió o tiene una devolución pendiente. Rechaza antes la devolución pendiente.",
};

function rpcError(message: string, fallback: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return key ? RPC_ERRORS[key] : `${fallback}: ${message}`;
}

/**
 * Uploads a receipt to <organization>/<owner>/<file>, the owner being the appointment (095) or the
 * trip booking (098) the payment belongs to.
 */
export async function uploadPaymentReceipt(
  organizationId: string,
  ownerId: string,
  receipt: File
): Promise<{ path: string } | { error: string }> {
  const file = await downscaleImage(receipt);
  if (!RECEIPT_TYPES.includes(file.type)) {
    return { error: "El comprobante tiene que ser una foto o un PDF." };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: "El comprobante pesa más de 5 MB." };
  }
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${organizationId}/${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    void Logger.error("Error uploading payment receipt", error, { ownerId });
    return { error: "No se pudo subir el comprobante." };
  }
  return { path };
}

/** Payments of an appointment (TUR0008, migration 095). */
export class AppointmentPaymentsService {
  static async list(appointmentId: string): Promise<AppointmentPayment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointment_payments")
      .select("*")
      .eq("appointment_id", appointmentId)
      .order("paid_at", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      void Logger.error("Error loading appointment payments", error, { appointmentId });
      throw new Error("No se pudieron cargar los pagos");
    }
    return data ?? [];
  }

  /** Uploads the receipt (if any) and registers the payment. */
  static async register(
    appointment: { id: string; organization_id: string },
    payment: NewAppointmentPayment
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    let receiptPath: string | null = null;

    if (payment.receipt) {
      const uploaded = await uploadPaymentReceipt(
        appointment.organization_id,
        appointment.id,
        payment.receipt
      );
      if ("error" in uploaded) return { success: false, error: uploaded.error };
      receiptPath = uploaded.path;
    }

    // Every argument but the id, amount and method may be NULL in SQL; the generated types do not say so
    const args = {
      p_appointment_id: appointment.id,
      p_amount: payment.amount,
      p_paid_at: payment.paidAt,
      p_method: payment.method,
      p_method_other: payment.methodOther,
      p_reference: payment.reference,
      p_notes: payment.notes,
      p_receipt_path: receiptPath,
      p_is_deposit: payment.isDeposit,
    } as unknown as Database["public"]["Functions"]["register_appointment_payment"]["Args"];
    const { error } = await supabase.rpc("register_appointment_payment", args);
    if (!error) return { success: true };

    void Logger.error("Error registering appointment payment", error);
    return { success: false, error: rpcError(error.message, "No se pudo registrar el pago") };
  }

  /** Owner or admin: the payment stays, crossed out, and stops counting. */
  static async void(
    paymentId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    const { error } = await supabase.rpc("void_appointment_payment", {
      p_payment_id: paymentId,
      p_reason: reason,
    });
    if (!error) return { success: true };

    void Logger.error("Error voiding appointment payment", error);
    return { success: false, error: rpcError(error.message, "No se pudo anular el pago") };
  }

  /** The bucket is private: a link that works for a few minutes. */
  static async receiptUrl(path: string): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(path, 300);
    if (error) {
      void Logger.error("Error signing payment receipt", error, { path });
      return null;
    }
    return data.signedUrl;
  }
}
