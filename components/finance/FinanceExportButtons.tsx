"use client";

import { useIsNative } from "@/hooks/useIsNative";
import { useToast } from "@/hooks";
import { FinanceService, type FinanceQuery } from "@/services/finance.service";
import type { FinanceGroupBy } from "@/types/finance";
import { downloadCsv } from "@/utils/csv";
import { csvNumber, financeDetailTable, financeWorkbook } from "@/utils/finance-export";
import { downloadXlsx } from "@/utils/xlsx";
import { Download } from "lucide-react";
import { useState } from "react";

const buttonClass =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-caption font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50";

/**
 * CSV and Excel of exactly what Finanzas shows (TUR0011): the whole filtered
 * detail, not just the page on screen. Downloads don't work inside the native
 * app, so there the buttons are left out, like the other exports.
 */
export function FinanceExportButtons({ query, groupBy }: { query: FinanceQuery; groupBy: FinanceGroupBy }) {
  const isNative = useIsNative();
  const toast = useToast();
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);

  if (isNative) return null;

  const name = `finanzas-${query.module === "trips" ? "pasajes" : "turnos"}_${query.start}_a_${query.end}`;

  const run = async (format: "csv" | "xlsx") => {
    setBusy(format);
    try {
      const { rows } = await FinanceService.getRows(query, null);
      if (format === "csv") {
        const table = financeDetailTable(query.module, rows);
        downloadCsv(name, table.headers, table.rows.map((row) => row.map(csvNumber)), ";");
      } else {
        const summary = await FinanceService.getSummary(query, groupBy);
        downloadXlsx(name, financeWorkbook(query.module, summary, rows));
      }
    } catch (err) {
      toast.error("No se pudo descargar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button type="button" className={buttonClass} disabled={!!busy} onClick={() => void run("csv")}>
        <Download className="size-3.5" />
        {busy === "csv" ? "Preparando…" : "CSV"}
      </button>
      <button type="button" className={buttonClass} disabled={!!busy} onClick={() => void run("xlsx")}>
        <Download className="size-3.5" />
        {busy === "xlsx" ? "Preparando…" : "Excel"}
      </button>
    </div>
  );
}
