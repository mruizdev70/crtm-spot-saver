import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { Bell, Car, ChevronLeft, ChevronRight, Copy, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/hooks/useSesion";
import {
  diasLaborables,
  esAnulacionTardia,
  faseDeSemana,
  fechaCorta,
  fechaLarga,
  inicioSemana,
  iso,
} from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas de plaza — CRTM Parking Manager" },
      {
        name: "description",
        content:
          "Reserva y anula plazas del aparcamiento de empleados del CRTM en Avda. Asturias 4 según la normativa interna.",
      },
      { property: "og:title", content: "Reservas de plaza — CRTM Parking Manager" },
      {
        property: "og:description",
        content: "Consulta la disponibilidad de las 15 plazas y gestiona tus reservas.",
      },
    ],
  }),
  component: Reservas,
});

interface Plaza {
  id: string;
  numero_plaza: number;
  unidad_id: string | null;
  unidades: { nombre_unidad: string } | null;
}

interface Reserva {
  id: string;
  spot_id: string;
  user_id: string;
  matricula_usada: string;
  fecha_reserva: string;
  status: string;
  profiles: { nombre_apellidos: string; login_md: string } | null;
}

const textoAviso = (numero: number, unidad: string, fechaReserva: string) =>
  `📢 He liberado la Plaza ${numero} (${unidad}) para el día ${fechaLarga(fechaReserva)}. ¡Disponible en la app!`;

