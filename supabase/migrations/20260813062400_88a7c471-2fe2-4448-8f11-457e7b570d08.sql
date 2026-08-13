DROP POLICY IF EXISTS reservations_read ON public.reservations;

CREATE POLICY reservations_read_own ON public.reservations
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.ocupacion_dia(_fecha date)
RETURNS TABLE (spot_id uuid, ocupada boolean, es_mia boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.spot_id, true AS ocupada, (r.user_id = auth.uid()) AS es_mia
  FROM public.reservations r
  WHERE r.fecha_reserva = _fecha AND r.status = 'activa';
$$;

REVOKE ALL ON FUNCTION public.ocupacion_dia(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocupacion_dia(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocupacion_dia(date) TO service_role;