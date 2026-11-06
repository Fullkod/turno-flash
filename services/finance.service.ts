import type { FinanceFilters } from "@/schemas/finance.schema";
import type {
  FinanceGroupBy,
  FinanceModule,
  FinanceRow,
  FinanceRowsPage,
  FinanceSummary,
} from "@/types/finance";
import type { Json } from "@/types/database.types";
import { Logger } from "@/utils/logger";
import { createClient } from "@/utils/supabase/client";

const RPC_ERRORS: Record<string, string> = {
  finance_forbidden: "Solo el dueño del negocio ve las finanzas.",
  finance_blocked: "Acceso bloqueado: la licencia del negocio venció.",
  finance_no_organization: "Elige un negocio.",
  finance_period_too_long: "El periodo puede tener como mucho 400 días.",
  finance_invalid_period: "El periodo no es válido.",
};

function rpcError(message: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return key ? RPC_ERRORS[key] : "No se pudieron cargar las finanzas";
}

export interface FinanceQuery {
  module: FinanceModule;
  start: string;
  end: string;
  /** Platform admin looking at another business (?org=) */
  organizationId?: string;
  filters: FinanceFilters;
}

/**
 * Finanzas (TUR0011): thin wrappers over the read-only functions of migration 100.
 * Every total is computed in Postgres; the client never adds up paginated rows.
 */
export class FinanceService {
  static async getSummary(query: FinanceQuery, groupBy: FinanceGroupBy): Promise<FinanceSummary> {
    const { data, error } = await createClient().rpc("get_financial_summary", {
      p_module: query.module,
      p_start_date: query.start,
      p_end_date: query.end,
      p_group_by: groupBy,
      p_organization_id: query.organizationId,
      p_filters: query.filters as Json,
    });
    if (error) {
      void Logger.error("Error loading financial summary", error);
      throw new Error(rpcError(error.message));
    }
    return data as unknown as FinanceSummary;
  }

  /** One page of the detail; limit null = every row (to export). */
  static async getRows<Row extends FinanceRow>(
    query: FinanceQuery,
    limit: number | null,
    offset = 0
  ): Promise<FinanceRowsPage<Row>> {
    // p_limit NULL means "all" in SQL; the generated types do not say so
    const args = {
      p_module: query.module,
      p_start_date: query.start,
      p_end_date: query.end,
      p_organization_id: query.organizationId,
      p_filters: query.filters as Json,
      p_limit: limit,
      p_offset: offset,
    } as unknown as { p_module: string; p_start_date: string; p_end_date: string };
    const { data, error } = await createClient().rpc("get_financial_rows", args);
    if (error) {
      void Logger.error("Error loading financial rows", error);
      throw new Error(rpcError(error.message));
    }
    return data as unknown as FinanceRowsPage<Row>;
  }
}
