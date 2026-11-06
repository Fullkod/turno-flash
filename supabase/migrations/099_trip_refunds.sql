-- 099: refunds of each trip booking (TUR0011, PRP-011).
--
-- Same model as the refunds of an appointment (097): a cancelled booking (or one whose departure
-- was cancelled, or a no-show) can get refunds with amount and reason. Any member registers one as
-- pending; an owner or admin processes or rejects it, or registers it already processed. Never more
-- than what was paid, and the same "Hacemos devoluciones" switch. The passenger gets a WhatsApp when
-- it is processed or rejected (wa-trip-send, same switch as the appointment notice).

-- New values can't be used in this same transaction: the trigger below sends them as text
ALTER TYPE public.wa_outbound_intent ADD VALUE IF NOT EXISTS 'trip_refund_processed';
ALTER TYPE public.wa_outbound_intent ADD VALUE IF NOT EXISTS 'trip_refund_rejected';

-- ---------------------------------------------------------------------------
-- 1. Tables and RLS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_booking_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trip_booking_id UUID NOT NULL REFERENCES public.trip_bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 300),
  method public.appointment_payment_method,
  method_other TEXT CHECK (char_length(method_other) <= 60),
  status public.appointment_refund_status NOT NULL DEFAULT 'pending',
  refunded_at TIMESTAMPTZ,
  rejection_reason TEXT CHECK (char_length(rejection_reason) <= 300),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  notice_sent_at TIMESTAMPTZ,
  CONSTRAINT trip_booking_refunds_processed_check CHECK (
    status <> 'processed' OR (method IS NOT NULL AND refunded_at IS NOT NULL)
  ),
  CONSTRAINT trip_booking_refunds_rejected_check CHECK (
    status <> 'rejected' OR NULLIF(btrim(rejection_reason), '') IS NOT NULL
  ),
  CONSTRAINT trip_booking_refunds_other_check CHECK (
    method IS DISTINCT FROM 'other' OR NULLIF(btrim(method_other), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_trip_booking_refunds_booking
  ON public.trip_booking_refunds (trip_booking_id);
CREATE INDEX IF NOT EXISTS idx_trip_booking_refunds_org_status
  ON public.trip_booking_refunds (organization_id, status);

CREATE TABLE IF NOT EXISTS public.trip_booking_refund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  refund_id UUID NOT NULL REFERENCES public.trip_booking_refunds(id) ON DELETE CASCADE,
  status public.appointment_refund_status NOT NULL,
  note TEXT CHECK (char_length(note) <= 300),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_booking_refund_events_refund
  ON public.trip_booking_refund_events (refund_id, changed_at);

COMMENT ON TABLE public.trip_booking_refunds IS
  'Refunds of a trip booking (TUR0011). Written only by register_trip_refund() and '
  'set_trip_refund_status(); never edited or deleted.';
COMMENT ON TABLE public.trip_booking_refund_events IS
  'History of each trip refund: every status it went through, who and when (TUR0011).';

ALTER TABLE public.trip_booking_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_booking_refund_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_booking_refunds, public.trip_booking_refund_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.trip_booking_refunds, public.trip_booking_refund_events FROM authenticated;
GRANT SELECT ON public.trip_booking_refunds, public.trip_booking_refund_events TO authenticated;

DROP POLICY IF EXISTS "Members read trip refunds of their org" ON public.trip_booking_refunds;
CREATE POLICY "Members read trip refunds of their org" ON public.trip_booking_refunds
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.auth_user_org_id()));

DROP POLICY IF EXISTS "License must be usable" ON public.trip_booking_refunds;
CREATE POLICY "License must be usable" ON public.trip_booking_refunds
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.auth_org_usable()))
  WITH CHECK ((SELECT public.auth_org_usable()));

DROP POLICY IF EXISTS "Members read trip refund history of their org" ON public.trip_booking_refund_events;
CREATE POLICY "Members read trip refund history of their org" ON public.trip_booking_refund_events
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.auth_user_org_id()));

DROP POLICY IF EXISTS "License must be usable" ON public.trip_booking_refund_events;
CREATE POLICY "License must be usable" ON public.trip_booking_refund_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.auth_org_usable()))
  WITH CHECK ((SELECT public.auth_org_usable()));

