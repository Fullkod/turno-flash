"use client";

import { KpiCard } from "@/components/analytics/widgets";
import { useMoney } from "@/hooks/useMoney";
import type { FinanceModule, FinanceTotals } from "@/types/finance";
import { AlertTriangle, CalendarClock, Hourglass, Wallet } from "lucide-react";

/** The four numbers of the period, and the refunds waiting for a decision. */
export function FinanceCards({
  totals,
  module,
  organizationId,
  onShowOverdue,
}: {
  totals: FinanceTotals | undefined;
  module: FinanceModule;
  organizationId?: string;
  /** Tapping "Vencido" filters the detail to what is owed */
  onShowOverdue: () => void;
}) {
  const { format: money } = useMoney(organizationId);
  const what = module === "trips" ? "de la salida" : "del turno";

  if (!totals) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Previsto"
          value={money(totals.expected)}
          hint={`${totals.rows} ${module === "trips" ? "reserva(s)" : "turno(s)"}`}
          icon={CalendarClock}
          tone="info"
        />
        <KpiCard
          label="Cobrado"
          value={money(totals.collected)}
          hint={
            totals.refunded > 0
              ? `${money(totals.collected_gross)} cobrado − ${money(totals.refunded)} devuelto`
              : "Lo que entró en caja"
          }
          icon={Wallet}
          tone="primary"
        />
        <KpiCard label="Pendiente" value={money(totals.pending)} hint="Falta cobrar" icon={Hourglass} tone="warning" />
        <button
          type="button"
          onClick={onShowOverdue}
          disabled={totals.overdue_count === 0}
          className="cursor-pointer rounded-2xl text-left disabled:cursor-default"
          aria-label={`Vencido: ${money(totals.overdue)}. Ver a quién reclamar`}
        >
          <KpiCard
            label="Vencido"
            value={money(totals.overdue)}
            hint={totals.overdue_count > 0 ? `${totals.overdue_count} por reclamar · ver` : "Nada atrasado"}
            icon={AlertTriangle}
            tone="danger"
          />
        </button>
      </div>
      {totals.refund_pending > 0 && (
        <p className="mt-2 text-caption text-warning-700 dark:text-warning-400">
          Devoluciones pendientes de decidir: {money(totals.refund_pending)}
        </p>
      )}
      <p className="mt-2 text-caption text-foreground-subtle">
        Lo cobrado cuenta el día en que entró el dinero; lo previsto y lo pendiente, el día {what}. Un
        anticipo pagado hoy para {module === "trips" ? "una salida" : "un turno"} del mes que viene suma a lo
        cobrado de este mes.
      </p>
    </div>
  );
}
