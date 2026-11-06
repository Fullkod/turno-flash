/**
 * Hooks Index
 * Centralized exports for all application hooks
 */

// Appointment hooks (React Query powered)
// Export the wrapper version as default for backward compatibility
export { useAppointments, type AppointmentFilters } from "./useAppointments";

// Export individual React Query hooks for new code
export {
  appointmentKeys,
  useAppointmentStatistics,
  useAppointments as useAppointmentsQuery,
  useCheckAvailability,
  useCreateAppointment,
  useDeleteAppointment,
  useInfiniteAppointments,
  useRescheduleAppointment,
  useSendReminder,
  useSetAppointmentDeposit,
  useSetAppointmentTerms,
  useUpdateAppointmentStatus,
} from "./useAppointments.query";
export {
  useAppointmentPayments,
  useRegisterAppointmentPayment,
  useVoidAppointmentPayment,
} from "./useAppointmentPayments.query";

// Customer hooks (React Query powered)
// Export the wrapper version as default for backward compatibility
export { useCustomers, type CustomerFilters } from "./useCustomers";

// Export individual React Query hooks for new code
export {
  customerKeys,
  useCreateCustomer,
  useCustomerById,
  useCustomerStatistics,
  useCustomers as useCustomersQuery,
  useDeactivateCustomer,
  useInfiniteCustomers,
  useReactivateCustomer,
  useUpdateCustomer,
} from "./useCustomers.query";

// Service hooks (React Query powered)
// Export the wrapper version as default for backward compatibility
export { useServices, type ServiceFilters } from "./useServices";

// Export individual React Query hooks for new code
export {
  serviceKeys,
  useCreateService,
  useDeactivateService,
  useReactivateService,
  useDuplicateService,
  useReorderServices,
  useServiceById,
  useServices as useServicesQuery,
  useUpdateService,
} from "./useServices.query";

// Staff hooks (React Query powered)
// Export the wrapper version as default for backward compatibility
export { useStaff, type StaffFilters } from "./useStaff";

// Export individual React Query hooks for new code
export {
  staffKeys,
  useCreateStaffMember,
  useDeactivateStaffMember,
  useReactivateStaffMember,
  useReorderStaff,
  useStaffById,
  useStaff as useStaffQuery,
  useUpdateStaffMember,
} from "./useStaff.query";

// Analytics hooks (React Query powered)
export {
  analyticsKeys,
  useOrganizationAnalytics,
  usePlatformStats,
} from "./useAnalytics.query";

// Business settings hooks (React Query powered)
export {
  businessSettingsKeys,
  useBusinessSettings,
  useUpdateBusinessSettings,
  type BusinessAutomationSettings,
  type BusinessAutomationSettingsPatch,
} from "./useBusinessSettings.query";

// Error logs hooks (React Query powered)
export {
  useErrorLogsQuery,
  useErrorStatsQuery,
  useResolveError,
  useUnresolveError,
  type ErrorLog,
  type ErrorLogsQueryParams,
} from "./useErrorLogs.query";

// Normalized data hook
export {
  useNormalizedData,
  type UseNormalizedDataOptions,
  type UseNormalizedDataReturn,
} from "./useNormalizedData";

// Service category hooks (PRP-004)
export {
  serviceCategoryKeys,
  useCreateServiceCategory,
  useDeleteServiceCategory,
  useReorderServiceCategories,
  useServiceCategories,
  useUpdateServiceCategory,
} from "./useServiceCategories.query";

// Realtime hooks (Supabase Realtime + React Query)
export {
  useRealtimeTable,
  type RealtimeEvent,
  type UseRealtimeTableOptions,
} from "./useRealtimeTable";
export {
  useRealtimeAll,
  useRealtimeAppointments,
  useRealtimeCustomers,
  useRealtimeServiceCategories,
  useRealtimeServices,
  useRealtimeStaff,
  useRealtimeWAOutbound,
  waOutboundKeys,
} from "./useRealtimeEntities";

// Other hooks
export { useAuth } from "./use-auth";
export { useCapacitor } from "./useCapacitor";
export { useDebounce } from "./useDebounce";
export { useLicense } from "./useLicense";
export { toast, useToast } from "./useToast";

// Trips hooks (seat booking module, PRP-002)
export {
  tripKeys,
  useCancelTrip,
  useCreateTrip,
  useDuplicateTrip,
  useSetTripPublished,
  useTripQuery,
  useTripsQuery,
  useUpdateTrip,
  type TripFilters,
} from "./useTrips.query";
export {
  organizationModuleKeys,
  useOrganizationModules,
  type OrganizationModules,
} from "./useOrganizationModules.query";
export {
  tripBookingKeys,
  useCreateManualBooking,
  useSetBookingStatus,
  useSetBookingExtra,
  useTripBookingsQuery,
  useUpdatePassengerNames,
} from "./useTripBookings.query";
export { useMoney } from "./useMoney";
