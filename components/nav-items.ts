import type { OrganizationModules } from "@/hooks/useOrganizationModules.query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Bus,
  Calendar,
  CircleHelp,
  Crown,
  House,
  type LucideIcon,
  Package,
  Settings,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  Icon: LucideIcon;
  roles?: string[];
  requiresOrg?: boolean;
  /** Only shown when the organization has this module enabled (PRP-002). */
  module?: "appointments" | "trips";
}

export interface NavGroup {
  key: string;
  /** No label: the main destinations, which the mobile tab bar also holds. */
  label?: string;
  items: NavItem[];
}

/** Shared by the desktop Sidebar and the mobile MoreSheet. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: "main",
    items: [
      { name: "Inicio", href: "/dashboard", Icon: House },
      {
        name: "Turnos",
        href: "/dashboard/appointments",
        Icon: Calendar,
        requiresOrg: true,
        module: "appointments",
      },
      {
        name: "Viajes",
        href: "/dashboard/trips",
        Icon: Bus,
        requiresOrg: true,
        module: "trips",
      },
      {
        name: "Clientes",
        href: "/dashboard/customers",
        Icon: Users,
        requiresOrg: true,
      },
    ],
  },
  {
    key: "business",
    label: "Negocio",
    items: [
      {
        name: "Servicios",
        href: "/dashboard/services",
        Icon: Package,
        roles: ["admin", "owner"],
        requiresOrg: true,
        module: "appointments",
      },
      {
        name: "Profesionales",
        href: "/dashboard/staff",
        Icon: UserCog,
        roles: ["admin", "owner"],
        requiresOrg: true,
        module: "appointments",
      },
      {
        name: "Recordatorios",
        href: "/dashboard/reminders",
        Icon: Bell,
        requiresOrg: true,
        module: "appointments",
      },
      {
        name: "Reportes",
        href: "/dashboard/reports",
        Icon: BarChart3,
        roles: ["admin", "owner"],
        requiresOrg: true,
        module: "appointments",
      },
      {
        // Both modules have money: no module filter, the page shows a tab per module
        name: "Finanzas",
        href: "/dashboard/finances",
        Icon: Wallet,
        roles: ["admin", "owner"],
        requiresOrg: true,
      },
      {
        name: "Ajustes",
        href: "/dashboard/settings",
        Icon: Settings,
        roles: ["admin", "owner"],
        requiresOrg: true,
      },
      {
        name: "Suscripción",
        href: "/dashboard/subscription",
        Icon: Crown,
        roles: ["admin", "owner"],
        requiresOrg: true,
      },
      {
        name: "Invitar",
        href: "/dashboard/invite",
        Icon: UserPlus,
        roles: ["admin", "owner"],
      },
    ],
  },
  {
    key: "platform",
    label: "Plataforma",
    items: [
      {
        name: "Plataforma",
        href: "/dashboard/platform",
        Icon: Activity,
        roles: ["admin"],
      },
      {
        name: "Organizaciones",
        href: "/dashboard/organizations",
        Icon: Building2,
        roles: ["admin"],
      },
      {
        name: "Usuarios",
        href: "/dashboard/users",
        Icon: Users,
        roles: ["admin"],
      },
      {
        name: "Errores",
        href: "/dashboard/errors",
        Icon: AlertTriangle,
        roles: ["admin"],
      },
    ],
  },
  {
    key: "account",
    label: "Cuenta",
    items: [
      { name: "Mi cuenta", href: "/dashboard/account", Icon: UserCircle },
      { name: "Ayuda", href: "/help", Icon: CircleHelp },
    ],
  },
];

function isItemVisible(
  item: NavItem,
  role?: string,
  hasOrg?: boolean,
  modules?: OrganizationModules
): boolean {
  if (item.roles && item.roles.length > 0 && (!role || !item.roles.includes(role))) {
    return false;
  }
  if (item.requiresOrg && !hasOrg) {
    return false;
  }
  if (item.module && modules && !modules[item.module]) {
    return false;
  }
  return true;
}

/** The groups this user can see, without the ones left empty. */
export function visibleNavGroups(
  role?: string,
  hasOrg?: boolean,
  modules?: OrganizationModules
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      isItemVisible(item, role, hasOrg, modules)
    ),
  })).filter((group) => group.items.length > 0);
}

export function isNavActive(pathname: string, href: string): boolean {
  // Some static hosts serve the route with a trailing slash
  const path = pathname.replace(/\/$/, "");
  if (href === "/dashboard") return path === href;
  return path.startsWith(href);
}
