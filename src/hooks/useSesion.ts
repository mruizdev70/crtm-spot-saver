import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Rol = "empleado" | "responsable" | "admin" | "autoridad";

export interface Perfil {
  id: string;
  login_md: string;
  nombre_apellidos: string;
  unidad_id: string | null;
  es_responsable: boolean;
  created_at: string;
}

export interface Sesion {
  userId: string;
  email: string | null;
  perfil: Perfil | null;
  unidad: string | null;
  roles: Rol[];
  esStaff: boolean;
  matriculas: string[];
}

export function useSesion() {
  return useQuery<Sesion | null>({
    queryKey: ["sesion"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: perfil }, { data: roles }, { data: matriculas }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*, unidades(nombre_unidad)")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("matriculas").select("matricula").eq("user_id", user.id),
      ]);

      const listaRoles = ((roles ?? []).map((r) => r.role) as Rol[]) ?? [];
      const p = perfil as (Perfil & { unidades: { nombre_unidad: string } | null }) | null;

      return {
        userId: user.id,
        email: user.email ?? null,
        perfil: p,
        unidad: p?.unidades?.nombre_unidad ?? null,
        roles: listaRoles,
        esStaff: listaRoles.includes("admin") || listaRoles.includes("autoridad"),
        matriculas: (matriculas ?? []).map((m) => m.matricula),
      };
    },
  });
}
