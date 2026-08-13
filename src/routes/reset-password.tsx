import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/crtm-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — CRTM Parking Manager" },
      {
        name: "description",
        content:
          "Define una nueva contraseña de acceso al gestor de aparcamiento de empleados del CRTM en Avda. Asturias 4.",
      },
      { property: "og:title", content: "Restablecer contraseña — CRTM Parking Manager" },
      {
        property: "og:description",
        content: "Establece una nueva contraseña con el enlace temporal recibido por correo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RestablecerPassword,
});

const esquema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirmar: z.string().min(8).max(72),
  })
  .refine((d) => d.password === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

function RestablecerPassword() {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setListo(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setListo(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = esquema.safeParse({ password, confirmar });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setCargando(false);
    if (error) {
      toast.error("No se pudo actualizar la contraseña. Solicita un nuevo enlace.");
      return;
    }
    toast.success("Contraseña actualizada correctamente.");
    navigate({ to: "/reservas", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <img
            src={logo.url}
            alt="Consorcio Regional de Transportes de Madrid"
            className="h-16 w-auto"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Nueva contraseña</h1>
        </div>

        <form onSubmit={guardar} className="surface-panel space-y-4 p-6">
          {!listo && (
            <p className="text-xs text-muted-foreground">
              Abre esta página desde el enlace del correo de restablecimiento para poder guardar la
              nueva contraseña.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="np">Nueva contraseña</Label>
            <Input
              id="np"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp">Confirmar nueva contraseña</Label>
            <Input
              id="cp"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              maxLength={72}
            />
          </div>
          <Button type="submit" className="w-full" disabled={cargando || !listo}>
            {cargando ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}
