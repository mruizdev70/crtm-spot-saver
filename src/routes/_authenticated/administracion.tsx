import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/hooks/useSesion";
import { actualizarUsuario, crearUsuario } from "@/lib/admin.functions";
import { fechaHora, iso } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/administracion")({
  head: () => ({
    meta: [
      { title: "Administración — CRTM Parking Manager" },
      {
        name: "description",
        content:
          "Alta de usuarios, control diario de ocupación, sanciones diferidas y auditoría del aparcamiento del CRTM.",
      },
      { property: "og:title", content: "Administración — CRTM Parking Manager" },
      {
        property: "og:description",
        content: "Panel de Asuntos Generales y Autoridad del aparcamiento del CRTM.",
      },
    ],
  }),
  component: Administracion,
});

const ROLES = [
  { valor: "admin", texto: "Admin · Control total" },
  { valor: "titular", texto: "Usuario Titular · Plaza fija asignada" },
  { valor: "estandar", texto: "Usuario Estándar · Fase libre" },
] as const;

const NOMBRE_ROL: Record<string, string> = {
  admin: "Admin",
  titular: "Usuario Titular",
  estandar: "Usuario Estándar",
};


const TIPOS_SANCION = [
  { valor: "advertencia_verbal", texto: "1) Advertencia verbal" },
  { valor: "advertencia_escrito", texto: "2) Advertencia por escrito" },
  { valor: "retirada_temporal", texto: "3) Retirada temporal de reservas" },
  { valor: "retirada_definitiva", texto: "4) Retirada definitiva" },
] as const;

function Administracion() {
  const { data: sesion } = useSesion();

  if (sesion && !sesion.esStaff) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Esta sección está reservada a Asuntos Generales y a la Jefatura de Coordinación de
          Administración.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
      <Tabs defaultValue="usuarios">
        <TabsList className="flex-wrap">
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="unidades">Gestión de Unidades</TabsTrigger>
          <TabsTrigger value="plazas">Plazas y titulares</TabsTrigger>
          <TabsTrigger value="ocupacion">Control diario</TabsTrigger>
          <TabsTrigger value="sanciones">Sanciones</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-4">
          <Usuarios />
        </TabsContent>
        <TabsContent value="unidades" className="mt-4">
          <Unidades />
        </TabsContent>
        <TabsContent value="plazas" className="mt-4">
          <Plazas />
        </TabsContent>
        <TabsContent value="ocupacion" className="mt-4">
          <Ocupacion />
        </TabsContent>
        <TabsContent value="sanciones" className="mt-4">
          <Sanciones />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4">
          <Auditoria />
        </TabsContent>

      </Tabs>
    </div>
  );
}

interface FilaUsuario {
  id: string;
  login_md: string;
  nombre_apellidos: string;
  unidad_id: string | null;
  es_responsable: boolean;
  unidades: { nombre_unidad: string } | null;
}

function useUnidades() {
  return useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nombre_unidad")
        .order("nombre_unidad");
      if (error) throw error;
      return data;
    },
  });
}

