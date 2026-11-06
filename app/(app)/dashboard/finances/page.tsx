"use client";

import { FinanceBuckets } from "@/components/finance/FinanceBuckets";
import { FinanceCards } from "@/components/finance/FinanceCards";
import { FinanceExportButtons } from "@/components/finance/FinanceExportButtons";
import { FinanceFilters } from "@/components/finance/FinanceFilters";
import { FinanceRows } from "@/components/finance/FinanceRows";
import {
  GROUP_OPTIONS,
  PERIODS,
  defaultGroupBy,
  periodRange,
  toDateString,
  type PeriodKey,
} from "@/utils/finance-period";
import { PageMetadata } from "@/components/page-metadata";
import { ProtectedRoute } from "@/components/protected-route";
import { Button, Card, Field, FilterChips, SectionLabel, SegmentedControl, Sheet } from "@/components/ui";
import { sheetInputClasses as inputClasses } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { FINANCE_PAGE_SIZE, useFinanceRows, useFinanceSummary } from "@/hooks/useFinance.query";
import { useOrganizationModules } from "@/hooks/useOrganizationModules.query";
import { cleanFinanceFilters, financePeriodSchema, type FinanceFilters as Filters } from "@/schemas/finance.schema";
import type { FinanceQuery } from "@/services/finance.service";
import type { FinanceGroupBy, FinanceModule } from "@/types/finance";
import { SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

// recharts only on the client and out of the first bundle
const FinanceChart = dynamic(() => import("@/components/finance/FinanceChart").then((m) => m.FinanceChart), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-xl bg-surface-2" />,
});

export default function FinancesPage() {
  return (
    <Suspense fallback={null}>
      <FinancesContent />
    </Suspense>
  );
}

