import { useAuth } from "@/contexts/auth-context";
import { FinanceService, type FinanceQuery } from "@/services/finance.service";
import type { FinanceGroupBy, FinanceRow } from "@/types/finance";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const financeKeys = {
  all: ["finance"] as const,
  summary: (query: FinanceQuery, groupBy: FinanceGroupBy) =>
    [...financeKeys.all, "summary", query, groupBy] as const,
  rows: (query: FinanceQuery, page: number) => [...financeKeys.all, "rows", query, page] as const,
};

/** Owner of the business or platform admin, like the reports. */
function useCanSeeFinance(query: FinanceQuery) {
  const { profile } = useAuth();
  const orgId = query.organizationId || profile?.organization_id;
  return !!orgId && (profile?.role === "owner" || profile?.role === "admin");
}

export function useFinanceSummary(query: FinanceQuery, groupBy: FinanceGroupBy, enabled = true) {
  const canSee = useCanSeeFinance(query);
  return useQuery({
    queryKey: financeKeys.summary(query, groupBy),
    queryFn: () => FinanceService.getSummary(query, groupBy),
    enabled: canSee && enabled,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });
}

export const FINANCE_PAGE_SIZE = 50;

export function useFinanceRows<Row extends FinanceRow>(query: FinanceQuery, page: number, enabled = true) {
  const canSee = useCanSeeFinance(query);
  return useQuery({
    queryKey: financeKeys.rows(query, page),
    queryFn: () => FinanceService.getRows<Row>(query, FINANCE_PAGE_SIZE, page * FINANCE_PAGE_SIZE),
    enabled: canSee && enabled,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });
}
