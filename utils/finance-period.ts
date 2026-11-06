import type { FinanceGroupBy, FinancePaymentStatus } from "@/types/finance";

export type PeriodKey = "today" | "week" | "month" | "last_month" | "next_30" | "custom";

export const PERIODS: readonly { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "last_month", label: "Mes pasado" },
  { key: "next_30", label: "Próximos 30 días" },
  { key: "custom", label: "Elegir fechas" },
];

export const GROUP_OPTIONS: { value: FinanceGroupBy; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

export const FINANCE_STATUS_LABEL: Record<FinancePaymentStatus, string> = {
  unpaid: "Sin pagar",
  partial: "Pago parcial",
  paid: "Pagado",
  overdue: "Vencido",
  refunded: "Con devolución",
};

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The dates of a quick period; weeks start on Monday, like the buckets (100). */
export function periodRange(key: Exclude<PeriodKey, "custom">): { start: string; end: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (key) {
    case "today":
      return { start: toDateString(today), end: toDateString(today) };
    case "week": {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: toDateString(monday), end: toDateString(sunday) };
    }
    case "month":
      return { start: toDateString(new Date(y, m, 1)), end: toDateString(new Date(y, m + 1, 0)) };
    case "last_month":
      return { start: toDateString(new Date(y, m - 1, 1)), end: toDateString(new Date(y, m, 0)) };
    case "next_30": {
      const end = new Date(today);
      end.setDate(today.getDate() + 29);
      return { start: toDateString(today), end: toDateString(end) };
    }
  }
}

/** A sensible grouping for the length of the period. */
export function defaultGroupBy(start: string, end: string): FinanceGroupBy {
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000 + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "11 jun", "sem. 9 jun" or "jun 26" for a bucket. */
export function bucketLabel(period: string, groupBy: FinanceGroupBy): string {
  const [y, m, d] = period.split("-").map(Number);
  if (groupBy === "month") return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
  const day = `${d} ${MONTHS[m - 1]}`;
  return groupBy === "week" ? `sem. ${day}` : day;
}

/** "15 sep 2026" from YYYY-MM-DD, without timezone shifting. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
