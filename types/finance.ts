/** Finanzas (TUR0011, migration 100). Each module has its own tab, filters and detail. */
export type FinanceModule = "appointments" | "trips";
export type FinanceGroupBy = "day" | "week" | "month";
export type FinancePaymentStatus = "unpaid" | "partial" | "paid" | "overdue" | "refunded";

export interface FinanceTotals {
  /** Price of what is not cancelled, by the date of the appointment / departure */
  expected: number;
  /** Payments by the date they came in */
  collected_gross: number;
  /** Processed refunds by the date they went out */
  refunded: number;
  /** collected_gross - refunded */
  collected: number;
  pending: number;
  overdue: number;
  overdue_count: number;
  refund_pending: number;
  rows: number;
}

export interface FinanceBucket {
  /** YYYY-MM-DD: first day of the day / week (Monday) / month */
  period: string;
  expected: number;
  collected_gross: number;
  refunded: number;
  collected: number;
  pending: number;
  overdue: number;
}

export interface FinanceSummary {
  organization_id: string;
  module: FinanceModule;
  start_date: string;
  end_date: string;
  group_by: FinanceGroupBy;
  totals: FinanceTotals;
  buckets: FinanceBucket[];
}

/** The money of one row, the same for both modules. */
interface FinanceRowMoney {
  id: string;
  /** YYYY-MM-DD of the appointment / departure */
  date: string;
  /** HH:MM */
  time: string | null;
  number: string | null;
  status: string;
  /** Cancelled, no-show or a cancelled departure: it counts only for its money */
  closed: boolean;
  expected: number;
  paid: number;
  refunded: number;
  refund_pending: number;
  pending: number;
  overdue: number;
  payment_status: "unpaid" | "partial" | "paid";
  customer_name: string;
  customer_phone: string | null;
}

export interface FinanceAppointmentRow extends FinanceRowMoney {
  customer_id: string;
  service_name: string | null;
  staff_name: string | null;
}

export interface FinanceTripRow extends FinanceRowMoney {
  trip_id: string;
  trip_title: string;
  destination: string | null;
  pickup_point: string | null;
  trip_type: "one_way" | "round_trip";
  seats: number;
  passengers: string;
}

export type FinanceRow = FinanceAppointmentRow | FinanceTripRow;

export interface FinanceRowsPage<Row extends FinanceRow = FinanceRow> {
  total_count: number;
  rows: Row[];
}
