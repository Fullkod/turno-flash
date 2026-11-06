"use client";

import { bucketLabel } from "@/utils/finance-period";
import { useMoney } from "@/hooks/useMoney";
import type { FinanceBucket, FinanceGroupBy } from "@/types/finance";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Expected vs collected per bucket (TUR0011). Import with next/dynamic
 * ({ ssr: false }), like the other recharts components.
 *
 * Two fixed hues of the theme ramps (info-500, primary-600), checked with the
 * dataviz validator against both surfaces: they pass in light and dark, so the
 * chart does not switch them with the theme.
 */
const SERIES = {
  expected: { color: "#3b7ddd", label: "Previsto" },
  collected: { color: "#147a42", label: "Cobrado" },
} as const;

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-surface, #fff)",
  border: "1px solid var(--color-border, #e5e7eb)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-foreground, #111)",
};

const AXIS_TICK = { fontSize: 11, fill: "var(--color-foreground-muted, #6b7280)" };

export function FinanceChart({
  buckets,
  groupBy,
  organizationId,
}: {
  buckets: FinanceBucket[];
  groupBy: FinanceGroupBy;
  /** Set when a platform admin views another business, for its currency. */
  organizationId?: string;
}) {
  const { format: money } = useMoney(organizationId);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="var(--color-border, #e5e7eb)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(p: string) => bucketLabel(p, groupBy)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis tickFormatter={(v: number) => money(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={76} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--color-surface-2, #f3f4f6)" }}
          labelFormatter={(label) => bucketLabel(String(label), groupBy)}
          formatter={(value, name) => [money(Number(value)), SERIES[name as keyof typeof SERIES]?.label ?? name]}
        />
        <Legend
          formatter={(name: string) => (
            <span style={{ color: "var(--color-foreground-muted, #6b7280)", fontSize: 12 }}>
              {SERIES[name as keyof typeof SERIES]?.label ?? name}
            </span>
          )}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="expected" fill={SERIES.expected.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="collected" fill={SERIES.collected.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
