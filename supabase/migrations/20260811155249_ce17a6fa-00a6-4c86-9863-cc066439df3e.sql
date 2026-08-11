-- 1. Nuevo enum de roles
CREATE TYPE public.app_role_new AS ENUM ('admin', 'titular', 'estandar');

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role_new
  USING (CASE
    WHEN role::text = 'admin' THEN 'admin'
    WHEN role::text IN ('autoridad', 'responsable') THEN 'titular'
    ELSE 'estandar'
  END)::public.app_role_new;

DROP TYPE public.app_role;
ALTER TYPE public.app_role_new RENAME TO app_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- is_staff pasa a significar exclusivamente Admin
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2. Titulares por plaza (varios titulares por plaza fija)
CREATE TABLE public.spot_titulares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES public.parking_spots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spot_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spot_titulares TO authenticated;
GRANT ALL ON public.spot_titulares TO service_role;

ALTER TABLE public.spot_titulares ENABLE ROW LEVEL SECURITY;

CREATE POLICY spot_titulares_read ON public.spot_titulares
  FOR SELECT TO authenticated USING (true);

CREATE POLICY spot_titulares_admin ON public.spot_titulares
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 3. Función auxiliar: ¿es titular de esta plaza?
CREATE OR REPLACE FUNCTION public.es_titular_plaza(_user_id uuid, _spot_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.spot_titulares WHERE user_id = _user_id AND spot_id = _spot_id);
$$;

REVOKE ALL ON FUNCTION public.es_titular_plaza(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_titular_plaza(uuid, uuid) TO authenticated;