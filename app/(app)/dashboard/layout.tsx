"use client";

import { FullkodCredit } from "@/components/FullkodCredit";
import { LicenseGate } from "@/components/license-gate";
import { MobileTabBar } from "@/components/MobileTabBar";
import { MobileTopbar } from "@/components/MobileTopbar";
import { MoreSheet } from "@/components/MoreSheet";
import { OfflineBanner } from "@/components/offline-banner";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { useCapacitor } from "@/hooks/useCapacitor";
import { useOrganizationModules } from "@/hooks/useOrganizationModules.query";
import { useRealtimeAll } from "@/hooks/useRealtimeEntities";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Sections that only exist for a business with that module on. */
const MODULE_ROUTES = {
  appointments: [
    "/dashboard/appointments",
    "/dashboard/services",
    "/dashboard/staff",
    "/dashboard/reminders",
    "/dashboard/reports",
  ],
  trips: ["/dashboard/trips"],
} as const;

/**
 * Dashboard layout. Mobile gets a sticky topbar + bottom tab bar, whose
 * "Más" tab opens a sheet; desktop gets a fixed left sidebar. Both share the same nav data and
 * read profile/role from AuthProvider (mounted in the root layout).
 */
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  // Suscribir realtime a todas las tablas operativas core mientras
  // el usuario está dentro del dashboard. Los hooks se auto-deshabilitan
  // si no hay organization_id y se limpian al desmontar.
  useRealtimeAll();

  // A typed or saved link to a section of a module the business does not
  // have goes back to Inicio. Admins are never redirected.
  const pathname = usePathname();
  const router = useRouter();
  // The "Más" sheet is open only on the route it was opened from, so
  // following one of its links closes it without touching history
  const [moreOpenAt, setMoreOpenAt] = useState<string | null>(null);
  const moreOpen = moreOpenAt === pathname;
  const { modules, ready } = useOrganizationModules();
  const blockedByModule =
    ready &&
    !!profile?.organization_id &&
    profile.role !== "admin" &&
    (["appointments", "trips"] as const).some(
      (key) =>
        !modules[key] &&
        MODULE_ROUTES[key].some((route) => pathname.startsWith(route))
    );
  useEffect(() => {
    if (blockedByModule) router.replace("/dashboard");
  }, [blockedByModule, router]);

  // Keeps the native status bar readable in both themes
  useCapacitor();

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Sidebar />
        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpenAt(null)}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
        />
      </div>

      <div className="flex min-h-screen flex-col lg:pl-64 print:block print:min-h-0 print:pl-0">
        <MobileTopbar />
        <OfflineBanner />
        <main className="flex-1">{blockedByModule ? null : children}</main>
        <div className="flex justify-end px-5 pb-5 pt-8 lg:px-8 print:hidden">
          <FullkodCredit />
        </div>
        <MobileTabBar
          moreOpen={moreOpen}
          onMore={() => setMoreOpenAt(pathname)}
        />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <LicenseGate>
        <DashboardContent>{children}</DashboardContent>
      </LicenseGate>
    </ThemeProvider>
  );
}
