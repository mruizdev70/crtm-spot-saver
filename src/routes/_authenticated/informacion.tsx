import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/informacion")({
  head: () => ({
    meta: [
      { title: "Procedimiento y FAQ — CRTM Parking Manager" },
      {
        name: "description",
        content:
          "Normativa oficial interna del aparcamiento del CRTM en Avda. Asturias 4 y preguntas frecuentes sobre reservas, anulaciones y sanciones.",
      },
      { property: "og:title", content: "Procedimiento y FAQ — CRTM Parking Manager" },
      {
        property: "og:description",
        content: "Normas de reserva, anulación y sanciones del aparcamiento del CRTM.",
      },
    ],
  }),
  component: Informacion,
});

function Informacion() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Normativa y ayuda</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📖 Procedimiento oficial</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="a1">
              <AccordionTrigger>1. Objeto y ámbito</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  El aparcamiento de la sede del CRTM en Avda. de Asturias 4 dispone de 15 plazas
                  numeradas destinadas al personal del Consorcio. Cada plaza está adscrita a una
                  Unidad/División concreta.
                </p>
                <p>
                  Solo pueden utilizarse vehículos cuyas matrículas hayan sido previamente validadas
                  por Metro de Madrid y registradas en el perfil del empleado (máximo 3).
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="a2">
              <AccordionTrigger>2. Ventanas de reserva</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Fase preferente de Unidad:</strong> de lunes a
                  las 00:00h hasta el jueves a las 23:59h de la semana previa, cada plaza solo puede
                  ser reservada por personal adscrito a su Unidad y por su Responsable.
                </p>
                <p>
                  <strong className="text-foreground">Fase libre:</strong> desde el viernes a las
                  00:00h de la semana previa, las plazas no reservadas quedan abiertas a cualquier
                  empleado del CRTM por riguroso orden de llegada.
                </p>
                <p>Las reservas se realizan por días laborables, de lunes a viernes.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="a3">
              <AccordionTrigger>3. Anulaciones</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  La anulación sin infracción debe realizarse antes de las 20:00h del día anterior a
                  la fecha reservada. La plaza queda liberada inmediatamente en la aplicación y debe
                  comunicarse en el canal de Teams mediante el aviso generado por la app.
                </p>
                <p>
                  Las anulaciones posteriores a las 20:00h se ejecutan igualmente, pero quedan
                  registradas como “Anulación tardía” y son visibles para Asuntos Generales.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="a4">
              <AccordionTrigger>4. Régimen de infracciones y sanciones</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Constituyen infracción la no ocupación de la plaza reservada (No-Show) y la
                  anulación tardía. El catálogo de sanciones es: 1) advertencia verbal, 2)
                  advertencia por escrito, 3) retirada temporal del derecho de reserva durante un
                  número determinado de días y 4) retirada definitiva.
                </p>
                <p>
                  Las sanciones de bloqueo se aplican de forma diferida: comienzan 2 semanas después
                  de la fecha de registro de la infracción, respetando las reservas ya vigentes.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="a5">
              <AccordionTrigger>5. Control y auditoría</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Asuntos Generales y la Jefatura de Coordinación de Administración pueden consultar
                  diariamente la ocupación de las 15 plazas, con usuario, Login de MD y matrícula
                  declarada, a efectos de seguridad y control de accesos.
                </p>
                <p>Todas las acciones quedan registradas en un histórico de auditoría inalterable.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">❓ Preguntas frecuentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="f1">
              <AccordionTrigger>¿Qué ocurre si anulo después de las 20:00h?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                La plaza se libera igualmente para que otro compañero pueda aprovecharla, pero la
                app registra automáticamente una alerta de “Anulación tardía” en tu perfil, visible
                para Administración, que podrá valorar la apertura de un expediente sancionador.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="f2">
              <AccordionTrigger>¿Por qué hay doble notificación (app y Teams)?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                La app es el registro oficial de la plaza, pero no todo el mundo la consulta en el
                momento. Por eso, al anular se genera un texto listo para copiar y pegar en el canal
                de Teams, y además se envía un aviso a quienes se hayan apuntado a la lista de
                espera de ese día concreto.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="f3">
              <AccordionTrigger>¿Cómo se resuelve si dos personas reservan a la vez?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                La base de datos aplica una restricción de unicidad por plaza y fecha: solo la
                primera confirmación queda registrada. La segunda recibe un aviso de que la plaza ya
                ha sido ocupada y la vista se actualiza al instante.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="f4">
              <AccordionTrigger>¿Por qué las sanciones son diferidas?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Para no perjudicar la planificación ya realizada. El bloqueo comienza 2 semanas
                después del registro de la infracción, de modo que las reservas vigentes del usuario
                se mantienen y el bloqueo afecta únicamente a periodos futuros.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="f5">
              <AccordionTrigger>¿Puedo usar cualquier coche?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                No. Solo las matrículas validadas previamente por Metro y registradas en tu perfil
                (máximo 3). Al confirmar cada reserva debes indicar cuál de ellas utilizarás ese día.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
