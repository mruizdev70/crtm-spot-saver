import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LogOut, ShieldCheck, User, BookOpen } from "lucide-react";
import logo from "@/assets/crtm-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/hooks/useSesion";

const enlaces = [
  { to: "/reservas", label: "Reservas", icon: CalendarDays },
  { to: "/perfil", label: "Mi perfil", icon: User },
  { to: "/informacion", label: "Normativa", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: sesion } = useSesion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/reservas" className="flex items-center gap-3">
            <img src={logo.url} alt="Consorcio Regional de Transportes de Madrid" className="h-9 w-auto" />
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              Parking Manager
              <span className="block text-xs font-normal text-muted-foreground">Avda. Asturias 4</span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:ml-4">
            {enlaces.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            {sesion?.esStaff && (
              <Link
                to="/administracion"
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <ShieldCheck className="h-4 w-4" />
                Administración
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {sesion?.perfil && (
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium leading-tight">{sesion.perfil.nombre_apellidos}</p>
                <p className="text-xs text-muted-foreground">{sesion.unidad ?? "Sin unidad"}</p>
              </div>
            )}
            {sesion?.esStaff && <Badge variant="secondary">Staff</Badge>}
            <Button variant="ghost" size="icon" onClick={salir} aria-label="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-muted-foreground">
        Consorcio Regional de Transportes de Madrid · Uso interno · 15 plazas · Avda. Asturias 4
      </footer>
    </div>
  );
}
