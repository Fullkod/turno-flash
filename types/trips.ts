// Seat booking module (PRP-002, migration 033).
//
// A trip is one concrete departure, not a route template. A booking takes N
// seats of it and carries two independent states: `status` (does the business
// accept the passenger?) and `deposit_status` (did the money arrive?).

/**
 * Numeric form fields accept "" so clearing one leaves it empty instead of
 * snapping back to 0, which makes overwriting a number a fight.
 */
export type NumericField = number | "";

export type TripBookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

/** What was sold: one way, or the seat there and back at another price. */
export type TripType = "one_way" | "round_trip";

export type TripDepositStatus = "pending" | "paid" | "refunded" | "waived";

export interface Trip {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  pickup_location: string | null;
  /** Where the trip goes (098, optional): a filter of Finanzas. */
  destination: string | null;
  /** YYYY-MM-DD */
  departure_date: string;
  /** HH:MM:SS */
  departure_time: string;
  return_time: string | null;
  timezone: string;
  total_seats: number;
  max_seats_per_booking: number;
  price_per_seat: number;
  deposit_per_seat: number;
  /** The departure can also be sold there and back. */
  round_trip_enabled: boolean;
  /** Return price per seat; NULL falls back to price_per_seat. */
  price_round_trip: number | null;
  currency: string;
  /** true = bookings are born pending and the business has to approve them */
  requires_approval: boolean;
  is_published: boolean;
  cancelled_at: string | null;
  /** All optional: a departure is often sold before the driver is assigned. */
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_description: string | null;
  /** Path inside the trip-photos bucket; the public URL is built on read. */
  vehicle_photo_path: string | null;
  /** NULL = open as soon as it is published / until it departs. */
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A stop of the departure. The same trip can be sold at different prices
 * depending on where the passenger boards, so price and deposit live here.
 */
export interface TripPickupPoint {
  id: string;
  trip_id: string;
  name: string;
  details: string | null;
  /** HH:MM:SS, when the bus passes by this stop. */
  pickup_time: string | null;
  price_per_seat: number;
  /** Return price from this stop; NULL falls back to the trip's. */
  price_round_trip: number | null;
  deposit_per_seat: number;
  sort_order: number;
}

/** A stop being edited in the trip form; id is empty for a new one. */
export interface PickupPointFormState {
  id: string;
  name: string;
  details: string;
  pickup_time: string;
  price_per_seat: NumericField;
  price_round_trip: NumericField;
  deposit_per_seat: NumericField;
}

/** A trip plus its live occupancy, resolved in one extra query (never N+1). */
export interface TripWithOccupancy extends Trip {
  seats_taken: number;
  seats_left: number;
  /** Web bookings waiting for the business to approve them. */
  pending_approval: number;
  pickup_points: TripPickupPoint[];
}

export interface TripFormData {
  title: string;
  description: string;
  pickup_location: string;
  destination: string;
  departure_date: string;
  /** HH:MM */
  departure_time: string;
  /** HH:MM, empty when there is no return time */
  return_time: string;
  total_seats: number;
  max_seats_per_booking: number;
  price_per_seat: number;
  deposit_per_seat: number;
  round_trip_enabled: boolean;
  price_round_trip: number;
  currency: string;
  requires_approval: boolean;
  is_published: boolean;
  driver_name: string;
  driver_phone: string;
  vehicle_description: string;
  /** Empty while the departure has no photo of the vehicle. */
  vehicle_photo_path: string;
  /** datetime-local strings; empty means no limit. */
  booking_opens_at: string;
  booking_closes_at: string;
  internal_notes: string;
}


export interface TripFormState extends Omit<
  TripFormData,
  | "total_seats"
  | "max_seats_per_booking"
  | "price_per_seat"
  | "deposit_per_seat"
  | "price_round_trip"
> {
  total_seats: NumericField;
  max_seats_per_booking: NumericField;
  price_per_seat: NumericField;
  deposit_per_seat: NumericField;
  price_round_trip: NumericField;
}

export interface TripBooking {
  id: string;
  organization_id: string;
  trip_id: string;
  customer_id: string;
  booking_number: string | null;
  seats: number;
  trip_type: TripType;
  /** One name per seat. May be shorter than seats on phone bookings. */
  passenger_names: string[];
  status: TripBookingStatus;
  source: string;
  price_total: number | null;
  deposit_amount: number | null;
  deposit_status: TripDepositStatus;
  deposit_paid_at: string | null;
  deposit_method: string | null;
  hold_expires_at: string | null;
  /** Money actually received; what is left is totalOwed - amount_paid. */
  amount_paid: number;
  pickup_point_id: string | null;
  /** Something charged on top of the seats: airport drop-off, extra luggage… */
  extra_description: string | null;
  extra_amount: number;
  notes: string | null;
  internal_notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
}

/** A booking with whoever made it, which is what the passenger list shows. */
export interface TripBookingWithCustomer extends TripBooking {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  pickup_point: { id: string; name: string } | null;
}

/** Manual booking taken by phone or at the counter. */
export interface ManualBookingFormState {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  seats: NumericField;
  trip_type: TripType;
  passenger_names: string[];
  notes: string;
  /** Which stop they board at; empty when the trip has no stops loaded. */
  pickup_point_id: string;
  /** How much money the business already received for this booking. */
  amount_paid: NumericField;
  /** How that money came in: it becomes the first payment (098). */
  payment_method: "cash" | "transfer" | "card";
  extra_description: string;
  extra_amount: NumericField;
}

/**
 * What one seat costs on this departure: the stop's price when the passenger
 * picked one, the trip's otherwise, and the return price when that is what is
 * being sold. Same rule as the RPC trip_seat_price (migration 042).
 */
export function seatPrice(
  trip: { price_per_seat: number; price_round_trip: number | null },
  point: { price_per_seat: number; price_round_trip: number | null } | undefined,
  tripType: TripType
): number {
  if (tripType === "round_trip") {
    return point?.price_round_trip ?? trip.price_round_trip ?? point?.price_per_seat ?? trip.price_per_seat;
  }
  return point?.price_per_seat ?? trip.price_per_seat;
}

/** Everything owed for a booking: the seats plus whatever was added on top. */
export function bookingTotal(booking: {
  price_total: number | null;
  extra_amount: number;
}): number {
  return (booking.price_total ?? 0) + (booking.extra_amount ?? 0);
}

export function bookingPending(booking: {
  price_total: number | null;
  extra_amount: number;
  amount_paid: number;
}): number {
  return Math.max(bookingTotal(booking) - (booking.amount_paid ?? 0), 0);
}
