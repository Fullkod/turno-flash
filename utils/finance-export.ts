import { bucketLabel, FINANCE_STATUS_LABEL } from "@/utils/finance-period";
import type {
  FinanceAppointmentRow,
  FinanceModule,
  FinanceRow,
  FinanceSummary,
  FinanceTripRow,
} from "@/types/finance";
import { getStatusMeta } from "@/utils/appointment-status";
import type { AppointmentStatus } from "@/types/appointments";
import type { XlsxCell, XlsxSheet } from "@/utils/xlsx";

/** Status of a trip booking, as the departure detail names it. */
const TRIP_STATUS: Record<string, string> = {
  pending: "Por aprobar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Viajó",
  no_show: "No se presentó",
};

const MONEY_HEADERS = ["Precio", "Pagado", "Devuelto", "Devolución pendiente", "Pendiente", "Vencido", "Estado del pago"];

function moneyCells(row: FinanceRow): XlsxCell[] {
  return [
    row.expected,
    row.paid,
    row.refunded,
    row.refund_pending,
    row.pending,
    row.overdue,
    row.overdue > 0 ? FINANCE_STATUS_LABEL.overdue : FINANCE_STATUS_LABEL[row.payment_status],
  ];
}

/** The detail of one tab: headers and one row per appointment / booking, numbers as numbers. */
export function financeDetailTable(module: FinanceModule, rows: FinanceRow[]): { headers: string[]; rows: XlsxCell[][] } {
  if (module === "trips") {
    return {
      headers: [
        "Reserva", "Fecha", "Hora", "Salida", "Destino", "Punto de recogida", "Viaje", "Asientos",
        "Reservó", "Teléfono", "Pasajeros", "Estado", ...MONEY_HEADERS,
      ],
      rows: (rows as FinanceTripRow[]).map((r) => [
        r.number, r.date, r.time, r.trip_title, r.destination, r.pickup_point,
        r.trip_type === "round_trip" ? "Ida y vuelta" : "Solo ida", r.seats,
        r.customer_name, r.customer_phone, r.passengers, TRIP_STATUS[r.status] ?? r.status, ...moneyCells(r),
      ]),
    };
  }
  return {
    headers: ["Turno", "Fecha", "Hora", "Cliente", "Teléfono", "Servicio", "Profesional", "Estado", ...MONEY_HEADERS],
    rows: (rows as FinanceAppointmentRow[]).map((r) => [
      r.number, r.date, r.time, r.customer_name, r.customer_phone, r.service_name, r.staff_name,
      getStatusMeta(r.status as AppointmentStatus)?.label ?? r.status, ...moneyCells(r),
    ]),
  };
}

/** The workbook: "Resumen" (the cards and the buckets) and "Detalle". */
export function financeWorkbook(module: FinanceModule, summary: FinanceSummary, rows: FinanceRow[]): XlsxSheet[] {
  const t = summary.totals;
  const detail = financeDetailTable(module, rows);
  return [
    {
      name: "Resumen",
      rows: [
        [module === "trips" ? "Finanzas · Pasajes" : "Finanzas · Turnos"],
        ["Desde", summary.start_date, "Hasta", summary.end_date],
        [],
        ["Previsto", t.expected],
        ["Cobrado (neto)", t.collected],
        ["Cobrado bruto", t.collected_gross],
        ["Devuelto", t.refunded],
        ["Pendiente", t.pending],
        ["Vencido", t.overdue],
        ["Devoluciones pendientes", t.refund_pending],
        [],
        ["Periodo", "Previsto", "Cobrado", "Devuelto", "Pendiente", "Vencido"],
        ...summary.buckets.map((b) => [
          bucketLabel(b.period, summary.group_by), b.expected, b.collected, b.refunded, b.pending, b.overdue,
        ]),
      ],
    },
    { name: "Detalle", rows: [detail.headers, ...detail.rows] },
  ];
}

/** "1234,5" — Excel in Spanish reads a comma as the decimal mark in a CSV. */
export function csvNumber(value: XlsxCell): string | XlsxCell {
  return typeof value === "number" ? String(value).replace(".", ",") : value;
}
