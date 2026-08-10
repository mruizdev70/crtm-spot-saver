import { addDays, format, isBefore, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

export type Fase = "cerrada" | "preferente" | "libre" | "en_curso";

export const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function inicioSemana(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function diasLaborables(inicio: Date) {
  return [0, 1, 2, 3, 4].map((i) => addDays(inicio, i));
}

/** Fase de la ventana temporal para reservar la semana que empieza en `inicio`. */
export function faseDeSemana(inicio: Date, ahora: Date): Fase {
  if (!isBefore(ahora, inicio)) return "en_curso";
  const semanaPrevia = addDays(inicio, -7);
  const viernesPrevio = addDays(semanaPrevia, 4);
  if (!isBefore(ahora, viernesPrevio)) return "libre";
  if (!isBefore(ahora, semanaPrevia)) return "preferente";
  return "cerrada";
}

/** Límite de anulación sin infracción: 20:00h del día anterior a la reserva. */
export function limiteAnulacion(fechaReserva: string) {
  const d = parseISO(fechaReserva);
  const limite = addDays(d, -1);
  limite.setHours(20, 0, 0, 0);
  return limite;
}

export function esAnulacionTardia(fechaReserva: string, ahora: Date) {
  return !isBefore(ahora, limiteAnulacion(fechaReserva));
}

export const fechaLarga = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "EEEE d 'de' MMMM", { locale: es });

export const fechaCorta = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "EEE d MMM", { locale: es });

export const diaSemana = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "EEEE", { locale: es });

export const fechaHora = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "dd/MM/yyyy HH:mm", { locale: es });
