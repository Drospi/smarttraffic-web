import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  PencilLine,
  RotateCcw,
  Scissors,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';

interface ManualStep {
  id: number;
  title: string;
  phaseBadge: string;
  accent: string;
  givenData: readonly string[];
  taskPrompt: string;
  answerHeadline: string;
  answerExplanation: string;
  answerFormulaText: string;
  pendingNodeIds: readonly string[];
  /** Estado visible del árbol DESPUÉS de revelar este paso */
  revealedState: {
    betaText: string;
    bestPlanText: string;
    planAAlpha: string;
    planBAlpha: string;
    planCAlpha: string;
    planBPruned: boolean;
    winner: 'none' | 'C';
    leaves: Record<string, string>;
    prunedLeaves: readonly string[];
  };
}

const MANUAL_STEPS: readonly ManualStep[] = [
  {
    id: 1,
    title: 'Paso 1: Preparar la raíz del Agente y abrir el Plan A',
    phaseBadge: 'INICIO DEL ÁRBOL',
    accent: '#00f0ff',
    givenData: [
      'Problema real en Sopocachi (La Paz): Hora Pico 08:15 AM en C. Pedro Salazar entre Plaza Avaroa / Av. 20 de Octubre y Av. 6 de Agosto (18 vehículos esperando en C. Pedro Salazar y 4 en Av. 20 de Octubre).',
      'Tenemos 3 planes seguros a comparar: Plan A (30s P. Salazar / 30s Avenidas), Plan B (24s/36s) y Plan C (39s/21s).',
      'Los 3 escenarios de tráfico se ordenan siempre del más pesado al más suave: Esc. 1 Pico (48 veh/ciclo), Esc. 2 Medio (42 veh/ciclo) y Esc. 3 Suave (36 veh/ciclo).',
    ],
    taskPrompt:
      '¿Con qué valor inicial se coloca Beta en la raíz del Agente y por qué escenario debemos empezar al evaluar el Plan A?',
    answerHeadline: 'Beta inicia sin límite (+∞) y empezamos por el Escenario 1 (Pico: 48 veh/ciclo)',
    answerFormulaText: 'Raíz del Agente: Beta = Sin límite (+∞) · Plan A: Alfa = Sin calcular (-∞)',
    answerExplanation:
      'Aún no evaluamos ningún plan, por eso Beta empieza sin límite. Entramos primero al Plan A (el plan actual) y probamos primero el escenario más cargado (48 veh/ciclo) porque así encontramos rápido el peor caso.',
    pendingNodeIds: ['root', 'planA'],
    revealedState: {
      betaText: 'Sin límite (+∞)',
      bestPlanText: 'Ninguno aún',
      planAAlpha: 'Alfa = -∞',
      planBAlpha: 'Pendiente',
      planCAlpha: 'Pendiente',
      planBPruned: false,
      winner: 'none',
      leaves: {},
      prunedLeaves: [],
    },
  },
  {
    id: 2,
    title: 'Paso 2: Calcular Plan A (30s/30s) en el Escenario 1 (Pico)',
    phaseBadge: 'CÁLCULO MANUAL',
    accent: '#ffb800',
    givenData: [
      'Plan A: 30 s avenida principal / 30 s calle transversal.',
      'Escenario 1 (Pico): 192 vehículos en 4 ciclos (48 vehículos por ciclo).',
      'Tiempo total de espera = 9,728 s → aporta 32.0 puntos (peso 50%).',
      'Fila más larga = 21 vehículos → aporta 21.0 puntos (peso 30%).',
      'Cuadra central saturada = 1 de 4 ciclos → aporta 5.0 puntos (peso 20%).',
    ],
    taskPrompt:
      'Suma las 3 partes para hallar el puntaje de congestión del Plan A en el Escenario 1 y determina cuánto vale ahora Alfa del Plan A.',
    answerHeadline: 'Puntaje Escenario 1 = 58.0 puntos → Alfa del Plan A sube a 58.0 pts',
    answerFormulaText: '32.0 (Espera) + 21.0 (Fila más larga) + 5.0 (Saturación) = 58.0 puntos',
    answerExplanation:
      'Como es el primer escenario revisado del Plan A, su peor puntaje observado hasta ahora (Alfa) pasa de -∞ a 58.0 puntos. Todavía no podemos podar porque Beta aún no tiene ningún número de referencia.',
    pendingNodeIds: ['a1', 'planA'],
    revealedState: {
      betaText: 'Sin límite (+∞)',
      bestPlanText: 'Ninguno aún',
      planAAlpha: 'Alfa = 58.0 pts',
      planBAlpha: 'Pendiente',
      planCAlpha: 'Pendiente',
      planBPruned: false,
      winner: 'none',
      leaves: { a1: '58.0 pts' },
      prunedLeaves: [],
    },
  },
  {
    id: 3,
    title: 'Paso 3: Completar Plan A (Escenarios 2 y 3) y fijar el primer Beta',
    phaseBadge: 'PRIMERA REFERENCIA BETA',
    accent: '#39ff14',
    givenData: [
      'Escenario 2 (Medio, 42 veh/ciclo): Espera = 27.5 pts · Fila más larga = 19.0 pts · Saturación = 5.0 pts.',
      'Escenario 3 (Suave, 36 veh/ciclo): Espera = 25.0 pts · Fila más larga = 16.0 pts · Saturación = 0.0 pts.',
      'Recuerda: Alfa del Plan A guarda el PEOR (más alto) de sus 3 escenarios, y luego el Agente guarda ese valor en Beta.',
    ],
    taskPrompt:
      'Calcula los puntajes de Escenario 2 y Escenario 3, identifica el peor puntaje final del Plan A y define el valor de Beta en la raíz.',
    answerHeadline: 'Esc. 2 = 51.5 pts · Esc. 3 = 41.0 pts → Peor caso = 58.0 pts → Beta = 58.0 pts',
    answerFormulaText: 'Peor del Plan A = mayor entre [58.0, 51.5, 41.0] = 58.0 pts → Beta baja a 58.0 pts',
    answerExplanation:
      'El Plan A terminó todos sus escenarios con un peor puntaje de 58.0 pts. Ahora el Agente ya tiene una marca segura a vencer: Beta = 58.0 pts (Plan A). Cualquier otro plan que iguale o supere 58.0 pts será descartado.',
    pendingNodeIds: ['a2', 'a3', 'root'],
    revealedState: {
      betaText: '58.0 pts',
      bestPlanText: 'Plan A (Vigente)',
      planAAlpha: 'Peor = 58.0 pts',
      planBAlpha: 'Pendiente',
      planCAlpha: 'Pendiente',
      planBPruned: false,
      winner: 'none',
      leaves: { a1: '58.0 pts', a2: '51.5 pts', a3: '41.0 pts' },
      prunedLeaves: [],
    },
  },
  {
    id: 4,
    title: 'Paso 4: Evaluar Plan B (24s/36s) en el Escenario 1 (Pico)',
    phaseBadge: 'CÁLCULO MANUAL',
    accent: '#ffb800',
    givenData: [
      'Plan B: solo 24 s para la avenida principal y 36 s para la calle transversal.',
      'Escenario 1 (Pico, 48 veh/ciclo): la avenida principal se tranca fuertemente.',
      'Tiempo total de espera = 10,944 s → aporta 36.0 puntos (peso 50%).',
      'Fila más larga = 24 vehículos → aporta 24.0 puntos (peso 30%).',
      'Cuadra central saturada = 2 de 4 ciclos → aporta 10.0 puntos (peso 20%).',
    ],
    taskPrompt:
      'Suma las 3 partes del Plan B en el Escenario 1 y anota cuál es ahora el valor de Alfa del Plan B.',
    answerHeadline: 'Puntaje Plan B en Pico = 70.0 puntos → Alfa del Plan B = 70.0 pts',
    answerFormulaText: '36.0 (Espera) + 24.0 (Fila más larga) + 10.0 (Saturación) = 70.0 puntos',
    answerExplanation:
      'Dar menos verde a la avenida principal en hora pico dispara tanto la espera como la saturación de la cuadra central, llevando el puntaje del Plan B hasta 70.0 puntos ya en el primer escenario.',
    pendingNodeIds: ['b1', 'planB'],
    revealedState: {
      betaText: '58.0 pts',
      bestPlanText: 'Plan A (Vigente)',
      planAAlpha: 'Peor = 58.0 pts',
      planBAlpha: 'Alfa = 70.0 pts',
      planCAlpha: 'Pendiente',
      planBPruned: false,
      winner: 'none',
      leaves: { a1: '58.0 pts', a2: '51.5 pts', a3: '41.0 pts', b1: '70.0 pts' },
      prunedLeaves: [],
    },
  },
  {
    id: 5,
    title: 'Paso 5: ¡Decisión de Poda Alfa-Beta en el Plan B!',
    phaseBadge: 'CORTE / PODA',
    accent: '#ff0055',
    givenData: [
      'En este momento en tu pizarra tienes: Alfa del Plan B = 70.0 pts.',
      'En la raíz del Agente ya tienes asegurado al Plan A con Beta = 58.0 pts.',
      'Todavía faltan por revisar Escenario 2 (Medio) y Escenario 3 (Suave) del Plan B.',
    ],
    taskPrompt:
      'Compara Alfa (70.0) contra Beta (58.0): ¿debes calcular Escenario 2 y Escenario 3 del Plan B o debes PODAR esas dos ramas? ¿Por qué?',
    answerHeadline: '¡SE PODAN Escenario 2 y Escenario 3 del Plan B sin calcularlos!',
    answerFormulaText: 'Alfa (70.0 pts) ≥ Beta (58.0 pts)  →  CORTE ALFA-BETA (2 ramas podadas)',
    answerExplanation:
      'Como el Plan B busca su PEOR puntaje, su resultado final será al menos 70.0 pts (nunca podrá bajar de 70.0). Como el Agente ya tiene el Plan A con 58.0 pts, jamás elegirá al Plan B. Tachamos Esc. 2 y Esc. 3 y ahorramos 2 cálculos completos.',
    pendingNodeIds: ['b2', 'b3', 'planB'],
    revealedState: {
      betaText: '58.0 pts',
      bestPlanText: 'Plan A (Vigente)',
      planAAlpha: 'Peor = 58.0 pts',
      planBAlpha: 'PODADO (70.0 ≥ 58.0)',
      planCAlpha: 'Pendiente',
      planBPruned: true,
      winner: 'none',
      leaves: { a1: '58.0 pts', a2: '51.5 pts', a3: '41.0 pts', b1: '70.0 pts' },
      prunedLeaves: ['b2', 'b3'],
    },
  },
  {
    id: 6,
    title: 'Paso 6: Evaluar Plan C (39s/21s) en el Escenario 1 (Pico)',
    phaseBadge: 'CÁLCULO MANUAL',
    accent: '#00f0ff',
    givenData: [
      'Plan C: 39 s para la avenida principal / 21 s para la calle transversal.',
      'Escenario 1 (Pico, 48 veh/ciclo): la avenida principal drena mucho más rápido.',
      'Tiempo total de espera = 7,904 s → aporta 26.0 puntos (peso 50%).',
      'Fila más larga = 15 vehículos → aporta 15.0 puntos (peso 30%).',
      'Cuadra central saturada = 1 de 4 ciclos → aporta 5.0 puntos (peso 20%).',
    ],
    taskPrompt:
      'Calcula el puntaje del Plan C en Escenario 1, actualiza su Alfa y responde: ¿se poda o debemos continuar revisando los escenarios 2 y 3?',
    answerHeadline: 'Puntaje = 46.0 pts → Alfa = 46.0 pts → NO se poda (46.0 < 58.0), seguimos',
    answerFormulaText: '26.0 + 15.0 + 5.0 = 46.0 pts · Como 46.0 < Beta (58.0), el Plan C SÍ puede ganar',
    answerExplanation:
      'En el escenario más difícil, el Plan C obtuvo solo 46.0 pts, mejorando ampliamente a Beta (58.0 pts). Por eso NO se poda y debemos verificar sus otros dos escenarios para confirmar que ninguno supere 58.0.',
    pendingNodeIds: ['c1', 'planC'],
    revealedState: {
      betaText: '58.0 pts',
      bestPlanText: 'Plan A (Vigente)',
      planAAlpha: 'Peor = 58.0 pts',
      planBAlpha: 'PODADO (70.0 ≥ 58.0)',
      planCAlpha: 'Alfa = 46.0 pts',
      planBPruned: true,
      winner: 'none',
      leaves: { a1: '58.0 pts', a2: '51.5 pts', a3: '41.0 pts', b1: '70.0 pts', c1: '46.0 pts' },
      prunedLeaves: ['b2', 'b3'],
    },
  },
  {
    id: 7,
    title: 'Paso 7: Completar Plan C (Escenarios 2 y 3) y decidir el ganador',
    phaseBadge: 'RESULTADO FINAL',
    accent: '#39ff14',
    givenData: [
      'Escenario 2 (Medio, 42 veh/ciclo): Espera = 24.0 pts · Fila más larga = 13.0 pts · Saturación = 0.0 pts.',
      'Escenario 3 (Suave, 36 veh/ciclo): Espera = 21.0 pts · Fila más larga = 11.0 pts · Saturación = 0.0 pts.',
      'Compara el peor puntaje final del Plan C con Beta = 58.0 pts.',
    ],
    taskPrompt:
      'Calcula Esc. 2 y Esc. 3 del Plan C, confirma su peor puntaje (Alfa), actualiza Beta en la raíz e indica qué plan gana y cuántas ramas ahorró la poda.',
    answerHeadline: '★ GANA EL PLAN C (39s/21s) con Beta = 46.0 pts (20.7% menos congestión y 2 ramas podadas)',
    answerFormulaText: 'Esc. 2 = 37.0 pts · Esc. 3 = 32.0 pts → Peor Plan C = 46.0 pts < 58.0 pts → Beta = 46.0 pts',
    answerExplanation:
      'El Plan C superó los 3 escenarios sin pasar de 46.0 pts, venciendo al Plan A (58.0 pts) y al Plan B (podado en 70.0 pts). Solo se calcularon 7 de 9 escenarios obteniendo exactamente la misma decisión óptima que revisando todo el árbol.',
    pendingNodeIds: ['c2', 'c3', 'planC', 'root'],
    revealedState: {
      betaText: '46.0 pts',
      bestPlanText: '★ Plan C (39s/21s)',
      planAAlpha: 'Peor = 58.0 pts',
      planBAlpha: 'PODADO (70.0 ≥ 58.0)',
      planCAlpha: '★ GANADOR (46.0 pts)',
      planBPruned: true,
      winner: 'C',
      leaves: {
        a1: '58.0 pts',
        a2: '51.5 pts',
        a3: '41.0 pts',
        b1: '70.0 pts',
        c1: '46.0 pts',
        c2: '37.0 pts',
        c3: '32.0 pts',
      },
      prunedLeaves: ['b2', 'b3'],
    },
  },
];

