"use client";

import { bucketLabel } from "@/utils/finance-period";
import { useMoney } from "@/hooks/useMoney";
import type { FinanceBucket, FinanceGroupBy } from "@/types/finance";

const COLUMNS: { key: keyof Omit<FinanceBucket, "period" | "collected_gross">; label: string }[] = [
  { key: "expected", label: "Previsto" },
  { key: "collected", label: "Cobrado" },
  { key: "refunded", label: "Devuelto" },
  { key: "pending", label: "Pendiente" },
  { key: "overdue", label: "Vencido" },
];

/** The table under the chart: the same numbers, readable without color. */
export function FinanceBuckets({
  buckets,
  groupBy,
  organizationId,
}: {
  buckets: FinanceBucket[];
  groupBy: FinanceGroupBy;
  organizationId?: string;
}) {
  const { format: money } = useMoney(organizationId);
  // Empty periods add nothing to read: the chart already shows the gaps
  const rows = buckets.filter((b) => COLUMNS.some((c) => b[c.key] !== 0));

  if (!rows.length) {
    return <p className="py-4 text-center text-meta text-foreground-muted">No hay movimientos en este periodo.</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[520px] text-meta">
        <thead>
          <tr className="border-b border-border text-left text-caption text-foreground-subtle">
            <th className="py-2 pr-3 font-semibold">Periodo</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="py-2 pl-3 text-right font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((b) => (
            <tr key={b.period}>
              <td className="py-2 pr-3 text-foreground">{bucketLabel(b.period, groupBy)}</td>
              {COLUMNS.map((c) => (
                <td key={c.key} className="py-2 pl-3 text-right font-mono tabular-nums text-foreground">
                  {b[c.key] ? money(b[c.key]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
