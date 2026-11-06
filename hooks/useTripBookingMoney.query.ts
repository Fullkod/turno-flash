import {
  TripPaymentsService,
  TripRefundsService,
  type NewTripPayment,
} from "@/services/trip-booking-money.service";
import type {
  NewAppointmentRefund,
  RefundDecision,
} from "@/services/appointment-refunds.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tripBookingKeys } from "./useTripBookings.query";
import { tripKeys } from "./useTrips.query";

// Under tripBookingKeys.all: a payment changes amount_paid and the deposit of the booking list
const moneyKeys = {
  payments: (bookingId: string) => [...tripBookingKeys.all, "payments", bookingId] as const,
  refunds: (bookingId: string) => [...tripBookingKeys.all, "refunds", bookingId] as const,
};

/** Payments of one trip booking, voided ones included (TUR0011). */
export function useTripPayments(bookingId: string) {
  return useQuery({
    queryKey: moneyKeys.payments(bookingId),
    queryFn: () => TripPaymentsService.list(bookingId),
  });
}

/** Refunds of one trip booking with their history (TUR0011). */
export function useTripRefunds(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: moneyKeys.refunds(bookingId),
    queryFn: () => TripRefundsService.list(bookingId),
    enabled,
  });
}

/** Any change of money refreshes the booking list (amount_paid, deposit) and the trips. */
function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tripBookingKeys.all }),
      queryClient.invalidateQueries({ queryKey: tripKeys.all }),
    ]);
}

function unwrap(result: { success: boolean; error?: string }) {
  if (!result.success) throw new Error(result.error);
}

export function useRegisterTripPayment() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: async ({
      booking,
      payment,
    }: {
      booking: { id: string; organization_id: string };
      payment: NewTripPayment;
    }) => unwrap(await TripPaymentsService.register(booking, payment)),
    // Awaited: the sheet shows the new list as soon as the form closes
    onSuccess: invalidate,
  });
}

export function useVoidTripPayment() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      unwrap(await TripPaymentsService.void(paymentId, reason)),
    onSuccess: invalidate,
  });
}

export function useRegisterTripRefund() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: async ({ bookingId, refund }: { bookingId: string; refund: NewAppointmentRefund }) =>
      unwrap(await TripRefundsService.register(bookingId, refund)),
    onSuccess: invalidate,
  });
}

export function useDecideTripRefund() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: async ({ refundId, decision }: { refundId: string; decision: RefundDecision }) =>
      unwrap(await TripRefundsService.decide(refundId, decision)),
    onSuccess: invalidate,
  });
}
