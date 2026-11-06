"use client";

import { shortDate } from "@/utils/finance-period";
import { Badge, Button } from "@/components/ui";
import { useMoney } from "@/hooks/useMoney";
import type { FinanceAppointmentRow, FinanceModule, FinanceRow, FinanceTripRow } from "@/types/finance";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const STATUS: Record<FinanceRow["payment_status"], { label: string; variant: "success" | "warning" | "muted" }> = {
  paid: { label: "Pagado", variant: "success" },
  partial: { label: "Pago parcial", variant: "warning" },
  unpaid: { label: "Sin pagar", variant: "muted" },
};

/** Where a row opens: the appointment, or the money of the booking in its departure. */
function rowHref(module: FinanceModule, row: FinanceRow): string {
  if (module === "trips") {
    return `/dashboard/trips/details?id=${(row as FinanceTripRow).trip_id}&open=${row.id}`;
  }
  return `/dashboard/appointments?open=${row.id}`;
}

function subtitle(module: FinanceModule, row: FinanceRow): string {
  if (module === "trips") {
    const t = row as FinanceTripRow;
    return [
      t.trip_title,
      t.destination,
      t.pickup_point,
      t.trip_type === "round_trip" ? "ida y vuelta" : null,
      `${t.seats} asiento(s)`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const a = row as FinanceAppointmentRow;
  return [a.service_name, a.staff_name].filter(Boolean).join(" · ");
}

/**
 * The detail of Finanzas, one row per appointment / booking. Rows open their
 * detail, except for a platform admin looking at another business.
 */
export function FinanceRows({
  module,
  rows,
  total,
  page,
  pageSize,
  onPage,
  linkable,
  organizationId,
}: {
  module: FinanceModule;
  rows: FinanceRow[];
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  linkable: boolean;
  organizationId?: string;
}) {
  const { format: money } = useMoney(organizationId);

  if (!rows.length) {
    return (
      <p className="py-6 text-center text-meta text-foreground-muted">
        No hay {module === "trips" ? "reservas" : "turnos"} con estos filtros.
      </p>
    );
  }

  const from = page * pageSize + 1;
  const to = Math.min(total, from + rows.length - 1);

  return (
    <div>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((row) => {
          const content = <RowContent module={module} row={row} money={money} linkable={linkable} />;
          return (
            <li key={row.id}>
              {linkable ? (
                <Link href={rowHref(module, row)} className="block rounded-lg hover:bg-surface-2">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
      {total > pageSize && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page === 0}>
            Anteriores
          </Button>
          <span className="text-caption text-foreground-muted">
            {from}–{to} de {total}
          </span>
          <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={to >= total}>
            Siguientes
          </Button>
        </div>
      )}
    </div>
  );
}

function RowContent({
  module,
  row,
  money,
  linkable,
}: {
  module: FinanceModule;
  row: FinanceRow;
  money: (value: number) => string;
  linkable: boolean;
}) {
  const status = STATUS[row.payment_status];
  const refunds = row.refunded + row.refund_pending;
  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-meta font-semibold text-foreground">{row.number ?? "—"}</span>
          <span className="text-caption text-foreground-muted">
            {shortDate(row.date)}
            {row.time ? ` · ${row.time}` : ""}
          </span>
          {row.overdue > 0 ? (
            <Badge variant="danger">Vencido {money(row.overdue)}</Badge>
          ) : row.closed ? (
            <Badge variant="muted">{module === "trips" ? "Cancelada" : row.status === "no_show" ? "No vino" : "Cancelado"}</Badge>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
          {refunds > 0 && (
            <Badge variant="warning">
              {row.refund_pending > 0 ? "Devolución pendiente" : `Devuelto ${money(row.refunded)}`}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-body text-foreground">{row.customer_name || "Sin nombre"}</p>
        <p className="truncate text-caption text-foreground-muted">{subtitle(module, row)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-body font-semibold tabular-nums text-foreground">{money(row.paid)}</p>
        <p className="text-caption text-foreground-muted">
          {row.closed ? "pagado" : `de ${money(row.expected)}`}
        </p>
        {!row.closed && row.pending > 0 && (
          <p className="text-caption text-warning-700 dark:text-warning-400">falta {money(row.pending)}</p>
        )}
      </div>
      {linkable && <ChevronRight aria-hidden className="size-4 shrink-0 text-foreground-subtle" />}
    </div>
  );
}