const INITIAL_TREE_STATE = {
  betaText: '?',
  bestPlanText: 'Por definir',
  planAAlpha: 'Pendiente',
  planBAlpha: 'Pendiente',
  planCAlpha: 'Pendiente',
  planBPruned: false,
  winner: 'none' as 'none' | 'C',
  leaves: {} as Record<string, string>,
  prunedLeaves: [] as readonly string[],
};

export function ManualAlphaBetaExercise() {
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);

  const step = MANUAL_STEPS[stepIdx];
  const isLastStep = stepIdx === MANUAL_STEPS.length - 1;

  // Estado del árbol visible en este instante:
  // - Si la respuesta actual NO se ha revelado, muestra el estado acumulado del paso anterior
  // - Apenas el usuario pulsa "Siguiente", revela la respuesta y actualiza el árbol
  const visibleTree = answerRevealed
    ? step.revealedState
    : stepIdx > 0
    ? MANUAL_STEPS[stepIdx - 1].revealedState
    : INITIAL_TREE_STATE;

  const isPendingNode = (nodeId: string): boolean =>
    !answerRevealed && step.pendingNodeIds.includes(nodeId);

  const handleNext = (): void => {
    if (!answerRevealed) {
      setAnswerRevealed(true);
      return;
    }
    if (!isLastStep) {
      setStepIdx((prev) => prev + 1);
      setAnswerRevealed(false);
    }
  };

  const handlePrev = (): void => {
    if (answerRevealed) {
      setAnswerRevealed(false);
      return;
    }
    if (stepIdx > 0) {
      setStepIdx((prev) => prev - 1);
      setAnswerRevealed(true);
    }
  };

  const handleReset = (): void => {
    setStepIdx(0);
    setAnswerRevealed(false);
  };

  const leafDisplay = (leafId: string): { text: string; state: 'pending' | 'question' | 'done' | 'pruned' } => {
    if (visibleTree.prunedLeaves.includes(leafId)) {
      return { text: 'PODADO ✕', state: 'pruned' };
    }
    if (visibleTree.leaves[leafId]) {
      return { text: visibleTree.leaves[leafId], state: 'done' };
    }
    if (isPendingNode(leafId)) {
      return { text: '¿ ? pts', state: 'question' };
    }
    return { text: '—', state: 'pending' };
  };

  const plans = [
    {
      id: 'planA',
      x: 170,
      title: 'Plan A (Vigente)',
      split: '30s Horiz / 30s Vert',
      alpha: isPendingNode('planA') ? 'Alfa = ¿ ?' : visibleTree.planAAlpha,
      pruned: false,
      winner: false,
      leaves: [
        { id: 'a1', x: 92, label: 'Esc. 1', rate: '48 v/c' },
        { id: 'a2', x: 170, label: 'Esc. 2', rate: '42 v/c' },
        { id: 'a3', x: 248, label: 'Esc. 3', rate: '36 v/c' },
      ],
    },
    {
      id: 'planB',
      x: 460,
      title: 'Plan B (Desfavorable)',
      split: '24s Horiz / 36s Vert',
      alpha: isPendingNode('planB') ? '¿Podar o seguir?' : visibleTree.planBAlpha,
      pruned: visibleTree.planBPruned,
      winner: false,
      leaves: [
        { id: 'b1', x: 382, label: 'Esc. 1', rate: '48 v/c' },
        { id: 'b2', x: 460, label: 'Esc. 2', rate: '42 v/c' },
        { id: 'b3', x: 538, label: 'Esc. 3', rate: '36 v/c' },
      ],
    },
    {
      id: 'planC',
      x: 750,
      title: 'Plan C (Propuesto)',
      split: '39s Horiz / 21s Vert',
      alpha: isPendingNode('planC') ? 'Alfa = ¿ ?' : visibleTree.planCAlpha,
      pruned: false,
      winner: visibleTree.winner === 'C',
      leaves: [
        { id: 'c1', x: 672, label: 'Esc. 1', rate: '48 v/c' },
        { id: 'c2', x: 750, label: 'Esc. 2', rate: '42 v/c' },
        { id: 'c3', x: 828, label: 'Esc. 3', rate: '36 v/c' },
      ],
    },
  ] as const;

  return (
    <section
      id="ejercicio-manual-alfa-beta"
      className="pixel-panel-amber p-4 sm:p-5 space-y-4 mt-6"
    >
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#473814] pb-3">
        <div>
          <span className="inline-block px-2 py-1 text-[10px] font-pixel bg-[#ffb800]/15 text-[#ffb800] border border-[#ffb800] mb-1.5">
            PRÁCTICA GUIADA EN VIVO — RESPUESTA OCULTA HASTA PULSAR SIGUIENTE
          </span>
          <h3 className="font-pixel text-xs sm:text-sm text-white flex items-center gap-2 leading-relaxed">
            <PencilLine className="w-4 h-4 text-[#ffb800] shrink-0" />
            EJEMPLO INTERACTIVO: CÓMO RESOLVER EL ÁRBOL ALFA-BETA A MANO
          </h3>
          <p className="text-xs text-[#c7d3f5] mt-1">
            Problema único con datos reales de Sopocachi (Hora Pico 08:15 AM en Plaza Avaroa: C. Pedro Salazar, Av. 20 de Octubre, Av. 6 de Agosto y C. Belisario Salinas). Primero lee qué debes hacer, resuélvelo mentalmente o en pizarra, y pulsa <strong>Siguiente</strong> para destapar la respuesta y ver cómo se actualiza el árbol.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={stepIdx === 0 && !answerRevealed}
            onClick={handlePrev}
            className="arcade-btn arcade-btn-cyan !py-2 !px-3"
          >
            <ChevronLeft className="w-4 h-4" />
            ANTERIOR
          </button>

          <button
            type="button"
            disabled={isLastStep && answerRevealed}
            onClick={handleNext}
            className={`arcade-btn !py-2 !px-3.5 ${
              !answerRevealed ? 'arcade-btn-green' : 'arcade-btn-cyan-solid'
            }`}
          >
            {!answerRevealed ? (
              <>
                <Eye className="w-4 h-4" />
                SIGUIENTE (VER RESPUESTA)
              </>
            ) : isLastStep ? (
              <>
                <Trophy className="w-4 h-4" />
                EJERCICIO COMPLETADO
              </>
            ) : (
              <>
                SIGUIENTE PASO
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="arcade-btn arcade-btn-pink !py-2 !px-3"
          >
            <RotateCcw className="w-4 h-4" />
            REINICIAR
          </button>
        </div>
      </div>

      {/* Barra de progreso de los 7 pasos manuales */}
      <div className="grid grid-cols-7 gap-1.5">
        {MANUAL_STEPS.map((s, idx) => {
          const isCurrent = idx === stepIdx;
          const isDone = idx < stepIdx || (idx === stepIdx && answerRevealed);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStepIdx(idx);
                setAnswerRevealed(false);
              }}
              className={`py-1.5 px-1 text-[10px] font-pixel border-2 cursor-pointer transition-colors ${
                isCurrent
                  ? 'border-[#ffb800] bg-[#ffb800]/20 text-[#ffb800]'
                  : isDone
                  ? 'border-[#39ff14] bg-[#39ff14]/15 text-[#39ff14]'
                  : 'border-[#25305c] bg-[#090a14] text-[#7c8cb8] hover:border-[#4b5ca1]'
              }`}
            >
              P{s.id}
            </button>
          );
        })}
      </div>

      {/* Área Principal: Consigna + Respuesta Oculta/Revelada + Árbol Manual Progresivo */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Columna Izquierda: Qué debes hacer + Datos reales + Caja de Respuesta */}
        <div className="xl:col-span-5 space-y-3">
          {/* Datos y Consigna del paso */}
          <div className="bg-[#090a14] border-2 p-4 space-y-3" style={{ borderColor: step.accent }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className="px-2 py-0.5 text-[9px] font-pixel text-[#090a14]"
                style={{ backgroundColor: step.accent }}
              >
                {step.phaseBadge}
              </span>
              <span className="font-mono-code text-xs text-[#9aa8d1]">
                Paso {step.id} de {MANUAL_STEPS.length}
              </span>
            </div>

            <h4 className="font-pixel text-xs text-white leading-relaxed">{step.title}</h4>

            <div className="space-y-1.5">
              <div className="text-[10px] font-pixel text-[#00f0ff]">DATOS REALES DE ESTE PASO:</div>
              <ul className="space-y-1.5 text-xs text-[#d6e0fa]">
                {step.givenData.map((item, i) => (
                  <li key={i} className="bg-[#111428] border-l-2 border-[#00f0ff] px-2.5 py-1.5 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#1b1608] border-2 border-[#ffb800] p-3 space-y-1">
              <div className="font-pixel text-[9px] text-[#ffb800] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                QUÉ DEBES HACER AHORA:
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#fff3cc] leading-relaxed">
                {step.taskPrompt}
              </p>
            </div>
          </div>

          {/* Caja de Respuesta: OCULTA hasta pulsar Siguiente */}
          {!answerRevealed ? (
            <div className="bg-[#0c0e1c] border-2 border-dashed border-[#4d5e99] p-4 text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#161c38] border border-[#4d5e99] text-[#a6b4db] font-pixel text-[10px]">
                <EyeOff className="w-4 h-4 text-[#ffb800]" />
                RESPUESTA OCULTA
              </div>
              <p className="text-xs text-[#9aa8d1] leading-relaxed">
                Intenta resolver este paso primero con los datos de arriba. Cuando estés listo para comprobarlo, pulsa el botón <strong>Siguiente</strong>.
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="arcade-btn arcade-btn-green"
              >
                <Eye className="w-4 h-4" />
                SIGUIENTE → REVELAR RESPUESTA
              </button>
            </div>
          ) : (
            <div className="bg-[#091c11] border-2 border-[#39ff14] p-4 space-y-2.5 shadow-[4px_4px_0_#0d3b1e]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-[10px] text-[#39ff14] flex items-center gap-1.5">
                  {step.id === 5 ? (
                    <Scissors className="w-4 h-4 text-[#ff0055]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#39ff14]" />
                  )}
                  RESPUESTA REVELADA
                </span>
                <span className="text-[10px] font-mono-code text-[#80ff66]">
                  Árbol actualizado ✓
                </span>
              </div>

              <div className="text-xs sm:text-sm font-bold text-white leading-snug">
                {step.answerHeadline}
              </div>

              <div className="bg-[#090a14] border border-[#39ff14]/60 px-3 py-2 text-xs font-mono-code text-[#80ff66] font-bold">
                {step.answerFormulaText}
              </div>

              <p className="text-xs text-[#d6f5d6] leading-relaxed">{step.answerExplanation}</p>

              {!isLastStep && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="arcade-btn arcade-btn-cyan-solid !py-1.5 !px-3"
                  >
                    CONTINUAR AL PASO {step.id + 1}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna Derecha: Árbol Manual SVG que se va llenando paso a paso */}
        <div className="xl:col-span-7 bg-[#090a14] border-2 border-[#26325e] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-1">
            <span className="font-pixel text-[10px] text-[#00f0ff]">
              PIZARRA DEL ÁRBOL MANUAL (SE ACTUALIZA AL REVELAR CADA PASO)
            </span>
            <span className="text-[#ffb800] font-mono-code">
              {!answerRevealed ? 'Casillas con "?" esperan tu respuesta' : 'Valores del paso confirmados ✓'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 920 430"
              width="920"
              height="430"
              className="w-full h-auto block mx-auto select-none"
              role="img"
              aria-label="Árbol interactivo manual de poda Alfa-Beta con respuestas progresivas"
            >
              {/* Raíz del Agente */}
              <g>
                <rect
                  x="290"
                  y="18"
                  width="340"
                  height="74"
                  fill={visibleTree.winner === 'C' ? '#0f2b18' : '#111428'}
                  stroke={
                    isPendingNode('root')
                      ? '#ffb800'
                      : visibleTree.winner === 'C'
                      ? '#39ff14'
                      : '#00f0ff'
                  }
                  strokeWidth="3"
                />
                <text
                  x="460"
                  y="40"
                  textAnchor="middle"
                  fill="#00f0ff"
                  fontSize="10"
                  fontFamily="Press Start 2P, monospace"
                >
                  AGENTE (BUSCA MENOR PUNTAJE)
                </text>
                <text
                  x="460"
                  y="62"
                  textAnchor="middle"
                  fill={isPendingNode('root') ? '#ffb800' : '#39ff14'}
                  fontSize="12"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="bold"
                >
                  Beta = {isPendingNode('root') ? '¿ ?' : visibleTree.betaText}
                </text>
                <text
                  x="460"
                  y="81"
                  textAnchor="middle"
                  fill="#c7d3f5"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  Mejor plan guardado: {visibleTree.bestPlanText}
                </text>
              </g>

              {/* 3 Planes y sus 3 Escenarios */}
              {plans.map((p) => {
                const pendingPlan = isPendingNode(p.id);
                const strokeColor = p.winner
                  ? '#39ff14'
                  : p.pruned
                  ? '#ff0055'
                  : pendingPlan
                  ? '#ffb800'
                  : '#3c4c85';

                return (
                  <g key={p.id}>
                    {/* Arista Raíz -> Plan */}
                    <line
                      x1="460"
                      y1="92"
                      x2={p.x}
                      y2="160"
                      stroke={strokeColor}
                      strokeWidth={p.winner || pendingPlan ? 3 : 2}
                    />

                    {/* Hojas de escenarios */}
                    {p.leaves.map((leaf) => {
                      const info = leafDisplay(leaf.id);
                      const midX = (p.x + leaf.x) / 2;
                      const midY = (242 + 322) / 2;

                      return (
                        <g key={leaf.id}>
                          <line
                            x1={p.x}
                            y1="242"
                            x2={leaf.x}
                            y2="322"
                            stroke={
                              info.state === 'pruned'
                                ? '#ff0055'
                                : info.state === 'question'
                                ? '#ffb800'
                                : info.state === 'done'
                                ? '#39ff14'
                                : '#243059'
                            }
                            strokeWidth={info.state === 'question' || info.state === 'pruned' ? 2.5 : 1.8}
                            strokeDasharray={info.state === 'pruned' ? '6 4' : undefined}
                          />

                          {info.state === 'pruned' && (
                            <g>
                              <line x1={midX - 11} y1={midY - 8} x2={midX + 11} y2={midY + 8} stroke="#ff0055" strokeWidth="3.5" />
                              <line x1={midX - 11} y1={midY + 8} x2={midX + 11} y2={midY - 8} stroke="#ff0055" strokeWidth="3.5" />
                            </g>
                          )}

                          <rect
                            x={leaf.x - 35}
                            y="322"
                            width="70"
                            height="76"
                            fill={
                              info.state === 'pruned'
                                ? '#290a18'
                                : info.state === 'question'
                                ? '#261e09'
                                : info.state === 'done'
                                ? '#0d2616'
                                : '#111428'
                            }
                            stroke={
                              info.state === 'pruned'
                                ? '#ff0055'
                                : info.state === 'question'
                                ? '#ffb800'
                                : info.state === 'done'
                                ? '#39ff14'
                                : '#2b3663'
                            }
                            strokeWidth={info.state === 'question' ? 3 : 2}
                          />
                          <text
                            x={leaf.x}
                            y="341"
                            textAnchor="middle"
                            fill="#d6e0fa"
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                          >
                            {leaf.label}
                          </text>
                          <text
                            x={leaf.x}
                            y="357"
                            textAnchor="middle"
                            fill="#00f0ff"
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {leaf.rate}
                          </text>
                          <line x1={leaf.x - 28} y1="365" x2={leaf.x + 28} y2="365" stroke="#243059" strokeWidth="1" />
                          <text
                            x={leaf.x}
                            y="384"
                            textAnchor="middle"
                            fill={
                              info.state === 'pruned'
                                ? '#ff0055'
                                : info.state === 'question'
                                ? '#ffb800'
                                : info.state === 'done'
                                ? '#39ff14'
                                : '#6c7ba6'
                            }
                            fontSize={info.state === 'pruned' ? '9' : '10'}
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                          >
                            {info.text}
                          </text>
                        </g>
                      );
                    })}

                    {/* Caja del Plan */}
                    <rect
                      x={p.x - 108}
                      y="160"
                      width="216"
                      height="82"
                      fill={
                        p.winner
                          ? '#0f2b18'
                          : p.pruned
                          ? '#260b18'
                          : pendingPlan
                          ? '#211c0c'
                          : '#111428'
                      }
                      stroke={strokeColor}
                      strokeWidth={p.winner || pendingPlan || p.pruned ? 3 : 2}
                    />
                    <text
                      x={p.x}
                      y="181"
                      textAnchor="middle"
                      fill={p.winner ? '#39ff14' : p.pruned ? '#ff6b9a' : '#ffb800'}
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      {p.title}
                    </text>
                    <text
                      x={p.x}
                      y="198"
                      textAnchor="middle"
                      fill="#cfd9f7"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {p.split}
                    </text>
                    <rect
                      x={p.x - 94}
                      y="209"
                      width="188"
                      height="23"
                      fill="#090a14"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                    />
                    <text
                      x={p.x}
                      y="224"
                      textAnchor="middle"
                      fill={
                        p.winner
                          ? '#39ff14'
                          : p.pruned
                          ? '#ff0055'
                          : pendingPlan
                          ? '#ffb800'
                          : '#e6edf7'
                      }
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      {p.alpha}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
