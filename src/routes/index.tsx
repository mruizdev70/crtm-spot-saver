import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/crtm-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CRTM Parking Manager — Acceso empleados" },
      {
        name: "description",
        content:
          "Aplicación interna del Consorcio Regional de Transportes de Madrid para la gestión de las 15 plazas de aparcamiento de Avda. Asturias 4.",
      },
      { property: "og:title", content: "CRTM Parking Manager — Acceso empleados" },
      {
        property: "og:description",
        content: "Gestión interna del aparcamiento de empleados del CRTM en Avda. Asturias 4.",
      },
    ],
  }),
  component: Login,
});

const esquema = z.object({
  login: z.string().trim().min(3, "Introduce tu Login de MD").max(255),
  password: z.string().min(6, "Contraseña demasiado corta").max(72),
});

function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/reservas", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = esquema.safeParse({ login, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    setCargando(true);
    const email = parsed.data.login.includes("@")
      ? parsed.data.login
      : `${parsed.data.login}@crtm.es`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });
    setCargando(false);
    if (error) {
      toast.error("Credenciales no válidas o usuario no dado de alta.");
      return;
    }
    await queryClient.invalidateQueries();
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CRTM Parking Manager</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aparcamiento de empleados · Avda. Asturias 4
            </p>
          </div>
        </div>

        <form onSubmit={entrar} className="surface-panel space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="login">Login de MD</Label>
            <Input
              id="login"
              autoComplete="username"
              placeholder="nombre.apellido"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
            />
          </div>
          <Button type="submit" className="w-full" disabled={cargando}>
            {cargando ? "Accediendo…" : "Acceder"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => setRecuperar(true)}
          >
            ¿Olvidaste tu contraseña?
          </button>
          <p className="text-center text-xs text-muted-foreground">
            El registro público está desactivado. Las altas las realiza Asuntos Generales.
          </p>
        </form>

        <Dialog open={recuperar} onOpenChange={setRecuperar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restablecer contraseña</DialogTitle>
              <DialogDescription>
                Introduce tu Login de MD o tu correo corporativo y te enviaremos un enlace de un
                solo uso para definir una nueva contraseña.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="recu">Login de MD / email</Label>
              <Input
                id="recu"
                value={loginRecu}
                onChange={(e) => setLoginRecu(e.target.value)}
                placeholder="nombre.apellido"
                maxLength={255}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRecuperar(false)}>
                Cancelar
              </Button>
              <Button onClick={enviarRecuperacion} disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar enlace"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