/** Applies the search a moment after typing stops, so each key is not a query. */
function useDebounced(value: string, ms = 400): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function FinancesContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  // A platform admin opens any business's numbers from its details page, like the reports
  const searchParams = useSearchParams();
  const adminOrgId = (isAdmin && searchParams.get("org")) || undefined;
  const { modules } = useOrganizationModules(adminOrgId);
  const available = useMemo(
    () =>
      [
        modules.appointments ? { value: "appointments" as const, label: "Turnos" } : null,
        modules.trips ? { value: "trips" as const, label: "Pasajes" } : null,
      ].filter((m): m is { value: FinanceModule; label: string } => !!m),
    [modules.appointments, modules.trips]
  );
  const [chosenModule, setModule] = useState<FinanceModule | null>(null);
  const activeModule = chosenModule && available.some((m) => m.value === chosenModule)
    ? chosenModule
    : (available[0]?.value ?? "appointments");

  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [custom, setCustom] = useState(() => periodRange("month"));
  const range = periodKey === "custom" ? custom : periodRange(periodKey);
  const period = financePeriodSchema.safeParse(range);
  const [chosenGroup, setGroup] = useState<FinanceGroupBy | null>(null);
  const groupBy = chosenGroup ?? defaultGroupBy(range.start, range.end);

  const [filters, setFilters] = useState<Filters>({});
  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebounced(searchDraft);
  // The page belongs to one question: a new search or period starts from the first one
  const pageKey = `${activeModule}|${search}|${range.start}|${range.end}|${JSON.stringify(filters)}`;
  const [pageState, setPageState] = useState({ key: pageKey, page: 0 });
  const page = pageState.key === pageKey ? pageState.page : 0;
  const setPage = (next: number) => setPageState({ key: pageKey, page: next });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query: FinanceQuery = useMemo(
    () => ({
      module: activeModule,
      start: range.start,
      end: range.end,
      organizationId: adminOrgId,
      filters: cleanFinanceFilters({ ...filters, search }),
    }),
    [activeModule, range.start, range.end, adminOrgId, filters, search]
  );
  const summary = useFinanceSummary(query, groupBy, period.success);
  const rows = useFinanceRows(query, page, period.success);

  const canView = (profile?.role === "owner" || isAdmin) && !!(adminOrgId || profile?.organization_id);
  const activeFilters = Object.keys(query.filters).length;
  const error = summary.error ?? rows.error;

  const changeFilters = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }));
  const changeModule = (next: FinanceModule) => {
    setModule(next);
    setFilters({});
    setSearchDraft("");
  };

  const filterPanel = (
    <FinanceFilters
      module={activeModule}
      filters={filters}
      search={searchDraft}
      onSearch={setSearchDraft}
      onChange={changeFilters}
      ownBusiness={!adminOrgId}
    />
  );

  return (
    <ProtectedRoute>
      <PageMetadata
        title="Finanzas"
        description="El dinero de tu negocio: lo previsto, lo cobrado, lo pendiente y lo vencido, turno por turno y pasaje por pasaje."
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 lg:px-8 lg:pt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-display text-foreground">Finanzas</h1>
              {adminOrgId ? (
                <p className="mt-0.5 text-sm text-foreground-muted">
                  {modules.name || "Negocio"} ·{" "}
                  <Link
                    href={`/dashboard/organizations/details?id=${adminOrgId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    Volver a la organización
                  </Link>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-foreground-muted">Cuánto esperas, cuánto entró y qué falta.</p>
              )}
            </div>
            {available.length > 1 && (
              <SegmentedControl label="Módulo" options={available} value={activeModule} onChange={changeModule} />
            )}
          </div>

          {profile && !canView && (
            <Card className="p-8 text-center">
              <div className="text-sm font-semibold text-foreground">Solo los dueños pueden ver las finanzas</div>
              <div className="mt-1 text-xs text-foreground-muted">Pídele acceso al dueño de tu negocio.</div>
            </Card>
          )}

          {canView && available.length === 0 && (
            <Card className="p-8 text-center text-sm text-foreground-muted">
              Este negocio no tiene activado ni Turnos ni Pasajes.
            </Card>
          )}

          {canView && available.length > 0 && (
            <div className="flex flex-col gap-4">
              <FilterChips
                label="Periodo"
                chips={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
                value={periodKey}
                onChange={(key) => {
                  setPeriodKey(key);
                  setGroup(null);
                }}
              />
              {periodKey === "custom" && (
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <Field label="Desde">
                    <input
                      type="date"
                      value={custom.start}
                      onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value || toDateString(new Date()) }))}
                      className={inputClasses}
                    />
                  </Field>
                  <Field label="Hasta" hint="Para un solo día, la misma fecha.">
                    <input
                      type="date"
                      value={custom.end}
                      onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value || c.start }))}
                      className={inputClasses}
                    />
                  </Field>
                </div>
              )}
              {!period.success && (
                <p className="text-meta text-danger-600 dark:text-danger-400">{period.error.issues[0]?.message}</p>
              )}

              {/* Filters: inline on desktop, a sheet on the phone */}
              <div className="flex items-center gap-2 lg:hidden">
                <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal className="size-4" />
                  Filtros{activeFilters > 0 ? ` · ${activeFilters}` : ""}
                </Button>
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters({});
                      setSearchDraft("");
                    }}
                  >
                    Quitar filtros
                  </Button>
                )}
              </div>
              <Card className="hidden p-4 lg:block">{filterPanel}</Card>
              <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
                <div className="flex flex-col gap-4">
                  {filterPanel}
                  <Button onClick={() => setFiltersOpen(false)} className="w-full justify-center">
                    Ver resultados
                  </Button>
                </div>
              </Sheet>

              {error && (
                <Card className="border-danger-200 bg-danger-50 p-5 text-sm text-danger-800 dark:border-danger-900/40 dark:bg-danger-900 dark:text-danger-200">
                  {error.message}
                </Card>
              )}

              <FinanceCards
                totals={summary.data?.totals}
                module={activeModule}
                organizationId={adminOrgId}
                onShowOverdue={() => changeFilters({ payment_status: "overdue" })}
              />

              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-meta font-semibold text-foreground">Resumen por periodo</div>
                  <SegmentedControl label="Agrupar por" options={GROUP_OPTIONS} value={groupBy} onChange={setGroup} />
                </div>
                {summary.data ? (
                  <>
                    <FinanceChart buckets={summary.data.buckets} groupBy={groupBy} organizationId={adminOrgId} />
                    <div className="mt-4">
                      <FinanceBuckets buckets={summary.data.buckets} groupBy={groupBy} organizationId={adminOrgId} />
                    </div>
                  </>
                ) : (
                  <div className="h-[260px] w-full animate-pulse rounded-xl bg-surface-2" />
                )}
              </Card>

              <div>
                <SectionLabel
                  count={rows.data?.total_count}
                  action={period.success ? <FinanceExportButtons query={query} groupBy={groupBy} /> : undefined}
                  className="pt-2"
                >
                  {activeModule === "trips" ? "Reserva por reserva" : "Turno por turno"}
                </SectionLabel>
                <Card className="px-3 py-1">
                  {rows.data ? (
                    <FinanceRows
                      module={activeModule}
                      rows={rows.data.rows}
                      total={rows.data.total_count}
                      page={page}
                      pageSize={FINANCE_PAGE_SIZE}
                      onPage={setPage}
                      linkable={!adminOrgId}
                      organizationId={adminOrgId}
                    />
                  ) : (
                    <div className="my-3 h-40 animate-pulse rounded-xl bg-surface-2" />
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
