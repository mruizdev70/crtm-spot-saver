-- 1) Bloquear modificaciones de fechas pasadas a no administradores
DROP POLICY IF EXISTS reservations_insert_own ON public.reservations;
CREATE POLICY reservations_insert_own ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.esta_bloqueado(auth.uid(), fecha_reserva)
    AND (
      public.is_staff(auth.uid())
      OR fecha_reserva >= (now() AT TIME ZONE 'Europe/Madrid')::date
    )
  );

DROP POLICY IF EXISTS reservations_update_own ON public.reservations;
CREATE POLICY reservations_update_own ON public.reservations
  FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (
      user_id = auth.uid()
      AND fecha_reserva >= (now() AT TIME ZONE 'Europe/Madrid')::date
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    OR (
      user_id = auth.uid()
      AND fecha_reserva >= (now() AT TIME ZONE 'Europe/Madrid')::date
    )
  );

-- 2) Ocupación diaria: exponer solo el Login de MD (sin nombre ni matrícula)
DROP FUNCTION IF EXISTS public.ocupacion_dia(date);
CREATE FUNCTION public.ocupacion_dia(_fecha date)
RETURNS TABLE(spot_id uuid, ocupada boolean, es_mia boolean, login_md text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.spot_id,
         true AS ocupada,
         (r.user_id = auth.uid()) AS es_mia,
         p.login_md
  FROM public.reservations r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.fecha_reserva = _fecha AND r.status = 'activa';
$$;

REVOKE ALL ON FUNCTION public.ocupacion_dia(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocupacion_dia(date) TO authenticated;