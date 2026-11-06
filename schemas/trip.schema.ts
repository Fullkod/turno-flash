import { z } from "zod";

/**
 * Trip (departure) form schema. Shared by the form and the service layer,
 * same as service.schema.ts does for services.
 */
export const tripFormSchema = z
  .object({
    title: z
      .string()
      .min(2, { message: "El título debe tener al menos 2 caracteres" })
      .max(120, { message: "El título no puede superar los 120 caracteres" })
      .trim(),
    description: z
      .string()
      .max(1000, {
        message: "La descripción no puede superar los 1000 caracteres",
      })
      .optional()
      .or(z.literal("")),
    pickup_location: z
      .string()
      .max(200, {
        message: "El punto de encuentro no puede superar los 200 caracteres",
      })
      .optional()
      .or(z.literal("")),
    destination: z
      .string()
      .trim()
      .max(120, { message: "El destino no puede superar los 120 caracteres" })
      .optional()
      .or(z.literal("")),
    departure_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha de salida inválida" }),
    departure_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Hora de salida inválida" }),
    return_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Hora de regreso inválida" })
      .optional()
      .or(z.literal("")),
    total_seats: z
      .number()
      .int({ message: "Los asientos deben ser un número entero" })
      .min(1, { message: "La salida necesita al menos 1 asiento" })
      .max(200, { message: "El máximo es 200 asientos" }),
    max_seats_per_booking: z
      .number()
      .int({ message: "Debe ser un número entero" })
      .min(1, { message: "Debe permitir al menos 1 asiento por reserva" })
      .max(50, { message: "El máximo es 50 asientos por reserva" }),
    price_per_seat: z
      .number()
      .min(0, { message: "El precio no puede ser negativo" })
      .max(1000000, { message: "El precio no puede superar 1,000,000" }),
    deposit_per_seat: z
      .number()
      .min(0, { message: "El anticipo no puede ser negativa" })
      .max(1000000, { message: "El anticipo no puede superar 1,000,000" }),
    round_trip_enabled: z.boolean(),
    price_round_trip: z
      .number()
      .min(0, { message: "El precio no puede ser negativo" })
      .max(1000000, { message: "El precio no puede superar 1,000,000" }),
    currency: z.string().min(1).max(10),
    requires_approval: z.boolean(),
    is_published: z.boolean(),
    driver_name: z.string().max(120).optional().or(z.literal("")),
    driver_phone: z.string().max(40).optional().or(z.literal("")),
    vehicle_description: z.string().max(200).optional().or(z.literal("")),
    vehicle_photo_path: z.string().max(300).optional().or(z.literal("")),
    booking_opens_at: z.string().optional().or(z.literal("")),
    booking_closes_at: z.string().optional().or(z.literal("")),
    internal_notes: z
      .string()
      .max(1000, { message: "Las notas no pueden superar los 1000 caracteres" })
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => data.price_per_seat === 0 || data.deposit_per_seat <= data.price_per_seat,
    {
      message: "El anticipo no puede ser mayor que el precio del asiento",
      path: ["deposit_per_seat"],
    }
  )
  .refine((data) => data.max_seats_per_booking <= data.total_seats, {
    message: "No se pueden reservar más asientos de los que tiene la salida",
    path: ["max_seats_per_booking"],
  })
  .refine(
    (data) =>
      !data.booking_opens_at ||
      !data.booking_closes_at ||
      data.booking_opens_at < data.booking_closes_at,
    {
      message: "Las reservas no pueden cerrar antes de abrir",
      path: ["booking_closes_at"],
    }
  );

export type TripFormSchema = z.infer<typeof tripFormSchema>;

/**
 * One pickup point. Same rule as the 037 CHECK (a price of 0 means "the trip's
 * price"), checked here so the owner gets a message instead of a stop that
 * silently fails to save.
 */
export const pickupPointSchema = z
  .object({
    name: z.string().trim().min(1),
    price_per_seat: z.number().min(0, "El precio no puede ser negativo"),
    deposit_per_seat: z.number().min(0, "El anticipo no puede ser negativo"),
  })
  .refine(
    (point) =>
      point.price_per_seat === 0 || point.deposit_per_seat <= point.price_per_seat,
    { message: "El anticipo no puede ser mayor que el precio" }
  );
