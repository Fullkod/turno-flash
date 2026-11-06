-- 098: payments of each trip booking and the destination of a departure (TUR0011, PRP-011).
--
-- Same model as the payments of an appointment (095): each booking keeps the list of its payments
-- (amount, date, method, reference, notes and an optional receipt in the same private bucket,
-- <organization>/<booking>/<file>). A payment is never deleted: only an owner or admin voids
-- it, with a reason. trip_bookings.amount_paid stays, but the database now derives it from the
-- payments, so the deposit trigger (037), the driver list, the public page and wa-trip-send keep
-- working untouched. Writing amount_paid directly is rejected, so an old app fails loudly instead of
-- losing a payment.

-- ---------------------------------------------------------------------------
-- 1. Destination of a departure (optional, dashboard only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS destination TEXT CHECK (char_length(destination) <= 120);

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trip_booking_id UUID NOT NULL REFERENCES public.trip_bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method public.appointment_payment_method NOT NULL,
  method_other TEXT CHECK (char_length(method_other) <= 60),
  reference TEXT CHECK (char_length(reference) <= 100),
  notes TEXT CHECK (char_length(notes) <= 500),
  receipt_path TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason TEXT CHECK (char_length(void_reason) <= 300),
  CONSTRAINT trip_booking_payments_other_check CHECK (
    method <> 'other' OR NULLIF(btrim(method_other), '') IS NOT NULL
  ),
  CONSTRAINT trip_booking_payments_void_check CHECK (
    (voided_at IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND NULLIF(btrim(void_reason), '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_trip_booking_payments_booking
  ON public.trip_booking_payments (trip_booking_id);
CREATE INDEX IF NOT EXISTS idx_trip_booking_payments_org_paid_at
  ON public.trip_booking_payments (organization_id, paid_at);

COMMENT ON TABLE public.trip_booking_payments IS
  'Payments of a trip booking (TUR0011). Written only by register_trip_payment() and '
  'void_trip_payment(); never deleted, a voided payment stops counting.';

-- Members read the payments of their business; writes only through the functions below
ALTER TABLE public.trip_booking_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_booking_payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trip_booking_payments FROM authenticated;
GRANT SELECT ON public.trip_booking_payments TO authenticated;

DROP POLICY IF EXISTS "Members read trip payments of their org" ON public.trip_booking_payments;
CREATE POLICY "Members read trip payments of their org" ON public.trip_booking_payments
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.auth_user_org_id()));

DROP POLICY IF EXISTS "License must be usable" ON public.trip_booking_payments;
CREATE POLICY "License must be usable" ON public.trip_booking_payments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.auth_org_usable()))
  WITH CHECK ((SELECT public.auth_org_usable()));

-- ---------------------------------------------------------------------------
-- 3. amount_paid follows the payments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trip_booking_amount_paid(p_booking_id UUID)
RETURNS NUMERIC(10,2)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(p.amount), 0)
  FROM public.trip_booking_payments p
  WHERE p.trip_booking_id = p_booking_id AND p.voided_at IS NULL;
$function$;

-- Only the payments trigger below may move amount_paid (it raises a transaction-local flag).
-- Named so it runs before sync_trip_deposit_status_trigger (BEFORE triggers fire by name), which
-- then derives the deposit state from the new amount.
CREATE OR REPLACE FUNCTION public.guard_trip_amount_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.trip_payments_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND COALESCE(NEW.amount_paid, 0) <> 0 THEN
    RAISE EXCEPTION 'amount_paid_managed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
    RAISE EXCEPTION 'amount_paid_managed';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_trip_amount_paid_guard ON public.trip_bookings;
CREATE TRIGGER sync_trip_amount_paid_guard
  BEFORE INSERT OR UPDATE ON public.trip_bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_trip_amount_paid();

CREATE OR REPLACE FUNCTION public.refresh_trip_amount_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.trip_payments_sync', 'on', true);
  UPDATE public.trip_bookings
  SET amount_paid = public.trip_booking_amount_paid(NEW.trip_booking_id)
  WHERE id = NEW.trip_booking_id;
  PERFORM set_config('app.trip_payments_sync', 'off', true);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_trip_amount_paid ON public.trip_booking_payments;
