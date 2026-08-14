CREATE OR REPLACE FUNCTION public.esta_bloqueado(_user_id uuid, _fecha date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.sanctions
    WHERE user_id = _user_id
      AND (
        tipo_sancion = 'retirada_definitiva'
        OR (
          fecha_inicio_bloqueo IS NOT NULL
          AND _fecha >= fecha_inicio_bloqueo
          AND (fecha_fin_bloqueo IS NULL OR _fecha <= fecha_fin_bloqueo)
        )
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.esta_bloqueado(uuid, date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.es_titular_plaza(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_unidad(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_sancion_fechas() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ocupacion_dia(date) FROM anon;