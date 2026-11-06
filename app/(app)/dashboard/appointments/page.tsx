"use client";

import { TermsSheet } from "@/components/appointments/AppointmentTerms";
import type { DepositAction } from "@/utils/deposit";
import { PAYMENT_STATUS_LABEL } from "@/utils/payment";
import { ApptRow } from "@/components/appointments/ApptRow";
import { CancelAppointmentSheet } from "@/components/appointments/CancelAppointmentSheet";
import {
  AppointmentCreateModal,
  AppointmentDetailModal,
} from "@/components/appointments/AppointmentModal";
import { AppointmentRescheduleSheet } from "@/components/appointments/AppointmentRescheduleSheet";
import { PageMetadata } from "@/components/page-metadata";
import { ProtectedRoute } from "@/components/protected-route";
import {
  Alert,
  Button,
  ConfirmSheet,
  EmptyState,
  FilterChips,
  ListGroup,
  LoadingRegion,
  PageHeader,
  SearchInput,
  SectionLabel,
  SegmentedControl,
  Spinner,
} from "@/components/ui";
import { CalendarSkeleton } from "@/components/ui/skeleton";
import {
  APPOINTMENT_SOURCE,
  APPOINTMENT_STATUS,
} from "@/config/constants";
import { useAuth } from "@/contexts/auth-context";
import {
  useAppointmentsQuery,
  useCreateAppointment,
  useCreateCustomer,
  useDebounce,
  useInfiniteAppointments,
  useNormalizedData,
  useRescheduleAppointment,
  useToast,
  useSetAppointmentDeposit,
  useSetAppointmentTerms,
  useUpdateAppointmentStatus,
  useBusinessSettings,
} from "@/hooks";
import { AppointmentService } from "@/services";
import {
  AppointmentFormData,
  AppointmentStatus,
  AppointmentWithDetails,
  CustomerFormData,
} from "@/types/appointments";
import type { CancellationCategory } from "@/utils/cancellation";
import { downloadCsv } from "@/utils/csv";
import { DEFAULT_HOUR_RANGE } from "@/utils/calendar-hours";
import { getLocalDateString } from "@/utils/date";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCreateParam } from "@/hooks/useCreateParam";
import { useOpenParam } from "@/hooks/useOpenParam";

const DayCalendar = dynamic(
  () =>
    import("@/components/calendar").then((mod) => ({ default: mod.DayCalendar })),
  { loading: () => <CalendarSkeleton />, ssr: false }
);

const WeekCalendar = dynamic(
  () =>
    import("@/components/calendar").then((mod) => ({ default: mod.WeekCalendar })),
  { loading: () => <CalendarSkeleton />, ssr: false }
);

type AppointmentView = "list" | "day" | "week";
type FilterGroup = "all" | "upcoming" | "in_progress" | "done" | "cancelled";

/** The statuses behind each filter chip; "all" filters nothing. */
const FILTER_GROUPS: {
  value: FilterGroup;
  label: string;
  statuses: AppointmentStatus[];
}[] = [
  { value: "all", label: "Todos", statuses: [] },
  {
    value: "upcoming",
    label: "Por atender",
    statuses: [
      "pending",
      "confirmed",
      "reminded",
      "client_confirmed",
      "checked_in",
    ],
  },
  { value: "in_progress", label: "En curso", statuses: ["in_progress"] },
  { value: "done", label: "Terminados", statuses: ["completed"] },
  { value: "cancelled", label: "Cancelados", statuses: ["cancelled", "no_show"] },
];

function groupStatuses(group: FilterGroup): AppointmentStatus[] {
  return FILTER_GROUPS.find((g) => g.value === group)?.statuses ?? [];
}

/** Monday to Sunday of the week that holds `date`. */
function weekOf(date: Date): Date[] {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const VIEW_OPTIONS: { value: AppointmentView; label: string }[] = [
  { value: "list", label: "Lista" },
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
];

// Only appointments that haven't started can be moved to another time
const RESCHEDULABLE: readonly string[] = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.REMINDED,
  APPOINTMENT_STATUS.CLIENT_CONFIRMED,
];

/** "No vino" only makes sense once the appointment's start time has passed. */
function hasStarted(a: AppointmentWithDetails): boolean {
  return new Date(`${a.appointment_date}T${a.start_time}`) <= new Date();
}