-- ---------------------------------------------------------------------------
-- 2. Totals and the deposit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trip_booking_amount_refunded(
  p_booking_id UUID,
  p_with_pending BOOLEAN DEFAULT false
)
RETURNS NUMERIC(10,2)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(r.amount), 0)
  FROM public.trip_booking_refunds r
  WHERE r.trip_booking_id = p_booking_id
    AND (r.status = 'processed' OR (p_with_pending AND r.status = 'pending'));
$function$;

-- Processed refunds covering a paid deposit mark it 'refunded' (sync_trip_deposit_status, 037,
-- never overwrites that state)
CREATE OR REPLACE FUNCTION public.refresh_trip_deposit_refunded(p_booking_id UUID)
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  UPDATE public.trip_bookings b
  SET deposit_status = 'refunded'
  WHERE b.id = p_booking_id
    AND COALESCE(b.deposit_amount, 0) > 0
    AND b.deposit_status = 'paid'
    AND public.trip_booking_amount_refunded(b.id) >= b.deposit_amount;
$function$;

REVOKE EXECUTE ON FUNCTION public.refresh_trip_deposit_refunded(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Register a refund. Any member, as pending; an owner/admin may register it already processed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_trip_refund(
  p_booking_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_method public.appointment_payment_method,
  p_method_other TEXT,
  p_processed BOOLEAN,
  p_refunded_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID := public.auth_user_org_id();
  v_manager BOOLEAN := COALESCE(public.auth_user_role() IN ('owner', 'admin'), false);
  v_processed BOOLEAN := COALESCE(p_processed, false);
  v_status public.trip_booking_status;
  v_trip_cancelled BOOLEAN;
  v_id UUID;
BEGIN
  IF v_org IS NULL OR NOT public.auth_org_usable() OR (v_processed AND NOT v_manager) THEN
    RAISE EXCEPTION 'refund_forbidden';
  END IF;

  SELECT b.status, t.cancelled_at IS NOT NULL INTO v_status, v_trip_cancelled
  FROM public.trip_bookings b
  JOIN public.trips t ON t.id = b.trip_id
  WHERE b.id = p_booking_id AND b.organization_id = v_org
  FOR UPDATE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_not_found';
  END IF;
  IF v_status NOT IN ('cancelled', 'no_show') AND NOT v_trip_cancelled THEN
    RAISE EXCEPTION 'refund_not_cancelled';
  END IF;
  IF NOT COALESCE((SELECT bs.refunds_enabled FROM public.business_settings bs
                   WHERE bs.organization_id = v_org), true) THEN
    RAISE EXCEPTION 'refunds_disabled';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0
     OR public.trip_booking_amount_refunded(p_booking_id, true) + p_amount
        > public.trip_booking_amount_paid(p_booking_id) THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL OR char_length(p_reason) > 300 THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;
  IF v_processed AND p_method IS NULL THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  IF p_refunded_at IS NOT NULL AND p_refunded_at > now() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'invalid_refunded_at';
  END IF;

  INSERT INTO public.trip_booking_refunds (
    organization_id, trip_booking_id, amount, reason, method, method_other, status,
    refunded_at, created_by, decided_by, decided_at
  )
  VALUES (
    v_org, p_booking_id, p_amount, btrim(p_reason), p_method,
    CASE WHEN p_method = 'other' THEN NULLIF(btrim(COALESCE(p_method_other, '')), '') END,
    CASE WHEN v_processed THEN 'processed' ELSE 'pending' END::public.appointment_refund_status,
    CASE WHEN v_processed THEN COALESCE(p_refunded_at, now()) END,
    auth.uid(),
    CASE WHEN v_processed THEN auth.uid() END,
    CASE WHEN v_processed THEN now() END
  )
  RETURNING id INTO v_id;

  INSERT INTO public.trip_booking_refund_events (organization_id, refund_id, status, changed_by)
  VALUES (v_org, v_id, CASE WHEN v_processed THEN 'processed' ELSE 'pending' END::public.appointment_refund_status,
          auth.uid());

  IF v_processed THEN
    PERFORM public.refresh_trip_deposit_refunded(p_booking_id);
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_trip_refund(
  UUID, NUMERIC, TEXT, public.appointment_payment_method, TEXT, BOOLEAN, TIMESTAMPTZ
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_trip_refund(
  UUID, NUMERIC, TEXT, public.appointment_payment_method, TEXT, BOOLEAN, TIMESTAMPTZ
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Process or reject a pending refund (owner or admin). Works with the switch off too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_trip_refund_status(
  p_refund_id UUID,
  p_status TEXT,
  p_note TEXT,
  p_method public.appointment_payment_method,
  p_method_other TEXT,
  p_refunded_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID := public.auth_user_org_id();
  v_refund public.trip_booking_refunds%ROWTYPE;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_org IS NULL OR NOT public.auth_org_usable()
     OR NOT COALESCE(public.auth_user_role() IN ('owner', 'admin'), false) THEN
    RAISE EXCEPTION 'refund_forbidden';
  END IF;
  IF p_status NOT IN ('processed', 'rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF char_length(v_note) > 300 OR (p_status = 'rejected' AND v_note IS NULL) THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;
  IF p_status = 'processed' AND p_method IS NULL THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  IF p_refunded_at IS NOT NULL AND p_refunded_at > now() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'invalid_refunded_at';
  END IF;

  SELECT * INTO v_refund FROM public.trip_booking_refunds
  WHERE id = p_refund_id AND organization_id = v_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_not_found';
  END IF;
  IF v_refund.status <> 'pending' THEN
    RAISE EXCEPTION 'refund_not_pending';
  END IF;

  IF p_status = 'processed' THEN
    UPDATE public.trip_booking_refunds
    SET status = 'processed',
        method = p_method,
        method_other = CASE WHEN p_method = 'other' THEN NULLIF(btrim(COALESCE(p_method_other, '')), '') END,
        refunded_at = COALESCE(p_refunded_at, now()),
        decided_by = auth.uid(),
        decided_at = now()
    WHERE id = p_refund_id;
  ELSE
    UPDATE public.trip_booking_refunds
    SET status = 'rejected', rejection_reason = v_note, decided_by = auth.uid(), decided_at = now()
    WHERE id = p_refund_id;
  END IF;

  INSERT INTO public.trip_booking_refund_events (organization_id, refund_id, status, note, changed_by)
  VALUES (v_org, p_refund_id, p_status::public.appointment_refund_status, v_note, auth.uid());

  IF p_status = 'processed' THEN
    PERFORM public.refresh_trip_deposit_refunded(v_refund.trip_booking_id);
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_trip_refund_status(
  UUID, TEXT, TEXT, public.appointment_payment_method, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_trip_refund_status(
  UUID, TEXT, TEXT, public.appointment_payment_method, TEXT, TIMESTAMPTZ
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Voiding a payment can't leave refunds above what was paid (098 + one check)
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
  IF public.trip_booking_amount_refunded(v_pay.trip_booking_id, true)
     > public.trip_booking_amount_paid(v_pay.trip_booking_id) - v_pay.amount THEN
    RAISE EXCEPTION 'payment_refunded';
  END IF;

  UPDATE public.trip_booking_payments
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  WHERE id = p_payment_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. WhatsApp to the passenger when a refund is processed or rejected
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_wa_trip_refund_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF NEW.status = 'pending' OR (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT bs.enable_payment_reminders AND bs.whatsapp_integration_enabled
    INTO v_enabled
  FROM public.business_settings bs
  WHERE bs.organization_id = NEW.organization_id;
  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_supabase_url FROM public.app_config WHERE key = 'SUPABASE_URL';
  SELECT value INTO v_service_key FROM public.app_config WHERE key = 'SUPABASE_SERVICE_ROLE_KEY';
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'wa-trip-send: app_config falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/wa-trip-send',
    body := jsonb_build_object(
      'bookingId', NEW.trip_booking_id,
      'intent', CASE WHEN NEW.status = 'processed' THEN 'trip_refund_processed' ELSE 'trip_refund_rejected' END,
      'refundId', NEW.id
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_wa_trip_refund_notice ON public.trip_booking_refunds;
CREATE TRIGGER trg_wa_trip_refund_notice
  AFTER INSERT OR UPDATE OF status ON public.trip_booking_refunds
  FOR EACH ROW EXECUTE FUNCTION public.trigger_wa_trip_refund_notice();