function Reservas() {
  const ahora = new Date();
  const { data: sesion } = useSesion();
  const queryClient = useQueryClient();

  const lunesActual = useMemo(() => inicioSemana(ahora), []); // eslint-disable-line react-hooks/exhaustive-deps

  const esAdmin = !!sesion?.esStaff;

  // Posicionamiento inicial: día de hoy (o el lunes siguiente si es fin de semana).
  const inicioPorDefecto = useMemo(() => {
    const diaSemana = ahora.getDay(); // 0 domingo, 6 sábado
    const finDeSemana = diaSemana === 0 || diaSemana === 6;
    const base = finDeSemana ? addDays(lunesActual, 7) : lunesActual;
    return { offset: finDeSemana ? 1 : 0, dia: iso(finDeSemana ? base : ahora) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [offset, setOffset] = useState(inicioPorDefecto.offset);
  const offsetSeguro = esAdmin ? Math.max(0, offset) : Math.min(1, Math.max(0, offset));
  const inicio = addDays(lunesActual, offsetSeguro * 7);
  const dias = diasLaborables(inicio);
  const fase = faseDeSemana(inicio, ahora);

  const [diaSel, setDiaSel] = useState<string>(inicioPorDefecto.dia);
  const fechasSemana = dias.map(iso);
  const fecha = fechasSemana.includes(diaSel) ? diaSel : fechasSemana[0]!;

  // Los usuarios no Admin no pueden crear ni modificar reservas de días pasados.
  const hoyIso = iso(ahora);
  const esFechaPasada = fecha < hoyIso;
  const soloLectura = esFechaPasada && !esAdmin;


  const [plazaAReservar, setPlazaAReservar] = useState<Plaza | null>(null);
  const [matriculaSel, setMatriculaSel] = useState<string>("");
  const [avisoTeams, setAvisoTeams] = useState<string | null>(null);
  const [reservaAAnular, setReservaAAnular] = useState<Reserva | null>(null);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parking_spots")
        .select("id, numero_plaza, unidad_id, unidades(nombre_unidad)")
        .order("numero_plaza");
      if (error) throw error;
      return data as unknown as Plaza[];
    },
  });

  // Solo devuelve las reservas visibles para el usuario (las suyas; todas si es Admin).
  const { data: reservas = [] } = useQuery({
    queryKey: ["reservas", fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, profiles(nombre_apellidos, login_md)")
        .eq("fecha_reserva", fecha)
        .eq("status", "activa");
      if (error) throw error;
      return data as unknown as Reserva[];
    },
  });

  // Ocupación anonimizada (LOPD): solo indica qué plazas están ocupadas.
  const { data: ocupacion = [] } = useQuery({
    queryKey: ["ocupacion", fecha],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ocupacion_dia", { _fecha: fecha });
      if (error) throw error;
      return (data ?? []) as {
        spot_id: string;
        ocupada: boolean;
        es_mia: boolean;
        login_md: string | null;
      }[];
    },
  });


  const { data: enListaEspera } = useQuery({
    queryKey: ["espera", fecha, sesion?.userId],
    enabled: !!sesion?.userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("waitlist_notifications")
        .select("id")
        .eq("fecha_deseada", fecha)
        .eq("user_id", sesion!.userId)
        .maybeSingle();
      return !!data;
    },
  });

  const reservar = useMutation({
    mutationFn: async ({ plaza, matricula }: { plaza: Plaza; matricula: string }) => {
      const { error } = await supabase.from("reservations").insert({
        spot_id: plaza.id,
        user_id: sesion!.userId,
        matricula_usada: matricula,
        fecha_reserva: fecha,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: sesion!.userId,
        accion: "reserva",
        detalles: { plaza: plaza.numero_plaza, fecha, matricula },
      });
    },
    onSuccess: () => {
      toast.success("Reserva confirmada");
      setPlazaAReservar(null);
      queryClient.invalidateQueries({ queryKey: ["reservas", fecha] });
      queryClient.invalidateQueries({ queryKey: ["ocupacion", fecha] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("reservations_spot_fecha_activa")) {
        toast.error("Esa plaza acaba de ser ocupada por otra persona.");
      } else if (msg.includes("reservations_user_fecha_activa")) {
        toast.error("Ya tienes una reserva confirmada para este día");
      } else if (msg.toLowerCase().includes("row-level")) {
        toast.error("Tienes una sanción de bloqueo vigente para esa fecha.");
      } else {
        toast.error("No se pudo completar la reserva.");
      }
      queryClient.invalidateQueries({ queryKey: ["reservas", fecha] });
      queryClient.invalidateQueries({ queryKey: ["ocupacion", fecha] });
    },
  });

  const anular = useMutation({
    mutationFn: async (reserva: Reserva) => {
      const tardia = esAnulacionTardia(reserva.fecha_reserva, new Date());
      const { error } = await supabase
        .from("reservations")
        .update({ status: tardia ? "anulada_tardia" : "anulada" })
        .eq("id", reserva.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: sesion!.userId,
        accion: tardia ? "anulacion_tardia" : "anulacion",
        detalles: {
          plaza: plazas.find((p) => p.id === reserva.spot_id)?.numero_plaza,
          fecha: reserva.fecha_reserva,
          matricula: reserva.matricula_usada,
        },
      });
      return { reserva, tardia };
    },
    onSuccess: async ({ reserva, tardia }) => {
      const plaza = plazas.find((p) => p.id === reserva.spot_id);
      const unidad = plaza?.unidades?.nombre_unidad ?? "Sin unidad";
      setReservaAAnular(null);
      setAvisoTeams(textoAviso(plaza?.numero_plaza ?? 0, unidad, reserva.fecha_reserva));
      if (tardia) {
        toast.warning("Anulación registrada como TARDÍA (posterior a las 20:00h).");
      } else {
        toast.success("Reserva anulada. La plaza queda libre.");
      }
      await avisarListaEspera(reserva.fecha_reserva, plaza?.numero_plaza ?? 0, unidad);
      queryClient.invalidateQueries({ queryKey: ["reservas", fecha] });
      queryClient.invalidateQueries({ queryKey: ["ocupacion", fecha] });
    },
    onError: () => toast.error("No se pudo anular la reserva."),
  });

  async function avisarListaEspera(fechaLib: string, numero: number, unidad: string) {
    const { data: suscritos } = await supabase
      .from("waitlist_notifications")
      .select("id, user_id")
      .eq("fecha_deseada", fechaLib);
    if (!suscritos?.length) return;

    await supabase.from("audit_logs").insert({
      user_id: sesion!.userId,
      accion: "aviso_lista_espera",
      detalles: { fecha: fechaLib, plaza: numero, unidad, destinatarios: suscritos.length },
    });

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Plaza liberada", {
        body: `Plaza ${numero} (${unidad}) libre para el ${fechaLarga(fechaLib)}.`,
        icon: "/favicon.png",
      });
    }
    toast.info(`Se ha avisado a ${suscritos.length} persona(s) en lista de espera.`);
  }

  const apuntarseEspera = useMutation({
    mutationFn: async () => {
      let permiso: NotificationPermission = "default";
      if (typeof window !== "undefined" && "Notification" in window) {
        permiso = await Notification.requestPermission();
      }
      const { error } = await supabase.from("waitlist_notifications").insert({
        user_id: sesion!.userId,
        fecha_deseada: fecha,
        endpoint_push: { canal: "pwa", permiso, agente: navigator.userAgent.slice(0, 120) },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Te avisaremos si queda una plaza libre ese día.");
      queryClient.invalidateQueries({ queryKey: ["espera", fecha] });
    },
    onError: () => toast.error("No se pudo activar el aviso."),
  });

  const miReserva = reservas.find((r) => r.user_id === sesion?.userId);
  const todasOcupadas = plazas.length > 0 && ocupacion.length >= plazas.length;

  function estadoPlaza(plaza: Plaza) {
    const ocupada = ocupacion.find((o) => o.spot_id === plaza.id);
    if (ocupada) {
      const reserva = reservas.find((r) => r.spot_id === plaza.id) ?? null;
      return {
        tipo: "ocupada" as const,
        esMia: ocupada.es_mia,
        loginMd: ocupada.login_md,
        reserva,
      };
    }
    if (soloLectura) return { tipo: "cerrada" as const };
    if (fase === "cerrada") return { tipo: "cerrada" as const };
    if (!sesion) return { tipo: "libre" as const };
    // Derecho preferente: ser Usuario Titular asignado a esa plaza fija.
    const soyTitularDeLaPlaza = sesion.plazasTitular.includes(plaza.id);
    if (fase === "preferente" && !soyTitularDeLaPlaza && !sesion.esStaff)
      return { tipo: "preferente" as const };
    return { tipo: "libre" as const };
  }



  const etiquetaFase: Record<string, { texto: string; variante: "default" | "secondary" }> = {
    preferente: { texto: "Fase preferente de Unidad", variante: "secondary" },
    libre: { texto: "Fase libre — orden de llegada", variante: "default" },
    cerrada: { texto: "Ventana de reserva no abierta", variante: "secondary" },
    en_curso: { texto: "Semana en curso", variante: "secondary" },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reserva de plaza</h1>
          <p className="text-sm text-muted-foreground">
            15 plazas · Avda. Asturias 4 · {fechaLarga(fecha)}
          </p>
        </div>
        <Badge variant={etiquetaFase[fase]!.variante}>{etiquetaFase[fase]!.texto}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={String(Math.min(offsetSeguro, 1))}
          onValueChange={(v) => setOffset(Number(v))}
        >
          <TabsList>
            <TabsTrigger value="0">Semana actual</TabsTrigger>
            <TabsTrigger value="1">Semana siguiente</TabsTrigger>
          </TabsList>
        </Tabs>
        {esAdmin ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offsetSeguro === 0}
              onClick={() => setOffset(offsetSeguro - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {offsetSeguro > 1 ? `Semana +${offsetSeguro} (modo Admin)` : "Navegación Admin"}
            </span>
            <Button variant="outline" size="sm" onClick={() => setOffset(offsetSeguro + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Solo puedes reservar la semana en curso y la siguiente.
          </span>
        )}
      </div>


      <div className="flex flex-wrap gap-2">
        {dias.map((d) => {
          const clave = iso(d);
          const activo = clave === fecha;
          return (
            <button
              key={clave}
              onClick={() => setDiaSel(clave)}
              className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                activo
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {fechaCorta(d)}
            </button>
          );
        })}
      </div>

      {miReserva && (
        <Card className="border-success/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">
                  Tienes la plaza{" "}
                  {plazas.find((p) => p.id === miReserva.spot_id)?.numero_plaza} reservada
                </p>
                <p className="text-xs text-muted-foreground">
                  Matrícula {miReserva.matricula_usada} ·{" "}
                  {soloLectura
                    ? "fecha pasada: solo consulta"
                    : esAnulacionTardia(miReserva.fecha_reserva, ahora)
                      ? "fuera de plazo de anulación (20:00h)"
                      : "puedes anular sin infracción hasta las 20:00h del día anterior"}
                </p>
              </div>
            </div>
            {!soloLectura && (
              <Button variant="destructive" onClick={() => setReservaAAnular(miReserva)}>
                Anular reserva
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {todasOcupadas && !miReserva && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="text-sm text-muted-foreground">
              Todas las plazas están ocupadas para el {fechaLarga(fecha)}.
            </p>
            <Button
              variant="secondary"
              disabled={enListaEspera || apuntarseEspera.isPending}
              onClick={() => apuntarseEspera.mutate()}
            >
              <Bell className="mr-2 h-4 w-4" />
              {enListaEspera ? "Ya estás en lista de espera" : "🔔 Avisarme si queda alguna libre"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plazas.map((plaza) => {
          const estado = estadoPlaza(plaza);
          const unidad = plaza.unidades?.nombre_unidad ?? "Sin unidad";
          return (
            <Card
              key={plaza.id}
              className={
                estado.tipo === "libre"
                  ? "border-success/40"
                  : estado.tipo === "ocupada"
                    ? "border-destructive/40"
                    : "border-border opacity-80"
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Plaza {plaza.numero_plaza}</span>
                  {estado.tipo === "libre" && <Badge variant="secondary">Libre</Badge>}
                  {estado.tipo === "ocupada" &&
                    (estado.esMia ? (
                      <Badge className="bg-success text-success-foreground">Tu reserva</Badge>
                    ) : (
                      <Badge variant="destructive">Ocupada</Badge>
                    ))}
                  {estado.tipo === "preferente" && (
                    <Badge variant="outline">
                      <Lock className="mr-1 h-3 w-3" />
                      Reservada a su unidad
                    </Badge>
                  )}
                  {estado.tipo === "cerrada" && <Badge variant="outline">No disponible</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{unidad}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {estado.tipo === "ocupada" && (
                  <div className="space-y-2 text-sm">
                    {estado.esMia ? (
                      <>
                        <p className="font-medium text-success">Tu reserva</p>
                        <p className="text-xs text-muted-foreground">
                          Matrícula {estado.reserva?.matricula_usada}
                        </p>
                        <Button
                          variant="destructive"
                          className="w-full"
                          disabled={!estado.reserva}
                          onClick={() => estado.reserva && setReservaAAnular(estado.reserva)}
                        >
                          Gestionar / anular
                        </Button>
                      </>
                    ) : esAdmin && estado.reserva ? (
                      <>
                        <p className="font-medium">
                          {estado.reserva.profiles?.nombre_apellidos ?? "Empleado CRTM"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Matrícula {estado.reserva.matricula_usada} · vista Admin
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Plaza reservada. Los datos del ocupante están protegidos (LOPD).
                      </p>
                    )}
                  </div>
                )}

                {estado.tipo === "preferente" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Exclusivo Unidad {unidad}</p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        toast.warning(
                          "Reserva anticipada exclusiva para Titulares hasta el jueves a las 23:59h",
                        )
                      }
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Reserva anticipada restringida
                    </Button>
                  </div>
                )}
                {estado.tipo === "cerrada" && (
                  <p className="text-sm text-muted-foreground">
                    La ventana de reserva de esta semana aún no está abierta.
                  </p>
                )}
                {estado.tipo === "libre" && (
                  <Button
                    className="w-full"
                    disabled={!!miReserva}
                    onClick={() => {
                      setPlazaAReservar(plaza);
                      setMatriculaSel(sesion?.matriculas[0] ?? "");
                    }}
                  >
                    {miReserva ? "Ya tienes plaza este día" : "Reservar"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!plazaAReservar} onOpenChange={(o) => !o && setPlazaAReservar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reserva — Plaza {plazaAReservar?.numero_plaza}</DialogTitle>
            <DialogDescription className="capitalize">{fechaLarga(fecha)}</DialogDescription>
          </DialogHeader>
          {sesion?.matriculas.length ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Selecciona la matrícula autorizada que utilizarás ese día.
              </p>
              <Select value={matriculaSel} onValueChange={setMatriculaSel}>
                <SelectTrigger>
                  <SelectValue placeholder="Matrícula" />
                </SelectTrigger>
                <SelectContent>
                  {sesion.matriculas.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4" />
              No tienes matrículas autorizadas. Contacta con Asuntos Generales.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlazaAReservar(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!matriculaSel || reservar.isPending}
              onClick={() =>
                plazaAReservar && reservar.mutate({ plaza: plazaAReservar, matricula: matriculaSel })
              }
            >
              Confirmar reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reservaAAnular} onOpenChange={(o) => !o && setReservaAAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Anular tu reserva?</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas anular tu reserva? Al liberar tu plaza con antelación permites que
              otro compañero del CRTM pueda utilizarla.
            </DialogDescription>
          </DialogHeader>
          {reservaAAnular && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted p-3 text-sm">
                <p className="font-medium">
                  Plaza {plazas.find((p) => p.id === reservaAAnular.spot_id)?.numero_plaza} ·{" "}
                  {plazas.find((p) => p.id === reservaAAnular.spot_id)?.unidades?.nombre_unidad ??
                    "Sin unidad"}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {fechaLarga(reservaAAnular.fecha_reserva)} · Matrícula{" "}
                  {reservaAAnular.matricula_usada}
                </p>
              </div>
              {esAnulacionTardia(reservaAAnular.fecha_reserva, new Date()) && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  Fuera de plazo (20:00h del día anterior): quedará registrada como anulación
                  tardía.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const plaza = plazas.find((p) => p.id === reservaAAnular?.spot_id);
                await navigator.clipboard.writeText(
                  textoAviso(
                    plaza?.numero_plaza ?? 0,
                    plaza?.unidades?.nombre_unidad ?? "Sin unidad",
                    reservaAAnular?.fecha_reserva ?? fecha,
                  ),
                );
                toast.success("Aviso copiado al portapapeles");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              📋 Copiar aviso para Teams
            </Button>
            <Button
              variant="destructive"
              disabled={anular.isPending}
              onClick={() => reservaAAnular && anular.mutate(reservaAAnular)}
            >
              Confirmar anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!avisoTeams} onOpenChange={(o) => !o && setAvisoTeams(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plaza liberada</DialogTitle>
            <DialogDescription>
              Comparte el aviso en el canal de Teams para que el resto de compañeros lo vea.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted p-3 text-sm">{avisoTeams}</p>
          <DialogFooter>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(avisoTeams ?? "");
                toast.success("Aviso copiado al portapapeles");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              📋 Copiar aviso para Teams
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