function AppointmentsContent() {
  const { profile } = useAuth();
  const router = useRouter();

  /* ── State ────────────────────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterGroup, setFilterGroup] = useState<FilterGroup>("all");
  // The search replaces the day strip and looks beyond the selected day
  const [searchOpen, setSearchOpen] = useState(false);
  /** Professional id of the signed-in employee while "Mis turnos" is on. */
  const [onlyMineStaffId, setOnlyMineStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<AppointmentView>("list");
  // Hours the business chose for the Day/Week grid (Ajustes); 8-20 until loaded
  const { data: businessSettings } = useBusinessSettings();
  const calendarStartHour =
    businessSettings?.calendar_start_hour ?? DEFAULT_HOUR_RANGE[0];
  const calendarEndHour =
    businessSettings?.calendar_end_hour ?? DEFAULT_HOUR_RANGE[1];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  // Cancel and no-show notify the customer and can't be undone: confirm first
  const [pendingTerminal, setPendingTerminal] = useState<
    "cancelled" | "no_show" | null
  >(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithDetails | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const toast = useToast();

  const [newCustomerData, setNewCustomerData] = useState<CustomerFormData>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
    is_active: true,
  });

  const [formData, setFormData] = useState<AppointmentFormData>({
    customer_id: "",
    service_id: "",
    staff_id: null,
    appointment_date: getLocalDateString(),
    start_time: "09:00",
    end_time: "09:30",
    status: APPOINTMENT_STATUS.CONFIRMED,
    source: APPOINTMENT_SOURCE.ADMIN,
    notes: "",
  });

  /* ── Permissions ─────────────────────────────────────────── */
  const canManageAppointments = useMemo(
    () =>
      profile?.role === "admin" ||
      profile?.role === "owner" ||
      profile?.role === "staff",
    [profile]
  );

  /* ── Date range based on view ────────────────────────────── */
  const dateRange = useMemo(() => {
    // Searching the list looks from last week to two months ahead; without a
    // search the list shows the selected day, like the Day view
    if (view === "list" && searchOpen) {
      const past = new Date(selectedDate);
      past.setDate(past.getDate() - 7);
      const future = new Date(selectedDate);
      future.setDate(future.getDate() + 60);
      return {
        start: getLocalDateString(past),
        end: getLocalDateString(future),
      };
    }
    // Vista Semana: semana que contiene selectedDate
    if (view === "week") {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
      return { start: getLocalDateString(start), end: getLocalDateString(end) };
    }
    // Vista Día: solo el día seleccionado
    return {
      start: getLocalDateString(selectedDate),
      end: getLocalDateString(selectedDate),
    };
  }, [selectedDate, view, searchOpen]);

  /* ── Data queries ────────────────────────────────────────── */
  const {
    data: appointmentsData,
    fetchNextPage: fetchNextAppointmentsPage,
    hasNextPage: hasNextAppointmentsPage,
    isFetchingNextPage: isFetchingNextAppointmentsPage,
    isFetching: appointmentsFetching,
    isPlaceholderData: appointmentsStale,
    isLoading: appointmentsLoading,
    error: appointmentsError,
  } = useInfiniteAppointments(
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
      // The list filters on the server, so a match beyond the first page is
      // found too; the calendars always show everything
      ...(view === "list" && {
        status: filterGroup !== "all" ? groupStatuses(filterGroup) : undefined,
        search: (searchOpen && debouncedSearch) || undefined,
        staffId: onlyMineStaffId ?? undefined,
      }),
    },
    50
  );

  const appointments = useMemo(
    () => appointmentsData?.pages.flat() ?? [],
    [appointmentsData]
  );

  // The visible week, unfiltered: marks the days that have turns and counts
  // the selected day per filter chip
  const weekDays = useMemo(() => weekOf(selectedDate), [selectedDate]);
  const { appointments: weekAppointments } = useAppointmentsQuery({
    startDate: getLocalDateString(weekDays[0]),
    endDate: getLocalDateString(weekDays[6]),
    staffId: onlyMineStaffId ?? undefined,
  });
  const selectedDay = getLocalDateString(selectedDate);
  const daysWithTurns = useMemo(
    () => new Set(weekAppointments.map((a) => a.appointment_date)),
    [weekAppointments]
  );
  const dayAppointments = useMemo(
    () => weekAppointments.filter((a) => a.appointment_date === selectedDay),
    [weekAppointments, selectedDay]
  );
  const filterChips = useMemo(
    () =>
      FILTER_GROUPS.map(({ value, label, statuses }) => ({
        value,
        label,
        // Counts are of the selected day; a search spans many days
        count: searchOpen
          ? undefined
          : value === "all"
            ? dayAppointments.length
            : dayAppointments.filter(
                (a) => !!a.status && statuses.includes(a.status)
              ).length,
      })),
    [dayAppointments, searchOpen]
  );

  const normalizedData = useNormalizedData({
    includeAppointments: false,
    // Only the create form uses them: no full customer download per visit
    // (P2-06)
    includeCustomers: showCreateModal,
    customerFilters: { isActive: true },
    serviceFilters: { isActive: true },
    staffFilters: { isActive: true, isBookable: true },
  });

  const customers = normalizedData.customers;
  const services = normalizedData.services;
  const staffMembers = normalizedData.staff;
  // The professional this account is linked to (set by the owner in Profesionales)
  const myStaffId = useMemo(
    () =>
      staffMembers.find(
        (member) => !!member.user_id && member.user_id === profile?.user_id
      )?.id ?? null,
    [staffMembers, profile?.user_id]
  );

  const createAppointmentMutation = useCreateAppointment();
  const updateAppointmentStatusMutation = useUpdateAppointmentStatus();
  const setDepositMutation = useSetAppointmentDeposit();
  const setTermsMutation = useSetAppointmentTerms();
  const [showTerms, setShowTerms] = useState(false);
  const rescheduleMutation = useRescheduleAppointment();
  const createCustomerMutation = useCreateCustomer();

  // Customers load with the create form, which handles its own empty state
  const loading =
    appointmentsLoading ||
    normalizedData.servicesLoading ||
    normalizedData.staffLoading;
  const error =
    appointmentsError?.message || normalizedData.error || localError;

  /* ── Export CSV ──────────────────────────────────────────── */
  const handleExportCsv = useCallback(async () => {
    if (!profile?.organization_id) return;
    const result = await AppointmentService.getByDateRange(
      profile.organization_id,
      dateRange.start,
      dateRange.end
    );
    if (!result.success || !result.appointments) {
      toast.error("Error al exportar", result.error ?? undefined);
      return;
    }
    if (result.appointments.length === 0) {
      toast.info("Nada para exportar", "No hay turnos en el rango visible");
      return;
    }
    downloadCsv(
      `turnos_${dateRange.start}_a_${dateRange.end}`,
      [
        "Fecha",
        "Hora",
        "Cliente",
        "Teléfono",
        "Servicio",
        "Profesional",
        "Estado",
        "Precio",
        "Pagado",
        "Importe pagado",
        "Pendiente",
        "Estado del pago",
        "Origen",
        "N°",
      ],
      result.appointments.map((a) => [
        a.appointment_date,
        a.start_time?.slice(0, 5),
        `${a.customer_first_name} ${a.customer_last_name}`.trim(),
        a.customer_phone,
        a.service_name,
        [a.staff_first_name, a.staff_last_name].filter(Boolean).join(" "),
        a.status,
        a.price_charged ?? a.service_price ?? "",
        a.was_paid ? "Sí" : "No",
        a.amount_paid ?? 0,
        a.amount_pending ?? "",
        PAYMENT_STATUS_LABEL[a.payment_status ?? "unpaid"],
        a.source ?? "",
        a.appointment_number ?? "",
      ])
    );
    toast.success(
      "CSV exportado",
      `${result.appointments.length} turnos descargados`
    );
  }, [profile?.organization_id, dateRange.start, dateRange.end, toast]);

  /* ── Helpers ─────────────────────────────────────────────── */
  const calculateEndTime = useCallback(
    (startTime: string, serviceId: string) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return startTime;
      return AppointmentService.calculateEndTime(startTime, service);
    },
    [services]
  );

  const handleServiceChange = useCallback(
    (serviceId: string) => {
      const service = services.find((s) => s.id === serviceId);
      setFormData((prev) => ({
        ...prev,
        service_id: serviceId,
        end_time: calculateEndTime(prev.start_time, serviceId),
        // The conditions of the service, editable for this appointment (TUR0007)
        price_charged: null,
        deposit_type:
          service?.deposit_type === "fixed" || service?.deposit_type === "percent"
            ? service.deposit_type
            : null,
        deposit_value: service?.deposit_value ?? null,
        deposit_due_at: null,
        payment_terms: service?.payment_terms ?? null,
        deposit_status: undefined,
        deposit_waived: false,
      }));
    },
    [calculateEndTime, services]
  );

  const handleStartTimeChange = useCallback(
    (startTime: string) => {
      setFormData((prev) => ({
        ...prev,
        start_time: startTime,
        end_time: calculateEndTime(startTime, prev.service_id),
      }));
    },
    [calculateEndTime]
  );

  const patchFormData = useCallback((patch: Partial<AppointmentFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchNewCustomer = useCallback((patch: Partial<CustomerFormData>) => {
    setNewCustomerData((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      customer_id: "",
      service_id: "",
      staff_id: null,
      appointment_date: getLocalDateString(),
      start_time: "09:00",
      end_time: "09:30",
      status: APPOINTMENT_STATUS.CONFIRMED,
      source: APPOINTMENT_SOURCE.ADMIN,
      notes: "",
    });
    setShowNewCustomerForm(false);
    setNewCustomerData({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      notes: "",
      is_active: true,
    });
  }, []);

  /* ── Handlers ────────────────────────────────────────────── */
  const handleCreate = useCallback(() => {
    if (!canManageAppointments) {
      setLocalError("No tienes permisos para crear turnos");
      return;
    }
    resetForm();
    setShowCreateModal(true);
  }, [canManageAppointments, resetForm]);

  useCreateParam(handleCreate, !!profile);

  const savingRef = useRef(false);
  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canManageAppointments) {
        toast.error("Sin permisos", "No tienes permisos para crear turnos");
        return;
      }
      // A second tap while the first save is in flight would create a duplicate.
      if (savingRef.current) return;
      savingRef.current = true;
      const loadingToast = toast.loading("Creando turno...");
      try {
        await createAppointmentMutation.mutateAsync(formData);
        toast.dismiss(loadingToast);
        toast.success("Turno creado", "El turno fue agendado correctamente");
        setShowCreateModal(false);
        resetForm();
      } catch (err) {
        toast.dismiss(loadingToast);
        if (err instanceof Error) {
          if (err.message.includes("Validación fallida")) {
            toast.validationError(err.message);
          } else {
            toast.error("Error al crear turno", err.message);
          }
        } else {
          toast.error("Error inesperado", "No se pudo crear el turno");
        }
      } finally {
        savingRef.current = false;
      }
    },
    [canManageAppointments, formData, createAppointmentMutation, toast, resetForm]
  );

  const handleCreateCustomer = useCallback(async () => {
    const loadingToast = toast.loading("Creando cliente...");
    try {
      const customer = await createCustomerMutation.mutateAsync(newCustomerData);
      if (!customer?.id) throw new Error("Cliente retornado inválido");

      setFormData((prev) => ({ ...prev, customer_id: customer.id }));
      setNewCustomerData({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        notes: "",
        is_active: true,
      });
      setShowNewCustomerForm(false);
      toast.dismiss(loadingToast);
      toast.success(
        "Cliente creado",
        `${newCustomerData.first_name} ${newCustomerData.last_name} fue agregado`
      );
    } catch (err) {
      toast.dismiss(loadingToast);
      if (err instanceof Error) {
        if (err.message.includes("Validación fallida")) {
          toast.validationError(err.message);
        } else {
          toast.error("Error al crear cliente", err.message);
        }
      } else {
        toast.error("Error inesperado", "No se pudo crear el cliente");
      }
    }
  }, [newCustomerData, createCustomerMutation, toast]);

  const updateStatus = useCallback(
    async (
      appointmentId: string,
      newStatus: AppointmentStatus,
      cancel?: { category: CancellationCategory; reason?: string }
    ) => {
      if (!newStatus) {
        toast.error("Error", "El estado no puede estar vacío");
        return;
      }
      const loadingToast = toast.loading("Actualizando estado...");
      try {
        await updateAppointmentStatusMutation.mutateAsync({
          appointmentId,
          newStatus,
          reason: cancel?.reason,
          cancellationCategory: cancel?.category,
        });
        toast.dismiss(loadingToast);
        toast.success("Estado actualizado", "El turno fue actualizado");
        if (selectedAppointment?.id === appointmentId) {
          setSelectedAppointment({
            ...selectedAppointment,
            status: newStatus,
            ...(cancel && {
              cancellation_category: cancel.category,
              cancellation_reason: cancel.reason ?? null,
              cancelled_at: new Date().toISOString(),
              cancelled_by: profile?.user_id ?? null,
            }),
          });
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        if (err instanceof Error) {
          toast.error("Error al actualizar estado", err.message);
        } else {
          toast.error("Error inesperado", "No se pudo actualizar el estado");
        }
        setLocalError("Error al actualizar estado");
      }
    },
    [updateAppointmentStatusMutation, toast, selectedAppointment, profile?.user_id]
  );

  /** Verify, waive or refund the deposit of the open appointment. */
  const handleDeposit = useCallback(
    async (action: DepositAction) => {
      if (!selectedAppointment) return;
      try {
        await setDepositMutation.mutateAsync({
          appointmentId: selectedAppointment.id,
          action,
        });
        const confirmed =
          selectedAppointment.status === "pending" && action !== "refund"
            ? "confirmed"
            : selectedAppointment.status;
        setSelectedAppointment({
          ...selectedAppointment,
          status: confirmed,
          ...(action === "verify" && {
            deposit_status: "verified",
            deposit_verified_by: profile?.user_id ?? null,
            deposit_verified_at: new Date().toISOString(),
          }),
          ...(action === "waive" && {
            deposit_amount: null,
            deposit_status: null,
            deposit_waived: true,
          }),
          ...(action === "refund" && { deposit_status: "refunded" }),
        });
        toast.success(
          action === "verify"
            ? "Anticipo recibido"
            : action === "waive"
              ? "Anticipo perdonado"
              : "Anticipo devuelto",
          action === "refund" ? undefined : "El turno quedó confirmado"
        );
      } catch (err) {
        toast.error(
          "No se pudo guardar el anticipo",
          err instanceof Error ? err.message : undefined
        );
      }
    },
    [selectedAppointment, setDepositMutation, profile?.user_id, toast]
  );

  /* ── List filtering / grouping ───────────────────────────── */
  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (filterGroup !== "all") {
      const statuses = groupStatuses(filterGroup);
      list = list.filter((a) => !!a.status && statuses.includes(a.status));
    }
    if (onlyMineStaffId) {
      list = list.filter((a) => a.staff_id === onlyMineStaffId);
    }
    if (searchOpen && debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.customer_first_name.toLowerCase().includes(term) ||
          a.customer_last_name.toLowerCase().includes(term) ||
          a.customer_phone.includes(term) ||
          a.service_name.toLowerCase().includes(term) ||
          (a.staff_first_name &&
            a.staff_first_name.toLowerCase().includes(term))
      );
    }
    // Sort by date asc, then start_time asc
    return [...list].sort((a, b) => {
      if (a.appointment_date !== b.appointment_date) {
        return a.appointment_date < b.appointment_date ? -1 : 1;
      }
      return a.start_time.localeCompare(b.start_time);
    });
  }, [appointments, filterGroup, searchOpen, debouncedSearch, onlyMineStaffId]);

  const grouped = useMemo(() => {
    // Group by date, then morning/afternoon
    const byDate = new Map<string, AppointmentWithDetails[]>();
    filteredAppointments.forEach((a) => {
      const arr = byDate.get(a.appointment_date) ?? [];
      arr.push(a);
      byDate.set(a.appointment_date, arr);
    });
    const sections: {
      date: string;
      morning: AppointmentWithDetails[];
      afternoon: AppointmentWithDetails[];
    }[] = [];
    Array.from(byDate.keys())
      .sort()
      .forEach((date) => {
        const all = byDate.get(date)!;
        const morning = all.filter((a) => parseInt(a.start_time, 10) < 13);
        const afternoon = all.filter((a) => parseInt(a.start_time, 10) >= 13);
        sections.push({ date, morning, afternoon });
      });
    return sections;
  }, [filteredAppointments]);

  /* ── Calendar handlers ───────────────────────────────────── */
  const handleAppointmentClick = useCallback((apt: AppointmentWithDetails) => {
    setSelectedAppointment(apt);
    setShowDetailModal(true);
  }, []);

  // A row of Finanzas opens its appointment here
  const handleOpenParam = useCallback(
    (id: string) => {
      void AppointmentService.getWithDetails(id).then((apt) => {
        if (apt) handleAppointmentClick(apt);
      });
    },
    [handleAppointmentClick]
  );
  useOpenParam(handleOpenParam, !!profile);

  const handleDayTimeSlotClick = useCallback(
    (time: string) => {
      setFormData((prev) => ({
        ...prev,
        appointment_date: getLocalDateString(selectedDate),
        start_time: time,
        end_time: calculateEndTime(time, prev.service_id),
      }));
      setShowCreateModal(true);
    },
    [selectedDate, calculateEndTime]
  );

  const handleWeekTimeSlotClick = useCallback(
    (date: string, time: string) => {
      setFormData((prev) => ({
        ...prev,
        appointment_date: date,
        start_time: time,
        end_time: calculateEndTime(time, prev.service_id),
      }));
      setShowCreateModal(true);
    },
    [calculateEndTime]
  );

  /* ── Detail-modal helpers ────────────────────────────────── */
  const detailServiceColor = useMemo(() => {
    if (!selectedAppointment) return null;
    return (
      services.find((s) => s.id === selectedAppointment.service_id)?.color ??
      null
    );
  }, [selectedAppointment, services]);

  const detailStaffColor = useMemo(() => {
    if (!selectedAppointment?.staff_id) return null;
    return (
      staffMembers.find((s) => s.id === selectedAppointment.staff_id)?.color ??
      null
    );
  }, [selectedAppointment, staffMembers]);

  /* ── Org guard ───────────────────────────────────────────── */
  if (!profile?.organization_id) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-warning-500" />
            <h1 className="mt-4 text-2xl font-semibold text-foreground">
              Sin Organización
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Necesitas pertenecer a una organización para gestionar turnos
            </p>
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard")}
              className="mt-4"
            >
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center justify-center text-center">
            <Spinner className="mb-3 text-foreground" />
            <p className="text-meta text-foreground-muted">Cargando turnos...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const isTodaySelected = selectedDay === getLocalDateString();
  const dayTotal = dayAppointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "no_show"
  ).length;
  const dayDone = dayAppointments.filter(
    (a) => a.status === "completed"
  ).length;
  const subtitle =
    view === "week"
      ? `Semana · ${appointments.length} turno${
          appointments.length !== 1 ? "s" : ""
        }`
      : view === "list" && searchOpen
        ? `${appointments.length} encontrado${appointments.length !== 1 ? "s" : ""}`
        : `${dayTotal} ${
            isTodaySelected ? "hoy" : dayTotal === 1 ? "turno" : "turnos"
          } · ${dayDone} ${dayDone === 1 ? "terminado" : "terminados"}`;
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm("");
  };
  const shiftWeek = (weeks: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + weeks * 7);
    setSelectedDate(next);
  };
  // The previous range stays on screen while the new one loads
  const refreshing = appointmentsFetching && !isFetchingNextAppointmentsPage;

  return (
    <ProtectedRoute>
      <PageMetadata
        title="Turnos"
        description="Gestiona tus turnos y citas. Visualiza tu calendario, crea nuevas citas, confirma o cancela reservas existentes."
      />

      <div className="mx-auto max-w-5xl px-5 pb-10 pt-4 lg:px-8 lg:pt-8">
        <PageHeader
          title="Turnos"
          subtitle={
            <>
              {subtitle}
              {refreshing && " · Actualizando…"}
            </>
          }
          actions={
            <>
              <SegmentedControl
                label="Vista"
                options={VIEW_OPTIONS}
                value={view}
                onChange={setView}
              />
              <Button
                variant="secondary"
                onClick={handleExportCsv}
                title="Exportar turnos del rango visible a CSV"
                className="max-lg:hidden"
              >
                <Download className="size-[18px]" />
                CSV
              </Button>
              {canManageAppointments && (
                <Button onClick={handleCreate} className="max-lg:hidden">
                  <Plus className="size-[18px]" />
                  Nuevo turno
                </Button>
              )}
            </>
          }
        >
          {view === "list" && searchOpen ? (
            <div className="flex items-center gap-2">
              <SearchInput
                autoFocus
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Cliente, servicio o teléfono"
                aria-label="Buscar turnos"
                wrapperClassName="min-w-0 flex-1"
              />
              <Button variant="ghost" onClick={closeSearch}>
                Cancelar
              </Button>
            </div>
          ) : (
            view !== "week" && (
              <div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => shiftWeek(-1)}
                    aria-label="Semana anterior"
                    className="-ml-2"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <span className="flex-1 text-center text-meta font-semibold text-foreground-muted first-letter:uppercase">
                    {selectedDate.toLocaleDateString("es", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  {!isTodaySelected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      Hoy
                    </Button>
                  )}
                  {view === "list" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchOpen(true)}
                      aria-label="Buscar turnos"
                    >
                      <Search className="size-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => shiftWeek(1)}
                    aria-label="Semana siguiente"
                    className="-mr-2"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </div>
                <div className="-mx-1 mt-1 grid grid-cols-7 gap-1">
                  {weekDays.map((day) => {
                    const key = getLocalDateString(day);
                    const selected = key === selectedDay;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDate(day)}
                        aria-pressed={selected}
                        aria-label={day.toLocaleDateString("es", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-[14px] pb-2.5 pt-2 transition-colors ${
                          selected
                            ? "bg-inverse text-inverse-foreground"
                            : "text-foreground hover:bg-surface-2"
                        }`}
                      >
                        <span className="text-[11px] font-medium capitalize opacity-75">
                          {day
                            .toLocaleDateString("es", { weekday: "short" })
                            .replace(".", "")}
                        </span>
                        <span className="text-[17px] font-semibold tabular-nums">
                          {day.getDate()}
                        </span>
                        <span
                          aria-hidden
                          className={`size-1 rounded-full ${
                            !daysWithTurns.has(key)
                              ? "bg-transparent"
                              : selected
                                ? "bg-inverse-foreground"
                                : "bg-border-2"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}
          {view === "list" && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {myStaffId && (
                <button
                  type="button"
                  onClick={() =>
                    setOnlyMineStaffId(onlyMineStaffId ? null : myStaffId)
                  }
                  aria-pressed={!!onlyMineStaffId}
                  className={`flex h-9 shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-meta font-semibold transition-colors ${
                    onlyMineStaffId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-2 bg-surface text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Mis turnos
                </button>
              )}
              <FilterChips
                label="Estado"
                chips={filterChips}
                value={filterGroup}
                onChange={setFilterGroup}
                className="overflow-visible"
              />
            </div>
          )}
        </PageHeader>

        {/* Body */}
        <LoadingRegion busy={appointmentsStale} className="pt-4">
          {error && (
            <Alert variant="danger" icon={<AlertCircle />} className="mb-4">
              {error}
            </Alert>
          )}

          {/* List view */}
          {view === "list" && (
            <>
              {filteredAppointments.length === 0 ? (
                <EmptyListState
                  hasFilters={searchOpen || filterGroup !== "all"}
                  canManage={canManageAppointments}
                  onCreate={handleCreate}
                />
              ) : (
                <div>
                  {grouped.map((section) => (
                    <section key={section.date}>
                      {/* One day at a time needs no date; a search spans several */}
                      {searchOpen && (
                        <h2 className="px-1 pt-5 text-lead font-semibold text-foreground">
                          {formatSectionDate(section.date)}
                        </h2>
                      )}
                      {(
                        [
                          ["Mañana", section.morning],
                          ["Tarde", section.afternoon],
                        ] as const
                      ).map(
                        ([label, rows]) =>
                          rows.length > 0 && (
                            <div key={label}>
                              <SectionLabel
                                count={rows.length}
                                className={searchOpen ? "!pt-3" : "!pt-[22px]"}
                              >
                                {label}
                              </SectionLabel>
                              <ListGroup>
                                {rows.map((a) => (
                                  <ApptRow
                                    key={a.id}
                                    appointment={a}
                                    onOpen={handleAppointmentClick}
                                    serviceColor={
                                      services.find(
                                        (s) => s.id === a.service_id
                                      )?.color ?? null
                                    }
                                  />
                                ))}
                              </ListGroup>
                            </div>
                          )
                      )}
                    </section>
                  ))}
                </div>
              )}

              {hasNextAppointmentsPage && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => fetchNextAppointmentsPage()}
                    disabled={isFetchingNextAppointmentsPage}
                  >
                    {isFetchingNextAppointmentsPage
                      ? "Cargando…"
                      : `Cargar más (${filteredAppointments.length})`}
                  </Button>
                </div>
              )}
            </>
          )}

          {view === "day" && (
            <DayCalendar
              date={selectedDate}
              // The status filter and search only show in the List view
              appointments={appointments}
              onDateChange={setSelectedDate}
              onAppointmentClick={handleAppointmentClick}
              onTimeSlotClick={
                canManageAppointments ? handleDayTimeSlotClick : undefined
              }
              startHour={calendarStartHour}
              endHour={calendarEndHour}
            />
          )}

          {view === "week" && (
            <WeekCalendar
              date={selectedDate}
              appointments={appointments}
              onDateChange={setSelectedDate}
              onAppointmentClick={handleAppointmentClick}
              onTimeSlotClick={
                canManageAppointments ? handleWeekTimeSlotClick : undefined
              }
              startHour={calendarStartHour}
              endHour={calendarEndHour}
            />
          )}
        </LoadingRegion>
      </div>

      {/* Create modal */}
      <AppointmentCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        formData={formData}
        onChange={patchFormData}
        onServiceChange={handleServiceChange}
        onStartTimeChange={handleStartTimeChange}
        onSubmit={handleSave}
        isSubmitting={createAppointmentMutation.isPending}
        customers={customers}
        customersLoading={normalizedData.customersLoading}
        services={services}
        staff={staffMembers}
        showNewCustomerForm={showNewCustomerForm}
        onToggleNewCustomerForm={() => setShowNewCustomerForm((v) => !v)}
        newCustomerData={newCustomerData}
        onChangeNewCustomer={patchNewCustomer}
        onCreateCustomer={handleCreateCustomer}
        isCreatingCustomer={createCustomerMutation.isPending}
      />

      {/* Detail modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          serviceColor={detailServiceColor}
          staffColor={detailStaffColor}
          onAdvance={(to) => updateStatus(selectedAppointment.id, to)}
          onDeposit={handleDeposit}
          isDepositBusy={setDepositMutation.isPending}
          onAppointmentChange={setSelectedAppointment}
          onEditTerms={() => setShowTerms(true)}
          onEdit={
            canManageAppointments &&
            RESCHEDULABLE.includes(selectedAppointment.status ?? "")
              ? () => {
                  setShowDetailModal(false);
                  setShowReschedule(true);
                }
              : undefined
          }
          onMarkNoShow={
            hasStarted(selectedAppointment)
              ? () => setPendingTerminal("no_show")
              : undefined
          }
          onCancel={() => setPendingTerminal("cancelled")}
          isProcessing={updateAppointmentStatusMutation.isPending}
        />
      )}

      {selectedAppointment && showTerms && (
        <TermsSheet
          open={showTerms}
          onClose={() => setShowTerms(false)}
          appointment={selectedAppointment}
          busy={setTermsMutation.isPending}
          onSave={async (terms) => {
            try {
              const fresh = await setTermsMutation.mutateAsync({
                appointmentId: selectedAppointment.id,
                terms,
              });
              if (fresh) setSelectedAppointment(fresh);
              setShowTerms(false);
              toast.success("Condiciones guardadas");
            } catch (err) {
              toast.error(
                "No se pudieron guardar",
                err instanceof Error ? err.message : undefined
              );
            }
          }}
        />
      )}

      <ConfirmSheet
        open={pendingTerminal === "no_show" && !!selectedAppointment}
        onClose={() => setPendingTerminal(null)}
        onConfirm={async () => {
          if (!selectedAppointment) return;
          await updateStatus(selectedAppointment.id, "no_show");
          setPendingTerminal(null);
        }}
        title="Marcar que no vino"
        confirmLabel="No vino"
        busyLabel="Guardando…"
        busy={updateAppointmentStatusMutation.isPending}
      >
        <p className="text-sm text-foreground-muted">
          El turno queda marcado como no asistió. No se puede deshacer.
        </p>
      </ConfirmSheet>

      <CancelAppointmentSheet
        open={pendingTerminal === "cancelled" && !!selectedAppointment}
        onClose={() => setPendingTerminal(null)}
        onConfirm={async (category, reason) => {
          if (!selectedAppointment) return;
          await updateStatus(selectedAppointment.id, "cancelled", { category, reason });
          setPendingTerminal(null);
        }}
        busy={updateAppointmentStatusMutation.isPending}
      />

      {selectedAppointment && showReschedule && (
        <AppointmentRescheduleSheet
          open={showReschedule}
          onClose={() => {
            setShowReschedule(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          staff={staffMembers}
          isSubmitting={rescheduleMutation.isPending}
          onSubmit={async (input) => {
            try {
              await rescheduleMutation.mutateAsync({
                appointmentId: selectedAppointment.id,
                ...input,
              });
              toast.success("Turno movido", "Le pedimos al cliente que confirme");
              setShowReschedule(false);
              setSelectedAppointment(null);
            } catch (err) {
              toast.error(
                "No se pudo mover el turno",
                err instanceof Error ? err.message : undefined
              );
            }
          }}
        />
      )}
    </ProtectedRoute>
  );
}

/* ────────────────────────────────────────────────────────── */
function EmptyListState({
  hasFilters,
  canManage,
  onCreate,
}: {
  hasFilters: boolean;
  canManage: boolean;
  onCreate: () => void;
}) {
  return (
    <EmptyState
      icon={<Calendar />}
      title={hasFilters ? "Sin turnos" : "Sin turnos este día"}
      action={
        canManage &&
        !hasFilters && (
          <Button size="sm" variant="secondary" onClick={onCreate}>
            <Plus className="size-4" />
            Crear turno
          </Button>
        )
      }
    >
      {hasFilters
        ? "No encontramos turnos con esos filtros."
        : "Cuando crees un turno para este día aparecerá aquí."}
    </EmptyState>
  );
}

function formatSectionDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const label = dateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const today = getLocalDateString();
  if (date === today) return `Hoy, ${label}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === getLocalDateString(tomorrow)) return `Mañana, ${label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <div className="flex min-h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center text-center">
              <Spinner className="mb-3 text-foreground" />
              <p className="text-meta text-foreground-muted">Cargando turnos...</p>
            </div>
          </div>
        </ProtectedRoute>
      }
    >
      <AppointmentsContent />
    </Suspense>
  );
}