function Usuarios() {
  const queryClient = useQueryClient();
  const { data: unidades = [] } = useUnidades();
  const crear = useServerFn(crearUsuario);
  const actualizar = useServerFn(actualizarUsuario);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<FilaUsuario | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    login_md: "",
    nombre_apellidos: "",
    unidad_id: "",
    es_responsable: false,
    rol: "estandar",
    m1: "",
    m2: "",
    m3: "",
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, unidades(nombre_unidad)")
        .order("nombre_apellidos");
      if (error) throw error;
      return data as unknown as FilaUsuario[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-todas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriculas").select("user_id, matricula");
      if (error) throw error;
      return data;
    },
  });

  function abrirNuevo() {
    setEditando(null);
    setForm({
      email: "",
      password: "",
      login_md: "",
      nombre_apellidos: "",
      unidad_id: unidades[0]?.id ?? "",
      es_responsable: false,
      rol: "estandar",
      m1: "",
      m2: "",
      m3: "",
    });
    setAbierto(true);
  }

  function abrirEdicion(u: FilaUsuario) {
    const ms = matriculas.filter((m) => m.user_id === u.id).map((m) => m.matricula);
    setEditando(u);
    setForm({
      email: "",
      password: "",
      login_md: u.login_md,
      nombre_apellidos: u.nombre_apellidos,
      unidad_id: u.unidad_id ?? "",
      es_responsable: u.es_responsable,
      rol: roles.find((r) => r.user_id === u.id)?.role ?? "estandar",
      m1: ms[0] ?? "",
      m2: ms[1] ?? "",
      m3: ms[2] ?? "",
    });
    setAbierto(true);
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        login_md: form.login_md,
        nombre_apellidos: form.nombre_apellidos,
        unidad_id: form.unidad_id || null,
        es_responsable: form.es_responsable,
        rol: form.rol as "admin" | "titular" | "estandar",
        matriculas: [form.m1, form.m2, form.m3].filter((m) => m.trim().length >= 4),
      };
      if (editando) {
        return actualizar({ data: { ...payload, user_id: editando.id } });
      }
      return crear({ data: { ...payload, email: form.email, password: form.password } });
    },
    onSuccess: () => {
      toast.success(editando ? "Usuario actualizado" : "Usuario creado");
      setAbierto(false);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["roles-todos"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas-todas"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el usuario."),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Alta y edición de usuarios</CardTitle>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo usuario
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Login MD</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Resp.</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Matrículas</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nombre_apellidos}</TableCell>
                <TableCell>{u.login_md}</TableCell>
                <TableCell>{u.unidades?.nombre_unidad ?? "—"}</TableCell>
                <TableCell>{u.es_responsable ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {NOMBRE_ROL[roles.find((r) => r.user_id === u.id)?.role ?? "estandar"]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {matriculas
                    .filter((m) => m.user_id === u.id)
                    .map((m) => m.matricula)
                    .join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => abrirEdicion(u)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editando && (
              <>
                <Campo
                  label="Email corporativo"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                <Campo
                  label="Contraseña inicial"
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })}
                />
              </>
            )}
            <Campo
              label="Login de MD"
              value={form.login_md}
              onChange={(v) => setForm({ ...form, login_md: v })}
            />
            <Campo
              label="Nombre y apellidos"
              value={form.nombre_apellidos}
              onChange={(v) => setForm({ ...form, nombre_apellidos: v })}
            />
            <div className="space-y-1.5">
              <Label>Unidad / División</Label>
              <Select
                value={form.unidad_id}
                onValueChange={(v) => setForm({ ...form, unidad_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre_unidad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="resp"
                checked={form.es_responsable}
                onCheckedChange={(v) => setForm({ ...form, es_responsable: v === true })}
              />
              <Label htmlFor="resp">¿Es Responsable de Unidad?</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Rol del sistema</Label>
              <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.valor} value={r.valor}>
                      {r.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Campo
                label="Matrícula 1"
                value={form.m1}
                onChange={(v) => setForm({ ...form, m1: v.toUpperCase() })}
              />
              <Campo
                label="Matrícula 2"
                value={form.m2}
                onChange={(v) => setForm({ ...form, m2: v.toUpperCase() })}
              />
              <Campo
                label="Matrícula 3"
                value={form.m3}
                onChange={(v) => setForm({ ...form, m3: v.toUpperCase() })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button disabled={guardar.isPending} onClick={() => guardar.mutate()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} />
    </div>
  );
}

function Ocupacion() {
  const [fecha, setFecha] = useState(iso(new Date()));

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parking_spots")
        .select("id, numero_plaza, unidades(nombre_unidad)")
        .order("numero_plaza");
      if (error) throw error;
      return data as unknown as {
        id: string;
        numero_plaza: number;
        unidades: { nombre_unidad: string } | null;
      }[];
    },
  });

  const { data: reservas = [] } = useQuery({
    queryKey: ["ocupacion", fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("spot_id, matricula_usada, status, profiles(nombre_apellidos, login_md)")
        .eq("fecha_reserva", fecha);
      if (error) throw error;
      return data as unknown as {
        spot_id: string;
        matricula_usada: string;
        status: string;
        profiles: { nombre_apellidos: string; login_md: string } | null;
      }[];
    },
  });

  const filas = plazas.map((p) => {
    const r = reservas.find((x) => x.spot_id === p.id && x.status === "activa");
    return {
      plaza: p.numero_plaza,
      unidad: p.unidades?.nombre_unidad ?? "—",
      usuario: r?.profiles?.nombre_apellidos ?? "—",
      login: r?.profiles?.login_md ?? "—",
      matricula: r?.matricula_usada ?? "—",
      estado: r ? "Ocupada" : "Libre",
    };
  });

  function exportar() {
    const csv = [
      "Plaza;Unidad;Usuario;Login MD;Matricula;Estado",
      ...filas.map((f) => [f.plaza, f.unidad, f.usuario, f.login, f.matricula, f.estado].join(";")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocupacion-crtm-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Control diario de ocupación</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-auto"
          />
          <Button variant="secondary" size="sm" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N.º Plaza</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Login MD</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.plaza}>
                <TableCell className="font-medium">{f.plaza}</TableCell>
                <TableCell>{f.unidad}</TableCell>
                <TableCell>{f.usuario}</TableCell>
                <TableCell>{f.login}</TableCell>
                <TableCell>{f.matricula}</TableCell>
                <TableCell>
                  <Badge variant={f.estado === "Ocupada" ? "destructive" : "secondary"}>
                    {f.estado}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Sanciones() {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const [form, setForm] = useState({
    user_id: "",
    tipo_sancion: "advertencia_verbal",
    dias_bloqueo: "0",
    motivo: "no_show",
    fecha_infraccion: iso(new Date()),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre_apellidos, login_md")
        .order("nombre_apellidos");
      if (error) throw error;
      return data;
    },
  });

  const { data: sanciones = [] } = useQuery({
    queryKey: ["sanciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sanctions")
        .select("*, profiles(nombre_apellidos, login_md)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as {
        id: string;
        tipo_sancion: string;
        dias_bloqueo: number;
        motivo: string | null;
        fecha_infraccion: string;
        fecha_inicio_bloqueo: string | null;
        fecha_fin_bloqueo: string | null;
        profiles: { nombre_apellidos: string; login_md: string } | null;
      }[];
    },
  });

  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sanctions").insert({
        user_id: form.user_id,
        tipo_sancion: form.tipo_sancion,
        dias_bloqueo: Number(form.dias_bloqueo) || 0,
        motivo: form.motivo,
        fecha_infraccion: form.fecha_infraccion,
        created_by: sesion?.userId ?? null,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: sesion!.userId,
        accion: "registro_sancion",
        detalles: { sancionado: form.user_id, tipo: form.tipo_sancion, motivo: form.motivo },
      });
    },
    onSuccess: () => {
      toast.success("Sanción registrada. El bloqueo se aplicará 2 semanas después.");
      queryClient.invalidateQueries({ queryKey: ["sanciones"] });
    },
    onError: () => toast.error("No se pudo registrar la sanción."),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar infracción</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Usuario</Label>
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona usuario" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre_apellidos} ({u.login_md})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={form.motivo} onValueChange={(v) => setForm({ ...form, motivo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_show">No-Show (plaza no ocupada)</SelectItem>
                <SelectItem value="anulacion_tardia">Anulación tardía (&gt;20:00h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de sanción</Label>
            <Select
              value={form.tipo_sancion}
              onValueChange={(v) => setForm({ ...form, tipo_sancion: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_SANCION.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Días de bloqueo (retirada temporal)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={form.dias_bloqueo}
              onChange={(e) => setForm({ ...form, dias_bloqueo: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de la infracción</Label>
            <Input
              type="date"
              value={form.fecha_infraccion}
              onChange={(e) => setForm({ ...form, fecha_infraccion: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!form.user_id || registrar.isPending}
              onClick={() => registrar.mutate()}
            >
              Registrar sanción
            </Button>
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Aplicación diferida: el bloqueo comienza automáticamente 2 semanas después de la fecha
            de la infracción, protegiendo las reservas vigentes del usuario.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sanciones registradas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Infracción</TableHead>
                <TableHead>Bloqueo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sanciones.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.profiles?.nombre_apellidos ?? "—"}</TableCell>
                  <TableCell className="capitalize">{s.tipo_sancion.replaceAll("_", " ")}</TableCell>
                  <TableCell className="capitalize">
                    {(s.motivo ?? "—").replaceAll("_", " ")}
                  </TableCell>
                  <TableCell>{s.fecha_infraccion}</TableCell>
                  <TableCell>
                    {s.fecha_inicio_bloqueo
                      ? `${s.dias_bloqueo} día(s): ${s.fecha_inicio_bloqueo} → ${s.fecha_fin_bloqueo}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Auditoria() {
  const { data: logs = [] } = useQuery({
    queryKey: ["auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles(nombre_apellidos, login_md)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as {
        id: string;
        accion: string;
        detalles: Record<string, unknown> | null;
        created_at: string;
        profiles: { nombre_apellidos: string; login_md: string } | null;
      }[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registro de auditoría</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha / hora</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap">{fechaHora(l.created_at)}</TableCell>
                <TableCell>{l.profiles?.nombre_apellidos ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={l.accion.includes("tardia") ? "destructive" : "secondary"}
                    className="capitalize"
                  >
                    {l.accion.replaceAll("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.detalles ? JSON.stringify(l.detalles) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
