-- 100: Finanzas — money of appointments and of trip bookings for a period (TUR0011, PRP-011).
--
-- Read only, no new tables. Two public functions, the same for both modules (p_module):
--   get_financial_summary -> totals + one bucket per day / week / month
--   get_financial_rows    -> the detail, one row per appointment or booking (paginated, or all to export)
-- Both read ONE base per module (finance_*_base: filters, expected, pending, overdue, payment status)
-- and ONE list of money movements (finance_*_movements: payments and processed refunds), so cards,
-- buckets and detail can never disagree.
--
-- Definitions (business timezone, 088):
--   expected  price of what is not cancelled / no-show, by the date of the appointment or departure
--   collected payments not voided minus processed refunds, by the date the money moved
--   pending   expected minus paid (never negative), by the date of the appointment or departure
--   overdue   part of pending that should be in already: the appointment/departure is past (or done),
--             or the deposit deadline passed (deposit_due_at / hold_expires_at)
-- Same access as the reports (088): owner of the business, platform admin of any; a blocked
-- business gets nothing but the admin always does.

-- ---------------------------------------------------------------------------
-- 1. Who may look, and which business
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_resolve_org(p_organization_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_profile_org UUID;
  v_org UUID;
BEGIN
  SELECT up.role::TEXT, up.organization_id INTO v_role, v_profile_org
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid() AND up.is_active = true;

  IF v_role = 'admin' THEN
    v_org := COALESCE(p_organization_id, v_profile_org);
  ELSIF v_role = 'owner' THEN
    v_org := v_profile_org;
  ELSE
    RAISE EXCEPTION 'finance_forbidden';
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'finance_no_organization';
  END IF;
  IF v_role <> 'admin' AND NOT public.org_license_usable(v_org) THEN
    RAISE EXCEPTION 'finance_blocked';
  END IF;
  RETURN v_org;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Appointments: base and movements
--    filters: service_id, staff_id, customer_id, search, method, payment_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_appointments_base(p_org UUID, p_filters JSONB, p_today DATE)
RETURNS TABLE (
  id UUID, day DATE, sort_time TIME, closed BOOLEAN, status TEXT,
  expected NUMERIC, paid NUMERIC, refunded NUMERIC, refund_pending NUMERIC,
  pending NUMERIC, overdue NUMERIC, payment_status TEXT, detail JSONB
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT NULLIF(p_filters->>'service_id', '')::UUID AS service_id,
           NULLIF(p_filters->>'staff_id', '')::UUID AS staff_id,
           NULLIF(p_filters->>'customer_id', '')::UUID AS customer_id,
           NULLIF(btrim(p_filters->>'search'), '') AS search,
           NULLIF(p_filters->>'method', '') AS method,
           NULLIF(p_filters->>'payment_status', '') AS payment_status
  ),
  a AS (
    SELECT v.*,
           v.status IN ('cancelled', 'no_show', 'rescheduled') AS is_closed,
           COALESCE(v.price_charged, v.service_price, 0) AS price,
           COALESCE(v.amount_paid, 0) AS paid_amount
    FROM public.appointments_with_details v, f
    WHERE v.organization_id = p_org
      AND (f.service_id IS NULL OR v.service_id = f.service_id)
      AND (f.staff_id IS NULL OR v.staff_id = f.staff_id)
      AND (f.customer_id IS NULL OR v.customer_id = f.customer_id)
      AND (f.search IS NULL OR concat_ws(' ', v.customer_first_name, v.customer_last_name, v.customer_phone)
                                 ILIKE '%' || f.search || '%')
      AND (f.method IS NULL OR EXISTS (
            SELECT 1 FROM public.appointment_payments p
            WHERE p.appointment_id = v.id AND p.voided_at IS NULL AND p.method::TEXT = f.method))
  ),
  c AS (
    SELECT a.*,
           CASE WHEN a.is_closed THEN 0 ELSE a.price END AS exp,
           CASE WHEN a.is_closed THEN 0 ELSE GREATEST(a.price - a.paid_amount, 0) END AS pend
    FROM a
  ),
  o AS (
    SELECT c.*,
           CASE
             WHEN c.pend <= 0 THEN 0
             WHEN c.appointment_date < p_today OR c.status = 'completed' THEN c.pend
             WHEN c.deposit_status IN ('pending', 'requested') AND c.deposit_due_at < now()
                  AND COALESCE(c.deposit_amount, 0) > c.paid_amount
               THEN LEAST(c.deposit_amount - c.paid_amount, c.pend)
             ELSE 0
           END AS over,
           CASE
             WHEN c.paid_amount <= 0 THEN 'unpaid'
             WHEN c.paid_amount >= c.price THEN 'paid'
             ELSE 'partial'
           END AS pstat
    FROM c
  )
  SELECT o.id, o.appointment_date, o.start_time, o.is_closed, o.status::TEXT,
         o.exp, o.paid_amount, COALESCE(o.amount_refunded, 0), COALESCE(o.amount_refund_pending, 0),
         o.pend, o.over, o.pstat,
         jsonb_build_object(
           'number', o.appointment_number,
           'time', to_char(o.start_time, 'HH24:MI'),
           'customer_id', o.customer_id,
           'customer_name', btrim(concat_ws(' ', o.customer_first_name, o.customer_last_name)),
           'customer_phone', o.customer_phone,
           'service_name', o.service_name,
           'staff_name', NULLIF(btrim(COALESCE(o.staff_nickname,
                           concat_ws(' ', o.staff_first_name, o.staff_last_name))), '')
         )
  FROM o, f
  WHERE f.payment_status IS NULL
     OR (f.payment_status IN ('unpaid', 'partial', 'paid') AND NOT o.is_closed AND o.pstat = f.payment_status)
     OR (f.payment_status = 'overdue' AND o.over > 0)
     OR (f.payment_status = 'refunded'
         AND COALESCE(o.amount_refunded, 0) + COALESCE(o.amount_refund_pending, 0) > 0);
$function$;

CREATE OR REPLACE FUNCTION public.finance_appointments_movements(
  p_org UUID, p_tz TEXT, p_method TEXT, p_start DATE, p_end DATE
)
RETURNS TABLE (owner_id UUID, day DATE, amount NUMERIC, kind TEXT)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p.appointment_id, (p.paid_at AT TIME ZONE p_tz)::DATE, p.amount, 'payment'
  FROM public.appointment_payments p
  WHERE p.organization_id = p_org AND p.voided_at IS NULL
    AND (p_method IS NULL OR p.method::TEXT = p_method)
    AND (p.paid_at AT TIME ZONE p_tz)::DATE BETWEEN p_start AND p_end
  UNION ALL
  SELECT r.appointment_id, (r.refunded_at AT TIME ZONE p_tz)::DATE, r.amount, 'refund'
  FROM public.appointment_refunds r
  WHERE r.organization_id = p_org AND r.status = 'processed'
    AND (p_method IS NULL OR r.method::TEXT = p_method)
    AND (r.refunded_at AT TIME ZONE p_tz)::DATE BETWEEN p_start AND p_end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Trip bookings: base and movements
--    filters: trip_id, destination ('__none__' = without one), pickup_point_id, trip_type,
--             search (who booked, phone, passengers), method, payment_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_trips_base(p_org UUID, p_filters JSONB, p_today DATE)
RETURNS TABLE (
  id UUID, day DATE, sort_time TIME, closed BOOLEAN, status TEXT,
  expected NUMERIC, paid NUMERIC, refunded NUMERIC, refund_pending NUMERIC,
  pending NUMERIC, overdue NUMERIC, payment_status TEXT, detail JSONB
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT NULLIF(p_filters->>'trip_id', '')::UUID AS trip_id,
           NULLIF(p_filters->>'destination', '') AS destination,
           NULLIF(p_filters->>'pickup_point_id', '')::UUID AS pickup_point_id,
           NULLIF(p_filters->>'trip_type', '') AS trip_type,
           NULLIF(btrim(p_filters->>'search'), '') AS search,
           NULLIF(p_filters->>'method', '') AS method,
           NULLIF(p_filters->>'payment_status', '') AS payment_status
  ),
  b AS (
    SELECT bk.id, bk.booking_number, bk.status::TEXT AS status, bk.seats, bk.trip_type,
           bk.passenger_names, bk.deposit_amount, bk.deposit_status::TEXT AS deposit_status,
           bk.hold_expires_at, t.id AS trip_id, t.title, t.destination, t.departure_date,
           t.departure_time, pp.name AS pickup_name, c.first_name, c.last_name, c.phone,
           bk.status IN ('cancelled', 'no_show') OR t.cancelled_at IS NOT NULL AS is_closed,
           COALESCE(bk.price_total, 0) + COALESCE(bk.extra_amount, 0) AS price,
           bk.amount_paid AS paid_amount,
           COALESCE((SELECT SUM(r.amount) FROM public.trip_booking_refunds r
                     WHERE r.trip_booking_id = bk.id AND r.status = 'processed'), 0) AS refunded_amount,
           COALESCE((SELECT SUM(r.amount) FROM public.trip_booking_refunds r
                     WHERE r.trip_booking_id = bk.id AND r.status = 'pending'), 0) AS refund_pending_amount
    FROM public.trip_bookings bk
    JOIN public.trips t ON t.id = bk.trip_id
    LEFT JOIN public.customers c ON c.id = bk.customer_id
    LEFT JOIN public.trip_pickup_points pp ON pp.id = bk.pickup_point_id, f
    WHERE bk.organization_id = p_org
      AND (f.trip_id IS NULL OR t.id = f.trip_id)
      AND (f.destination IS NULL
           OR (f.destination = '__none__' AND NULLIF(btrim(t.destination), '') IS NULL)
           OR lower(btrim(t.destination)) = lower(btrim(f.destination)))
      AND (f.pickup_point_id IS NULL OR bk.pickup_point_id = f.pickup_point_id)
      AND (f.trip_type IS NULL OR bk.trip_type = f.trip_type)
      AND (f.search IS NULL
           OR concat_ws(' ', c.first_name, c.last_name, c.phone, array_to_string(bk.passenger_names, ' '))
              ILIKE '%' || f.search || '%')
      AND (f.method IS NULL OR EXISTS (
            SELECT 1 FROM public.trip_booking_payments p
            WHERE p.trip_booking_id = bk.id AND p.voided_at IS NULL AND p.method::TEXT = f.method))
  ),
  c AS (
    SELECT b.*,
           CASE WHEN b.is_closed THEN 0 ELSE b.price END AS exp,
           CASE WHEN b.is_closed THEN 0 ELSE GREATEST(b.price - b.paid_amount, 0) END AS pend
    FROM b
  ),
  o AS (
    SELECT c.*,
           CASE
             WHEN c.pend <= 0 THEN 0
             WHEN c.departure_date < p_today OR c.status = 'completed' THEN c.pend
             WHEN c.deposit_status = 'pending' AND c.hold_expires_at < now()
                  AND COALESCE(c.deposit_amount, 0) > c.paid_amount
               THEN LEAST(c.deposit_amount - c.paid_amount, c.pend)
             ELSE 0
           END AS over,
           CASE
             WHEN c.paid_amount <= 0 THEN 'unpaid'
             WHEN c.paid_amount >= c.price THEN 'paid'
             ELSE 'partial'
           END AS pstat
    FROM c
  )
  SELECT o.id, o.departure_date, o.departure_time, o.is_closed, o.status,
         o.exp, o.paid_amount, o.refunded_amount, o.refund_pending_amount,
         o.pend, o.over, o.pstat,
         jsonb_build_object(
           'number', o.booking_number,
           'time', to_char(o.departure_time, 'HH24:MI'),
           'trip_id', o.trip_id,
           'trip_title', o.title,
           'destination', NULLIF(btrim(o.destination), ''),
           'pickup_point', o.pickup_name,
           'trip_type', o.trip_type,
           'seats', o.seats,
           'customer_name', btrim(concat_ws(' ', o.first_name, o.last_name)),
           'customer_phone', o.phone,
           'passengers', array_to_string(o.passenger_names, ', ')
         )
  FROM o, f
  WHERE f.payment_status IS NULL
     OR (f.payment_status IN ('unpaid', 'partial', 'paid') AND NOT o.is_closed AND o.pstat = f.payment_status)
     OR (f.payment_status = 'overdue' AND o.over > 0)
     OR (f.payment_status = 'refunded' AND o.refunded_amount + o.refund_pending_amount > 0);
$function$;

CREATE OR REPLACE FUNCTION public.finance_trips_movements(
  p_org UUID, p_tz TEXT, p_method TEXT, p_start DATE, p_end DATE
)
RETURNS TABLE (owner_id UUID, day DATE, amount NUMERIC, kind TEXT)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p.trip_booking_id, (p.paid_at AT TIME ZONE p_tz)::DATE, p.amount, 'payment'
  FROM public.trip_booking_payments p
  WHERE p.organization_id = p_org AND p.voided_at IS NULL
    AND (p_method IS NULL OR p.method::TEXT = p_method)
    AND (p.paid_at AT TIME ZONE p_tz)::DATE BETWEEN p_start AND p_end
  UNION ALL
  SELECT r.trip_booking_id, (r.refunded_at AT TIME ZONE p_tz)::DATE, r.amount, 'refund'
  FROM public.trip_booking_refunds r
  WHERE r.organization_id = p_org AND r.status = 'processed'
    AND (p_method IS NULL OR r.method::TEXT = p_method)
    AND (r.refunded_at AT TIME ZONE p_tz)::DATE BETWEEN p_start AND p_end;
$function$;

-- The internals run only inside the two functions below (which check who is asking)
REVOKE EXECUTE ON FUNCTION public.finance_resolve_org(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_appointments_base(UUID, JSONB, DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_appointments_movements(UUID, TEXT, TEXT, DATE, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_trips_base(UUID, JSONB, DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_trips_movements(UUID, TEXT, TEXT, DATE, DATE)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Shared checks of the period and the module
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_check_period(p_module TEXT, p_start DATE, p_end DATE)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF p_module IS NULL OR p_module NOT IN ('appointments', 'trips') THEN
    RAISE EXCEPTION 'finance_invalid_module';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RAISE EXCEPTION 'finance_invalid_period';
  END IF;
  IF p_end - p_start + 1 > 400 THEN
    RAISE EXCEPTION 'finance_period_too_long';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finance_check_period(TEXT, DATE, DATE) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Totals and buckets
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_module TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_group_by TEXT,
  p_organization_id UUID DEFAULT NULL,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID := public.finance_resolve_org(p_organization_id);
  v_tz TEXT;
  v_today DATE;
  v_filters JSONB := COALESCE(p_filters, '{}'::JSONB);
  v_method TEXT := NULLIF(COALESCE(p_filters, '{}'::JSONB)->>'method', '');
  v_result JSONB;
BEGIN
  PERFORM public.finance_check_period(p_module, p_start_date, p_end_date);
  IF p_group_by IS NULL OR p_group_by NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'finance_invalid_group';
  END IF;

  SELECT COALESCE(o.timezone, 'UTC') INTO v_tz FROM public.organizations o WHERE o.id = v_org;
  v_today := (now() AT TIME ZONE v_tz)::DATE;

  WITH base AS (
    SELECT * FROM public.finance_appointments_base(v_org, v_filters, v_today) WHERE p_module = 'appointments'
    UNION ALL
    SELECT * FROM public.finance_trips_base(v_org, v_filters, v_today) WHERE p_module = 'trips'
  ),
  rows_in AS (
    SELECT * FROM base
    WHERE base.day BETWEEN p_start_date AND p_end_date
      AND (NOT base.closed OR base.paid > 0 OR base.refunded + base.refund_pending > 0)
  ),
  moves AS (
    SELECT m.* FROM public.finance_appointments_movements(v_org, v_tz, v_method, p_start_date, p_end_date) m
    WHERE p_module = 'appointments'
    UNION ALL
    SELECT m.* FROM public.finance_trips_movements(v_org, v_tz, v_method, p_start_date, p_end_date) m
    WHERE p_module = 'trips'
  ),
  money AS (
    SELECT m.day, m.amount, m.kind FROM moves m JOIN base ON base.id = m.owner_id
  ),
  periods AS (
    SELECT g::DATE AS period
    FROM generate_series(
      date_trunc(p_group_by, p_start_date::TIMESTAMP),
      date_trunc(p_group_by, p_end_date::TIMESTAMP),
      ('1 ' || p_group_by)::INTERVAL
    ) g
  ),
  buckets AS (
    SELECT p.period,
           COALESCE((SELECT SUM(r.expected) FROM rows_in r
                     WHERE date_trunc(p_group_by, r.day::TIMESTAMP)::DATE = p.period), 0) AS expected,
           COALESCE((SELECT SUM(r.pending) FROM rows_in r
                     WHERE date_trunc(p_group_by, r.day::TIMESTAMP)::DATE = p.period), 0) AS pending,
           COALESCE((SELECT SUM(r.overdue) FROM rows_in r
                     WHERE date_trunc(p_group_by, r.day::TIMESTAMP)::DATE = p.period), 0) AS overdue,
           COALESCE((SELECT SUM(m.amount) FROM money m WHERE m.kind = 'payment'
                     AND date_trunc(p_group_by, m.day::TIMESTAMP)::DATE = p.period), 0) AS collected_gross,
           COALESCE((SELECT SUM(m.amount) FROM money m WHERE m.kind = 'refund'
                     AND date_trunc(p_group_by, m.day::TIMESTAMP)::DATE = p.period), 0) AS refunded
    FROM periods p
  )
  SELECT jsonb_build_object(
    'organization_id', v_org,
    'module', p_module,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'group_by', p_group_by,
    'totals', jsonb_build_object(
      'expected', COALESCE((SELECT SUM(expected) FROM rows_in), 0),
      'collected_gross', COALESCE((SELECT SUM(amount) FROM money WHERE kind = 'payment'), 0),
      'refunded', COALESCE((SELECT SUM(amount) FROM money WHERE kind = 'refund'), 0),
      'collected', COALESCE((SELECT SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END) FROM money), 0),
      'pending', COALESCE((SELECT SUM(pending) FROM rows_in), 0),
      'overdue', COALESCE((SELECT SUM(overdue) FROM rows_in), 0),
      'overdue_count', (SELECT COUNT(*) FROM rows_in WHERE overdue > 0),
      'refund_pending', COALESCE((SELECT SUM(refund_pending) FROM rows_in), 0),
      'rows', (SELECT COUNT(*) FROM rows_in)
    ),
    'buckets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'period', b.period,
               'expected', b.expected,
               'collected_gross', b.collected_gross,
               'refunded', b.refunded,
               'collected', b.collected_gross - b.refunded,
               'pending', b.pending,
               'overdue', b.overdue
             ) ORDER BY b.period)
      FROM buckets b
    ), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. The detail: one row per appointment / booking of the period (p_limit NULL = all, to export)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_financial_rows(
  p_module TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_organization_id UUID DEFAULT NULL,
  p_filters JSONB DEFAULT '{}'::JSONB,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID := public.finance_resolve_org(p_organization_id);
  v_tz TEXT;
  v_today DATE;
  v_filters JSONB := COALESCE(p_filters, '{}'::JSONB);
  v_limit INTEGER := LEAST(COALESCE(p_limit, 5000), 5000);
  v_result JSONB;
BEGIN
  PERFORM public.finance_check_period(p_module, p_start_date, p_end_date);
  IF v_limit < 1 OR COALESCE(p_offset, 0) < 0 THEN
    RAISE EXCEPTION 'finance_invalid_page';
  END IF;

  SELECT COALESCE(o.timezone, 'UTC') INTO v_tz FROM public.organizations o WHERE o.id = v_org;
  v_today := (now() AT TIME ZONE v_tz)::DATE;

  WITH base AS (
    SELECT * FROM public.finance_appointments_base(v_org, v_filters, v_today) WHERE p_module = 'appointments'
    UNION ALL
    SELECT * FROM public.finance_trips_base(v_org, v_filters, v_today) WHERE p_module = 'trips'
  ),
  rows_in AS (
    SELECT base.*, COUNT(*) OVER () AS total_count
    FROM base
    WHERE base.day BETWEEN p_start_date AND p_end_date
      AND (NOT base.closed OR base.paid > 0 OR base.refunded + base.refund_pending > 0)
    ORDER BY base.day, base.sort_time NULLS LAST, base.id
    LIMIT v_limit OFFSET COALESCE(p_offset, 0)
  )
  SELECT jsonb_build_object(
    'total_count', COALESCE((SELECT MAX(total_count) FROM rows_in), 0),
    'rows', COALESCE((
      SELECT jsonb_agg(r.detail || jsonb_build_object(
               'id', r.id,
               'date', r.day,
               'status', r.status,
               'closed', r.closed,
               'expected', r.expected,
               'paid', r.paid,
               'refunded', r.refunded,
               'refund_pending', r.refund_pending,
               'pending', r.pending,
               'overdue', r.overdue,
               'payment_status', r.payment_status
             ) ORDER BY r.day, r.sort_time NULLS LAST, r.id)
      FROM rows_in r
    ), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_financial_summary(TEXT, DATE, DATE, TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(TEXT, DATE, DATE, TEXT, UUID, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_financial_rows(TEXT, DATE, DATE, UUID, JSONB, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_rows(TEXT, DATE, DATE, UUID, JSONB, INTEGER, INTEGER) TO authenticated;