CREATE TRIGGER trg_refresh_trip_amount_paid
  AFTER INSERT OR UPDATE ON public.trip_booking_payments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_trip_amount_paid();

REVOKE EXECUTE ON FUNCTION public.guard_trip_amount_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_trip_amount_paid() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Register a payment (any member of the business, like collecting today: 061)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_trip_payment(
  p_booking_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ,
  p_method public.appointment_payment_method,
  p_method_other TEXT,
  p_reference TEXT,
  p_notes TEXT,
  p_receipt_path TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID := public.auth_user_org_id();
  v_id UUID;
BEGIN
  IF v_org IS NULL OR NOT public.auth_org_usable() THEN
    RAISE EXCEPTION 'payment_forbidden';
  END IF;

  PERFORM 1 FROM public.trip_bookings
  WHERE id = p_booking_id AND organization_id = v_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 99999999 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_paid_at IS NOT NULL AND p_paid_at > now() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'invalid_paid_at';
  END IF;
  IF p_receipt_path IS NOT NULL
     AND p_receipt_path NOT LIKE v_org::TEXT || '/' || p_booking_id::TEXT || '/%' THEN
    RAISE EXCEPTION 'invalid_receipt';
  END IF;

  INSERT INTO public.trip_booking_payments (
    organization_id, trip_booking_id, amount, paid_at, method, method_other,
    reference, notes, receipt_path, created_by
  )
  VALUES (
    v_org, p_booking_id, p_amount, COALESCE(p_paid_at, now()), p_method,
    CASE WHEN p_method = 'other' THEN NULLIF(btrim(COALESCE(p_method_other, '')), '') END,
    NULLIF(btrim(COALESCE(p_reference, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_receipt_path, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_trip_payment(
  UUID, NUMERIC, TIMESTAMPTZ, public.appointment_payment_method, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_trip_payment(
  UUID, NUMERIC, TIMESTAMPTZ, public.appointment_payment_method, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Void a payment (owner or admin, with a reason). The deposit state follows the new amount.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_trip_payment(p_payment_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID := public.auth_user_org_id();
  v_pay public.trip_booking_payments%ROWTYPE;
BEGIN
  IF v_org IS NULL OR NOT public.auth_org_usable()
     OR NOT COALESCE(public.auth_user_role() IN ('owner', 'admin'), false) THEN
    RAISE EXCEPTION 'payment_forbidden';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL OR char_length(p_reason) > 300 THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  SELECT * INTO v_pay FROM public.trip_booking_payments
  WHERE id = p_payment_id AND organization_id = v_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;
  IF v_pay.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'payment_already_voided';
  END IF;

  UPDATE public.trip_booking_payments
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  WHERE id = p_payment_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.void_trip_payment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_trip_payment(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Money already collected becomes one payment per booking, so amount_paid does not move
-- ---------------------------------------------------------------------------
INSERT INTO public.trip_booking_payments (
  organization_id, trip_booking_id, amount, paid_at, method, method_other, notes, created_at
)
SELECT b.organization_id, b.id, b.amount_paid,
       COALESCE(b.deposit_paid_at, b.updated_at, b.created_at),
       CASE
         WHEN b.deposit_method ILIKE '%efectiv%' THEN 'cash'
         WHEN b.deposit_method ILIKE '%transf%' THEN 'transfer'
         WHEN b.deposit_method ILIKE '%tarjet%' THEN 'card'
         ELSE 'other'
       END::public.appointment_payment_method,
       CASE
         WHEN b.deposit_method ILIKE ANY (ARRAY['%efectiv%', '%transf%', '%tarjet%']) THEN NULL
         ELSE COALESCE(NULLIF(btrim(b.deposit_method), ''), 'Sin dato')
       END,
       'Cobrado antes de registrar pagos', now()
FROM public.trip_bookings b
WHERE b.amount_paid > 0
  AND NOT EXISTS (SELECT 1 FROM public.trip_booking_payments p WHERE p.trip_booking_id = b.id);
