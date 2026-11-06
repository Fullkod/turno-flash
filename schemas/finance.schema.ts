import { z } from "zod";

const optionalId = z.string().uuid().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

/** Filters of Finanzas (TUR0011), the keys the functions of migration 100 read. */
export const financeFiltersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  method: z.enum(["cash", "transfer", "card", "other"]).optional(),
  payment_status: z.enum(["unpaid", "partial", "paid", "overdue", "refunded"]).optional(),
  // Turnos
  service_id: optionalId,
  staff_id: optionalId,
  customer_id: optionalId,
  // Pasajes
  trip_id: optionalId,
  /** "__none__" = departures without a destination */
  destination: z.string().trim().max(120).optional(),
  pickup_point_id: optionalId,
  trip_type: z.enum(["one_way", "round_trip"]).optional(),
});

export type FinanceFilters = z.infer<typeof financeFiltersSchema>;

/** The period: at most 400 days, like the reports (088). */
export const financePeriodSchema = z
  .object({ start: date, end: date })
  .refine((p) => p.start <= p.end, { message: "La fecha «Desde» va antes que «Hasta»" })
  .refine(
    (p) => (new Date(p.end).getTime() - new Date(p.start).getTime()) / 86_400_000 + 1 <= 400,
    { message: "El periodo puede tener como mucho 400 días" }
  );

/** Only what is set travels to the database: empty strings are dropped. */
export function cleanFinanceFilters(filters: FinanceFilters): FinanceFilters {
  return financeFiltersSchema.parse(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined))
  );
}
