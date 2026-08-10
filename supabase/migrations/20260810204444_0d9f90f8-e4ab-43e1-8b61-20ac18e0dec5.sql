
-- ROLES
CREATE TYPE public.app_role AS ENUM ('empleado','responsable','admin','autoridad');

CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_unidad text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login_md text NOT NULL UNIQUE,
  nombre_apellidos text NOT NULL,
  unidad_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  es_responsable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','autoridad'));
$$;

CREATE OR REPLACE FUNCTION public.my_unidad(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unidad_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matricula text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, matricula)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matriculas TO authenticated;
GRANT ALL ON public.matriculas TO service_role;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.parking_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_plaza int NOT NULL UNIQUE,
  unidad_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_spots TO authenticated;
GRANT ALL ON public.parking_spots TO service_role;
ALTER TABLE public.parking_spots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES public.parking_spots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matricula_usada text NOT NULL,
  fecha_reserva date NOT NULL,
  status text NOT NULL DEFAULT 'activa',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reservations_spot_fecha_activa ON public.reservations (spot_id, fecha_reserva) WHERE status = 'activa';
CREATE UNIQUE INDEX reservations_user_fecha_activa ON public.reservations (user_id, fecha_reserva) WHERE status = 'activa';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.waitlist_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha_deseada date NOT NULL,
  endpoint_push jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fecha_deseada)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_notifications TO authenticated;
GRANT ALL ON public.waitlist_notifications TO service_role;
ALTER TABLE public.waitlist_notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_sancion text NOT NULL,
  dias_bloqueo int NOT NULL DEFAULT 0,
  motivo text,
  fecha_infraccion date NOT NULL DEFAULT current_date,
  fecha_inicio_bloqueo date,
  fecha_fin_bloqueo date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sanctions TO authenticated;
GRANT ALL ON public.sanctions TO service_role;
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accion text NOT NULL,
  detalles jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Sanciones diferidas: bloqueo empieza 2 semanas después
CREATE OR REPLACE FUNCTION public.set_sancion_fechas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.dias_bloqueo > 0 THEN
    NEW.fecha_inicio_bloqueo := COALESCE(NEW.fecha_inicio_bloqueo, NEW.fecha_infraccion + INTERVAL '14 days')::date;
    NEW.fecha_fin_bloqueo := COALESCE(NEW.fecha_fin_bloqueo, NEW.fecha_inicio_bloqueo + (NEW.dias_bloqueo - 1) * INTERVAL '1 day')::date;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_sancion_fechas BEFORE INSERT ON public.sanctions
FOR EACH ROW EXECUTE FUNCTION public.set_sancion_fechas();

CREATE OR REPLACE FUNCTION public.esta_bloqueado(_user_id uuid, _fecha date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sanctions
    WHERE user_id = _user_id
      AND (tipo_sancion = 'retirada_definitiva'
           OR (fecha_inicio_bloqueo IS NOT NULL AND _fecha BETWEEN fecha_inicio_bloqueo AND fecha_fin_bloqueo))
  );
$$;

-- POLICIES
CREATE POLICY "unidades_read" ON public.unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "unidades_admin" ON public.unidades FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin" ON public.profiles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "matriculas_own" ON public.matriculas FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "matriculas_admin" ON public.matriculas FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "spots_read" ON public.parking_spots FOR SELECT TO authenticated USING (true);
CREATE POLICY "spots_admin" ON public.parking_spots FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "reservations_read" ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "reservations_insert_own" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.esta_bloqueado(auth.uid(), fecha_reserva));
CREATE POLICY "reservations_update_own" ON public.reservations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "reservations_delete_staff" ON public.reservations FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "waitlist_own" ON public.waitlist_notifications FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (user_id = auth.uid());

CREATE POLICY "sanctions_read" ON public.sanctions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "sanctions_admin" ON public.sanctions FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "audit_read_staff" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- SEED
INSERT INTO public.unidades (nombre_unidad) VALUES
 ('Dirección Gerencia'),
 ('Asuntos Generales'),
 ('Planificación del Transporte'),
 ('Explotación'),
 ('Estudios y Tarifas'),
 ('Informática y Sistemas'),
 ('Comunicación'),
 ('Régimen Jurídico');

INSERT INTO public.parking_spots (numero_plaza, unidad_id)
SELECT n, (SELECT id FROM public.unidades WHERE nombre_unidad = u)
FROM (VALUES
 (1,'Dirección Gerencia'),(2,'Dirección Gerencia'),
 (3,'Asuntos Generales'),(4,'Asuntos Generales'),
 (5,'Planificación del Transporte'),(6,'Planificación del Transporte'),
 (7,'Explotación'),(8,'Explotación'),
 (9,'Estudios y Tarifas'),(10,'Estudios y Tarifas'),
 (11,'Informática y Sistemas'),(12,'Informática y Sistemas'),
 (13,'Comunicación'),(14,'Comunicación'),
 (15,'Régimen Jurídico')
) AS t(n,u);
