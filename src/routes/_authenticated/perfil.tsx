import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/hooks/useSesion";
import { fechaLarga, fechaHora } from "@/lib/fechas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — CRTM Parking Manager" },
      {
        name: "description",
        content:
          "Consulta tus datos, tu unidad, tus matrículas autorizadas, tus reservas y tus incidencias en el aparcamiento del CRTM.",
      },
      { property: "og:title", content: "Mi perfil — CRTM Parking Manager" },
      {
        property: "og:description",
        content: "Datos del empleado, matrículas autorizadas y reservas activas.",
      },
    ],
  }),
  component: Perfil,
});

const nombreRol: Record<string, string> = {
  admin: "Admin",
  titular: "Usuario Titular",
  estandar: "Usuario Estándar",
};


function Perfil() {
  const { data: sesion } = useSesion();

  const { data: reservas = [] } = useQuery({
    queryKey: ["mis-reservas", sesion?.userId],
    enabled: !!sesion?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, parking_spots(numero_plaza)")
        .eq("user_id", sesion!.userId)
        .order("fecha_reserva", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as {
        id: string;
        fecha_reserva: string;
        matricula_usada: string;
        status: string;
        parking_spots: { numero_plaza: number } | null;
      }[];
    },
  });

  const { data: sanciones = [] } = useQuery({
    queryKey: ["mis-sanciones", sesion?.userId],
    enabled: !!sesion?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sanctions")
        .select("*")
        .eq("user_id", sesion!.userId)
        .order("fecha_infraccion", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!sesion) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del empleado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <Dato etiqueta="Nombre y apellidos" valor={sesion.perfil?.nombre_apellidos ?? "—"} />
          <Dato etiqueta="Login de MD" valor={sesion.perfil?.login_md ?? "—"} />
          <Dato etiqueta="Unidad / División" valor={sesion.unidad ?? "—"} />
          <Dato
            etiqueta="Responsable de Unidad"
            valor={sesion.perfil?.es_responsable ? "Sí" : "No"}
          />
          <Dato
            etiqueta="Rol en el sistema"
            valor={sesion.roles.map((r) => nombreRol[r] ?? r).join(", ") || "Empleado"}
          />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Matrículas autorizadas
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {sesion.matriculas.length ? (
                sesion.matriculas.map((m) => (
                  <Badge key={m} variant="secondary">
                    {m}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Ninguna registrada</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CambioPassword email={sesion.email} />



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de reservas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reservas.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no tienes reservas.</p>
          )}
          {reservas.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="capitalize">{fechaLarga(r.fecha_reserva)}</span>
              <span className="text-muted-foreground">
                Plaza {r.parking_spots?.numero_plaza} · {r.matricula_usada}
              </span>
              <Badge
                variant={
                  r.status === "activa"
                    ? "default"
                    : r.status === "anulada_tardia"
                      ? "destructive"
                      : "secondary"
                }
              >
                {r.status === "anulada_tardia" ? "Anulación tardía" : r.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sanciones registradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sanciones.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin sanciones. 👍</p>
          )}
          {sanciones.map((s) => (
            <div key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{s.tipo_sancion.replaceAll("_", " ")}</span>
                <span className="text-xs text-muted-foreground">
                  Infracción: {fechaHora(s.fecha_infraccion)}
                </span>
              </div>
              {s.fecha_inicio_bloqueo && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Bloqueo de {s.dias_bloqueo} día(s) del {s.fecha_inicio_bloqueo} al{" "}
                  {s.fecha_fin_bloqueo} (aplicación diferida 2 semanas).
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const esquemaPassword = z
  .object({
    actual: z.string().min(6, "Introduce tu contraseña actual").max(72),
    nueva: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres").max(72),
    confirmar: z.string().min(8).max(72),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: "La confirmación no coincide con la nueva contraseña",
    path: ["confirmar"],
  })
  .refine((d) => d.nueva !== d.actual, {
    message: "La nueva contraseña debe ser distinta de la actual",
    path: ["nueva"],
  });

function CambioPassword({ email }: { email: string | null }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("No se ha podido determinar tu correo corporativo.");
      return;
    }
    const parsed = esquemaPassword.safeParse({ actual, nueva, confirmar });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    setCargando(true);
    // Verificación de la contraseña actual antes de actualizar.
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.actual,
    });
    if (errorLogin) {
      setCargando(false);
      toast.error("La contraseña actual no es correcta.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.nueva });
    setCargando(false);
    if (error) {
      toast.error("No se pudo actualizar la contraseña.");
      return;
    }
    setActual("");
    setNueva("");
    setConfirmar("");
    toast.success("Contraseña actualizada correctamente.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={cambiar} className="grid gap-4 sm:max-w-md">
          <div className="space-y-2">
            <Label htmlFor="pw-actual">Contraseña actual</Label>
            <Input
              id="pw-actual"
              type="password"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              maxLength={72}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-nueva">Nueva contraseña</Label>
            <Input
              id="pw-nueva"
              type="password"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              maxLength={72}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-conf">Confirmar nueva contraseña</Label>
            <Input
              id="pw-conf"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              maxLength={72}
            />
          </div>
          <Button type="submit" disabled={cargando} className="justify-self-start">
            {cargando ? "Actualizando…" : "Actualizar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 font-medium">{valor}</p>
    </div>
  );
}
