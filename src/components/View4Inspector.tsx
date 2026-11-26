import { motion } from 'framer-motion';
import {
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildClassExampleTrace } from '../engine/alphaBeta';
import type { AlphaBetaTrace, TraceCandidate, TraceSampleEval, TraceStep } from '../engine/types';
import { ManualAlphaBetaExercise } from './ManualAlphaBetaExercise';

interface View4InspectorProps {
  realTrace: AlphaBetaTrace;
}

function formatScore(val: number): string {
  if (!Number.isFinite(val)) {
    return val > 0 ? 'Sin límite aún' : 'Sin calcular aún';
  }
  return `${val.toFixed(1)} pts`;
}

function formatShortScore(val: number): string {
  if (!Number.isFinite(val)) {
    return val > 0 ? '∞' : '—';
  }
  return `${val.toFixed(1)}`;
}

function getShortPlanTitle(cand: TraceCandidate): string {
  return cand.label.split('(')[0].trim();
}

export function View4Inspector({ realTrace }: View4InspectorProps) {
  const [traceMode, setTraceMode] = useState<'real' | 'class'>('class');
  const classExampleTrace = useMemo(() => buildClassExampleTrace(), []);
  const trace = traceMode === 'real' ? realTrace : classExampleTrace;
  const currentTraceId = `${traceMode}-${trace.cycle}-${trace.timestampMs}`;

  const [playback, setPlayback] = useState<{
    traceId: string;
    stepIndex: number;
    autoPlay: boolean;
  }>({
    traceId: currentTraceId,
    stepIndex: 0,
    autoPlay: false,
  });

  const stepIndex =
    playback.traceId === currentTraceId
      ? Math.min(playback.stepIndex, Math.max(0, trace.steps.length - 1))
      : 0;
  const autoPlay = playback.traceId === currentTraceId && playback.autoPlay;

  const setStepIndex = (next: number | ((prev: number) => number)): void => {
    setPlayback((prev) => {
      const base = prev.traceId === currentTraceId ? prev.stepIndex : 0;
      const resolved = typeof next === 'function' ? next(base) : next;
      return {
        traceId: currentTraceId,
        stepIndex: Math.max(0, Math.min(trace.steps.length - 1, resolved)),
        autoPlay: prev.traceId === currentTraceId ? prev.autoPlay : false,
      };
    });
  };

  const setAutoPlay = (next: boolean | ((prev: boolean) => boolean)): void => {
    setPlayback((prev) => {
      const baseAuto = prev.traceId === currentTraceId ? prev.autoPlay : false;
      const baseStep = prev.traceId === currentTraceId ? prev.stepIndex : 0;
      const resolved = typeof next === 'function' ? next(baseAuto) : next;
      return {
        traceId: currentTraceId,
        stepIndex: baseStep,
        autoPlay: resolved,
      };
    });
  };

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setPlayback((prev) => {
        if (prev.traceId !== currentTraceId) return prev;
        if (prev.stepIndex >= trace.steps.length - 1) {
          return { ...prev, autoPlay: false };
        }
        return { ...prev, stepIndex: prev.stepIndex + 1 };
      });
    }, 1150);
    return () => window.clearInterval(timer);
  }, [autoPlay, currentTraceId, trace.steps.length]);

  const currentStep: TraceStep =
    trace.steps[Math.min(stepIndex, trace.steps.length - 1)] ?? trace.steps[0];

  const prunedSet = useMemo(
    () => new Set(currentStep?.prunedBranchIds ?? []),
    [currentStep]
  );
  const evaluatedSet = useMemo(
    () => new Set(currentStep?.evaluatedLeafIds ?? []),
    [currentStep]
  );

  // Encontrar candidato y escenario de referencia para mostrar SIEMPRE el desglose con datos reales
  const activeCandidate: TraceCandidate | null =
    currentStep.candidateIndex !== null
      ? trace.candidates[currentStep.candidateIndex] ?? null
      : null;

  const activeSample: TraceSampleEval | null = useMemo(() => {
    if (!activeCandidate) return null;
    if (currentStep.sampleIndex !== null) {
      return activeCandidate.samples[currentStep.sampleIndex] ?? null;
    }
    // Si estamos en actualización de Beta o cierre del candidato, mostrar el escenario que definió su peor puntaje (Alfa)
    const evaluatedSamples = activeCandidate.samples.filter((s, idx) =>
      evaluatedSet.has(`${activeCandidate.id}-s${idx}`) && s.cost !== null
    );
    if (evaluatedSamples.length === 0) return null;
    return evaluatedSamples.reduce((worst, item) =>
      (item.cost ?? -Infinity) > (worst.cost ?? -Infinity) ? item : worst
    );
  }, [activeCandidate, currentStep.sampleIndex, evaluatedSet]);

  const jumpToNode = (nodeId: string): void => {
    const found = trace.steps.find((s) => s.activeNodeId === nodeId);
    if (found) {
      setAutoPlay(false);
      setStepIndex(found.stepIndex);
    }
  };

  // Geometría amplia y legible del árbol SVG
  const candCount = trace.candidates.length;
  const maxSamples = Math.max(1, ...trace.candidates.map((c) => c.samples.length));
  const leafWidth = 74;
  const leafSpacing = 82;
  const candBlockWidth = Math.max(260, maxSamples * leafSpacing + 32);
  const leftMargin = 165;
  const svgWidth = Math.max(980, leftMargin + candCount * candBlockWidth + 32);
  const svgHeight = 520;
  const rootX = leftMargin + (candCount * candBlockWidth) / 2;
  const rootY = 66;
  const candY = 232;
  const leafY = 420;

  const progressPct =
    trace.steps.length > 1
      ? Math.round((stepIndex / (trace.steps.length - 1)) * 100)
      : 100;

  // Lista de puntajes ya evaluados del candidato activo para explicar de dónde sale Alfa
  const activeCandidateEvaluatedCosts = useMemo(() => {
    if (!activeCandidate) return [];
    return activeCandidate.samples
      .filter((s, idx) => evaluatedSet.has(`${activeCandidate.id}-s${idx}`) && s.cost !== null)
      .map((s) => ({
        label: s.label,
        cost: s.cost as number,
      }));
  }, [activeCandidate, evaluatedSet]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Encabezado */}
      <div className="pixel-panel-pink p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-block px-2 py-1 text-[10px] font-pixel bg-[#ff0055]/15 text-[#ff0055] border border-[#ff0055] mb-1.5">
            VISTA 04 / 05 — INSPECTOR VISUAL DE DECISIONES
          </span>
          <h2 className="font-pixel text-xs sm:text-sm text-white leading-relaxed">
            INSPECTOR PASO A PASO DE PODA ALFA-BETA (CON DATOS REALES)
          </h2>
          <p className="text-xs text-[#a5b3db] mt-1">
            {traceMode === 'real'
              ? `Mostrando la decisión real del Ciclo ${trace.cycle} del Simulador: ${trace.candidates.length} planes comparados contra ${trace.sampleCount} escenarios de tráfico (${trace.prunedLeaves} escenarios ahorrados en ${trace.latencyMs.toFixed(2)} ms).`
              : 'Mostrando el Ejemplo de Clase (3 planes × 3 escenarios de tráfico) ideal para explicar cómo nacen Alfa, Beta y la poda a partir de vehículos, espera y filas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTraceMode('class')}
            className={`arcade-btn ${
              traceMode === 'class' ? 'arcade-btn-amber' : 'arcade-btn-amber opacity-75'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            EJEMPLO DE CLASE (3×3)
          </button>
          <button
            type="button"
            onClick={() => setTraceMode('real')}
            className={`arcade-btn ${
              traceMode === 'real' ? 'arcade-btn-cyan-solid' : 'arcade-btn-cyan'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            ÚLTIMA DECISIÓN REAL (CICLO {realTrace.cycle})
          </button>
        </div>
      </div>

      {/* Guía rápida de lectura del árbol en 3 frases claras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-[#111428] border-2 border-[#00f0ff] p-3">
          <div className="font-pixel text-[10px] text-[#00f0ff] mb-1">1. ARRIBA: EL AGENTE (BETA)</div>
          <p className="text-[#d6e0fa]">
            El agente quiere el plan con el <strong>menor puntaje de congestión</strong>. Guarda el mejor puntaje logrado hasta el momento en <strong>Beta</strong>.
          </p>
        </div>
        <div className="bg-[#111428] border-2 border-[#ffb800] p-3">
          <div className="font-pixel text-[10px] text-[#ffb800] mb-1">2. CENTRO: CADA PLAN (ALFA)</div>
          <p className="text-[#d6e0fa]">
            Cada plan de semáforo se prueba contra escenarios de tráfico (del más cargado al más suave). Su <strong>peor resultado</strong> hasta ahora es <strong>Alfa</strong>.
          </p>
        </div>
        <div className="bg-[#111428] border-2 border-[#ff0055] p-3">
          <div className="font-pixel text-[10px] text-[#ff0055] mb-1">3. CUÁNDO SE PODA (CORTE)</div>
          <p className="text-[#d6e0fa]">
            Si el peor puntaje del plan (<strong>Alfa</strong>) ya es <strong>igual o mayor</strong> que el mejor plan guardado (<strong>Beta</strong>), se descartan sin calcular sus escenarios restantes.
          </p>
        </div>
      </div>

      {/* Controles de Reproducción */}
      <div className="pixel-panel p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={stepIndex <= 0}
            onClick={() => {
              setAutoPlay(false);
              setStepIndex((prev) => Math.max(0, prev - 1));
            }}
            className="arcade-btn arcade-btn-cyan !py-2 !px-3"
          >
            <ChevronLeft className="w-4 h-4" />
            ANTERIOR
          </button>

          <button
            type="button"
            disabled={stepIndex >= trace.steps.length - 1}
            onClick={() => {
              setAutoPlay(false);
              setStepIndex((prev) => Math.min(trace.steps.length - 1, prev + 1));
            }}
            className="arcade-btn arcade-btn-cyan !py-2 !px-3"
          >
            SIGUIENTE
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (stepIndex >= trace.steps.length - 1) {
                setStepIndex(0);
              }
              setAutoPlay((prev) => !prev);
            }}
            className={`arcade-btn !py-2 !px-3 ${
              autoPlay ? 'arcade-btn-amber' : 'arcade-btn-green'
            }`}
          >
            {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {autoPlay ? 'PAUSAR' : 'AUTO-REPRODUCIR'}
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoPlay(false);
              setStepIndex(0);
            }}
            className="arcade-btn arcade-btn-pink !py-2 !px-3"
          >
            <RotateCcw className="w-4 h-4" />
            REINICIAR
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-[200px] max-w-md">
          <span className="font-mono-code text-xs text-[#00f0ff] whitespace-nowrap">
            Paso {stepIndex + 1} / {trace.steps.length}
          </span>
          <input
            type="range"
            aria-label="Selector de paso de poda Alfa-Beta"
            min={0}
            max={Math.max(0, trace.steps.length - 1)}
            value={stepIndex}
            onChange={(e) => {
              setAutoPlay(false);
              setStepIndex(Number(e.target.value));
            }}
            className="w-full retro-range"
          />
          <span className="font-mono-code text-xs text-[#9aa8d1]">{progressPct}%</span>
        </div>
      </div>

      {/* PANEL DE CÁLCULO TRANSPARENTE EN TEXTO (CÓMO SALEN ALFA Y BETA CON DATOS REALES) */}
      <div className="pixel-panel-green p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#213d29] pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#39ff14]" />
            <h3 className="font-pixel text-xs text-[#39ff14]">
              ¿DE DÓNDE SALEN LOS NÚMEROS EN ESTE PASO? (DESGLOSE CON DATOS REALES)
            </h3>
          </div>
          <span
            className={`px-2.5 py-1 text-[10px] font-pixel ${
              currentStep.type === 'prune'
                ? 'bg-[#ff0055] text-white'
                : currentStep.type === 'update_beta' || currentStep.type === 'complete'
                ? 'bg-[#39ff14] text-[#090a14]'
                : 'bg-[#00f0ff] text-[#090a14]'
            }`}
          >
            {currentStep.type === 'prune'
              ? 'CORTE: ALFA ALCANZÓ O SUPERÓ A BETA'
              : currentStep.type === 'update_beta'
              ? 'NUEVO MEJOR PLAN (BETA MEJORA)'
              : currentStep.type === 'complete'
              ? 'DECISIÓN FINAL LISTA'
              : 'CALCULANDO ESCENARIO'}
          </span>
        </div>

        {/* Narración clara del paso actual */}
        <div className="bg-[#090a14] border-l-4 border-[#00f0ff] p-3 text-xs sm:text-sm text-[#eef4ff] leading-relaxed">
          {currentStep.narration}
        </div>

        {/* 3 Bloques: Datos del Tráfico -> Cálculo en Texto -> Cómo se definen Alfa y Beta */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
          {/* Bloque 1: Variables conocidas del tráfico */}
          <div className="lg:col-span-4 bg-[#090a14] border-2 border-[#293566] p-3.5 space-y-2">
            <div className="font-pixel text-[9px] text-[#00f0ff]">
              1. DATOS REALES QUE CONOCEMOS
            </div>
            {activeCandidate && activeSample && activeSample.cost !== null ? (
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between border-b border-[#1c2447] pb-1">
                  <span className="text-[#9aa8d1]">Plan revisado:</span>
                  <span className="font-bold text-white">{getShortPlanTitle(activeCandidate)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1c2447] pb-1">
                  <span className="text-[#9aa8d1]">Escenario de tráfico:</span>
                  <span className="font-bold text-[#ffb800]">{activeSample.label}</span>
                </div>
                <div className="flex justify-between border-b border-[#1c2447] pb-1">
                  <span className="text-[#9aa8d1]">Vehículos totales ({trace.horizon} ciclos):</span>
                  <span className="font-bold text-white">{activeSample.totalDemand} vehículos</span>
                </div>
                <div className="flex justify-between border-b border-[#1c2447] pb-1">
                  <span className="text-[#9aa8d1]">Cantidad de vehículos por ciclo:</span>
                  <span className="font-bold text-[#00f0ff]">
                    {activeSample.avgVehiclesPerCycle.toFixed(1)} veh/ciclo
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#1c2447] pb-1">
                  <span className="text-[#9aa8d1]">Tiempo de espera acumulado:</span>
                  <span className="font-bold text-[#ffb800]">
                    {Math.round(activeSample.accumulatedWait ?? 0).toLocaleString('es-BO')} s
                    {activeSample.avgWaitPerVehicle !== null
                      ? ` (~${activeSample.avgWaitPerVehicle.toFixed(1)} s/veh)`
                      : ''}
                  </span>
                </div>
                <div className="flex justify-between border-b border-[#1c2447] pb-1">
                  <span className="text-[#9aa8d1]">Fila más larga alcanzada:</span>
                  <span className="font-bold text-[#ff6b9a]">
                    {(activeSample.maxQueue ?? 0).toFixed(1)} vehículos
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9aa8d1]">Ciclos con cuadra saturada:</span>
                  <span className="font-bold text-white">
                    {activeSample.saturatedCycles ?? 0} de {trace.horizon} ciclos
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[#9aa8d1] leading-relaxed">
                Avanza al siguiente paso o haz clic en cualquier caja del árbol de abajo para ver los vehículos, el tiempo de espera y el desglose completo de ese escenario.
              </p>
            )}
          </div>

          {/* Bloque 2: Cómo se obtiene el puntaje (en texto claro, sin símbolos extraños) */}
          <div className="lg:col-span-4 bg-[#090a14] border-2 border-[#ffb800]/80 p-3.5 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-pixel text-[9px] text-[#ffb800]">
                2. CÁLCULO DEL PUNTAJE EN PALABRAS
              </div>
              <div className="bg-[#111428] border border-[#2c3866] p-2 text-[11px] text-[#d6e0fa] leading-relaxed">
                <strong>Puntaje de congestión</strong> = Parte por <strong>Tiempo de espera</strong> (peso 50%) + Parte por <strong>Fila más larga</strong> (peso 30%) + Parte por <strong>Saturación de cuadras</strong> (peso 20%).
              </div>

              {activeSample && activeSample.cost !== null ? (
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#00f0ff]">• Tiempo de espera (50%):</span>
                    <span className="font-bold text-white">
                      +{(activeSample.waitComponent ?? 0).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#ffb800]">• Fila más larga (30%):</span>
                    <span className="font-bold text-white">
                      +{(activeSample.queueComponent ?? 0).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#ff6b9a]">• Saturación de cuadra (20%):</span>
                    <span className="font-bold text-white">
                      +{(activeSample.satComponent ?? 0).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="border-t-2 border-[#39ff14] pt-2 mt-1 flex justify-between items-center">
                    <span className="font-bold text-[#39ff14]">SUMA TOTAL DEL ESCENARIO:</span>
                    <span className="font-pixel text-xs text-[#39ff14]">
                      {activeSample.cost.toFixed(1)} pts
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#8f9ec9]">
                  Cuando el paso evalúe un escenario de tráfico, aquí verás exactamente cuántos puntos aporta cada variable.
                </p>
              )}
            </div>
            <div className="text-[10px] text-[#8f9ec9]">
              Mientras <strong>más bajo</strong> sea este puntaje, menos espera y menos trancadera genera el plan.
            </div>
          </div>

          {/* Bloque 3: Qué significan Alfa y Beta en este momento exacto */}
          <div className="lg:col-span-4 bg-[#090a14] border-2 border-[#39ff14]/80 p-3.5 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="font-pixel text-[9px] text-[#39ff14]">
                3. CÓMO SALEN ALFA Y BETA AQUÍ
              </div>

              <div className="bg-[#111428] border-l-4 border-[#ffb800] p-2.5 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-pixel text-[9px] text-[#ffb800]">ALFA (PEOR CASO DEL PLAN)</span>
                  <span className="font-pixel text-xs text-white">{formatScore(currentStep.alpha)}</span>
                </div>
                <p className="text-[11px] text-[#cfd9f7]">
                  {activeCandidateEvaluatedCosts.length > 0
                    ? `Es el número más alto entre los escenarios ya probados de este plan: [${activeCandidateEvaluatedCosts
                        .map((item) => `${item.label}: ${item.cost.toFixed(1)}`)
                        .join(', ')}].`
                    : 'Aún no se ha evaluado ningún escenario para este plan.'}
                </p>
              </div>

              <div className="bg-[#111428] border-l-4 border-[#00f0ff] p-2.5 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-pixel text-[9px] text-[#00f0ff]">BETA (MEJOR PLAN GUARDADO)</span>
                  <span className="font-pixel text-xs text-[#39ff14]">{formatScore(currentStep.beta)}</span>
                </div>
                <p className="text-[11px] text-[#cfd9f7]">
                  {Number.isFinite(currentStep.beta)
                    ? `Es el mejor puntaje más bajo que ya conseguimos con "${currentStep.bestPlanLabel.split('(')[0].trim()}". Ningún plan que iguale o supere ${currentStep.beta.toFixed(1)} pts puede ganar.`
                    : 'Todavía estamos evaluando el primer plan para establecer la primera referencia Beta.'}
                </p>
              </div>
            </div>

            {currentStep.type === 'prune' ? (
              <div className="bg-[#290a18] border border-[#ff0055] p-2 text-[11px] text-[#ffc4d8] flex items-center gap-2 font-bold">
                <Scissors className="w-4 h-4 text-[#ff0055] shrink-0" />
                <span>
                  Alfa ({formatShortScore(currentStep.alpha)}) es mayor o igual que Beta ({formatShortScore(currentStep.beta)}) → ¡Se podan los escenarios sobrantes!
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[#9aa8d1] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#39ff14] shrink-0" />
                <span>
                  Evaluados: <strong className="text-white">{currentStep.evaluatedLeafIds.length}</strong> · Podados:{' '}
                  <strong className="text-[#ff0055]">{currentStep.prunedBranchIds.length}</strong> de {trace.totalLeavesPossible}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ÁRBOL INTERACTIVO EN SVG AMPLIO Y LEGIBLE */}
      <div className="pixel-panel-cyan p-3 sm:p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#00f0ff]">
              <span className="w-3 h-3 bg-[#00f0ff] inline-block" /> Agente (elige el menor puntaje)
            </span>
            <span className="flex items-center gap-1.5 text-[#ffb800]">
              <span className="w-3 h-3 bg-[#ffb800] inline-block" /> Plan de semáforo (busca su peor caso)
            </span>
            <span className="flex items-center gap-1.5 text-[#39ff14]">
              <span className="w-3 h-3 bg-[#39ff14] inline-block" /> Escenario evaluado / Plan ganador
            </span>
            <span className="flex items-center gap-1.5 text-[#ff0055]">
              <span className="w-3 h-3 bg-[#ff0055] inline-block" /> Rama podada (descartada sin calcular)
            </span>
          </div>
          <span className="text-[#9aa8d1]">
            Tip: haz clic en cualquier caja del árbol para inspeccionar sus datos reales
          </span>
        </div>

        <div className="overflow-x-auto bg-[#090a14] border-2 border-[#1f2950] p-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            width={svgWidth}
            height={svgHeight}
            className="block mx-auto select-none"
            role="img"
            aria-label="Árbol interactivo de decisión con poda Alfa-Beta y datos reales de tráfico"
          >
            <defs>
              <filter id="neonGlowCyan" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00f0ff" floodOpacity="0.8" />
              </filter>
              <filter id="neonGlowPink" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ff0055" floodOpacity="0.85" />
              </filter>
              <filter id="neonGlowGreen" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#39ff14" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Etiquetas descriptivas de cada nivel en el margen izquierdo */}
            <g fontFamily="JetBrains Mono, monospace">
              <rect x="10" y={rootY - 28} width="142" height="56" fill="#111428" stroke="#00f0ff" strokeWidth="1.5" />
              <text x="81" y={rootY - 8} textAnchor="middle" fill="#00f0ff" fontSize="10" fontWeight="bold">
                NIVEL 1: AGENTE
              </text>
              <text x="81" y={rootY + 8} textAnchor="middle" fill="#c7d3f5" fontSize="9">
                Elige el MENOR
              </text>
              <text x="81" y={rootY + 20} textAnchor="middle" fill="#39ff14" fontSize="9">
                puntaje (Beta)
              </text>

              <rect x="10" y={candY - 28} width="142" height="56" fill="#111428" stroke="#ffb800" strokeWidth="1.5" />
              <text x="81" y={candY - 8} textAnchor="middle" fill="#ffb800" fontSize="10" fontWeight="bold">
                NIVEL 2: PLANES
              </text>
              <text x="81" y={candY + 8} textAnchor="middle" fill="#c7d3f5" fontSize="9">
                Busca el PEOR
              </text>
              <text x="81" y={candY + 20} textAnchor="middle" fill="#ffb800" fontSize="9">
                escenario (Alfa)
              </text>

              <rect x="10" y={leafY - 28} width="142" height="56" fill="#111428" stroke="#39ff14" strokeWidth="1.5" />
              <text x="81" y={leafY - 8} textAnchor="middle" fill="#39ff14" fontSize="10" fontWeight="bold">
                NIVEL 3: TRÁFICO
              </text>
              <text x="81" y={leafY + 8} textAnchor="middle" fill="#c7d3f5" fontSize="9">
                Vehículos / ciclo
              </text>
              <text x="81" y={leafY + 20} textAnchor="middle" fill="#00f0ff" fontSize="9">
                → Puntaje real
              </text>
            </g>

            {/* Ramas y Cajas por cada Plan Candidato */}
            {trace.candidates.map((cand, cIdx) => {
              const blockLeft = leftMargin + cIdx * candBlockWidth;
              const candX = blockLeft + candBlockWidth / 2;
              const candActive = currentStep.activeNodeId === cand.id;
              const candAlpha = currentStep.candidateAlphaSnapshot[cand.id];
              const isCandVisited = candAlpha !== undefined;
              const hasAnyPruned = cand.samples.some((_, sIdx) =>
                prunedSet.has(`${cand.id}-s${sIdx}`)
              );
              const isWinnerAtEnd =
                stepIndex === trace.steps.length - 1 && cand.selectedAsBest;

              const edgeColor = isWinnerAtEnd
                ? '#39ff14'
                : hasAnyPruned
                ? '#ff0055'
                : candActive
                ? '#00f0ff'
                : isCandVisited
                ? '#ffb800'
                : '#27325c';

              return (
                <g key={cand.id}>
                  {/* Línea Raíz -> Plan */}
                  <line
                    x1={rootX}
                    y1={rootY + 42}
                    x2={candX}
                    y2={candY - 44}
                    stroke={edgeColor}
                    strokeWidth={isWinnerAtEnd || candActive ? 3.5 : 2}
                  />

                  {/* Escenarios de tráfico (Nivel 3) */}
                  {cand.samples.map((sample, sIdx) => {
                    const totalSpan = (cand.samples.length - 1) * leafSpacing;
                    const leafX = candX - totalSpan / 2 + sIdx * leafSpacing;
                    const leafId = `${cand.id}-s${sIdx}`;
                    const isEvaluated = evaluatedSet.has(leafId);
                    const isPruned = prunedSet.has(leafId);
                    const isLeafActive = currentStep.activeNodeId === leafId;

                    const midX = (candX + leafX) / 2;
                    const midY = (candY + 44 + leafY - 36) / 2;

                    return (
                      <g
                        key={leafId}
                        className="cursor-pointer"
                        onClick={() => jumpToNode(leafId)}
                      >
                        {/* Línea Plan -> Escenario */}
                        <line
                          x1={candX}
                          y1={candY + 44}
                          x2={leafX}
                          y2={leafY - 36}
                          stroke={
                            isPruned
                              ? '#ff0055'
                              : isLeafActive
                              ? '#00f0ff'
                              : isEvaluated
                              ? '#39ff14'
                              : '#222b52'
                          }
                          strokeWidth={isLeafActive || isPruned ? 2.5 : 1.5}
                          strokeDasharray={isPruned ? '6 4' : undefined}
                        />

                        {/* Marca roja neón de corte sobre rama podada */}
                        {isPruned && (
                          <g filter="url(#neonGlowPink)">
                            <line
                              x1={midX - 12}
                              y1={midY - 9}
                              x2={midX + 12}
                              y2={midY + 9}
                              stroke="#ff0055"
                              strokeWidth="3.5"
                            />
                            <line
                              x1={midX - 12}
                              y1={midY + 9}
                              x2={midX + 12}
                              y2={midY - 9}
                              stroke="#ff0055"
                              strokeWidth="3.5"
                            />
                          </g>
                        )}

                        {/* Caja de escenario de tráfico */}
                        <rect
                          x={leafX - leafWidth / 2}
                          y={leafY - 36}
                          width={leafWidth}
                          height={74}
                          fill={
                            isPruned
                              ? '#290a18'
                              : isLeafActive
                              ? '#0c2838'
                              : isEvaluated
                              ? '#0d2616'
                              : '#111428'
                          }
                          stroke={
                            isPruned
                              ? '#ff0055'
                              : isLeafActive
                              ? '#00f0ff'
                              : isEvaluated
                              ? '#39ff14'
                              : '#2b3663'
                          }
                          strokeWidth={isLeafActive ? 3 : 2}
                          filter={isLeafActive ? 'url(#neonGlowCyan)' : undefined}
                        />

                        <text
                          x={leafX}
                          y={leafY - 19}
                          textAnchor="middle"
                          fill={isPruned ? '#ff6b9a' : '#c9d5f7'}
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="bold"
                        >
                          {sample.label.split(' ')[0]} {sample.label.split(' ')[1] ?? ''}
                        </text>

                        <text
                          x={leafX}
                          y={leafY - 3}
                          textAnchor="middle"
                          fill="#00f0ff"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {sample.avgVehiclesPerCycle.toFixed(0)} veh/c
                        </text>

                        <line
                          x1={leafX - leafWidth / 2 + 6}
                          y1={leafY + 6}
                          x2={leafX + leafWidth / 2 - 6}
                          y2={leafY + 6}
                          stroke={isPruned ? '#661433' : '#243059'}
                          strokeWidth="1"
                        />

                        <text
                          x={leafX}
                          y={leafY + 24}
                          textAnchor="middle"
                          fill={
                            isPruned
                              ? '#ff0055'
                              : isEvaluated
                              ? '#39ff14'
                              : '#6d7ca8'
                          }
                          fontSize={isPruned ? '9' : '11'}
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="bold"
                        >
                          {isPruned
                            ? 'PODADO'
                            : isEvaluated && sample.cost !== null
                            ? `${sample.cost.toFixed(1)} pts`
                            : 'Pendiente'}
                        </text>
                      </g>
                    );
                  })}

                  {/* Caja de Plan Candidato (Nivel 2) */}
                  <g
                    className="cursor-pointer"
                    onClick={() => jumpToNode(cand.id)}
                    filter={
                      isWinnerAtEnd
                        ? 'url(#neonGlowGreen)'
                        : candActive
                        ? 'url(#neonGlowCyan)'
                        : hasAnyPruned
                        ? 'url(#neonGlowPink)'
                        : undefined
                    }
                  >
                    <rect
                      x={candX - 116}
                      y={candY - 44}
                      width={232}
                      height={88}
                      fill={
                        isWinnerAtEnd
                          ? '#0f2b18'
                          : hasAnyPruned
                          ? '#260b18'
                          : candActive
                          ? '#18244a'
                          : '#111428'
                      }
                      stroke={
                        isWinnerAtEnd
                          ? '#39ff14'
                          : hasAnyPruned
                          ? '#ff0055'
                          : candActive
                          ? '#00f0ff'
                          : isCandVisited
                          ? '#ffb800'
                          : '#334073'
                      }
                      strokeWidth={candActive || isWinnerAtEnd ? 3 : 2}
                    />

                    <text
                      x={candX}
                      y={candY - 23}
                      textAnchor="middle"
                      fill={isWinnerAtEnd ? '#39ff14' : hasAnyPruned ? '#ff6b9a' : '#ffb800'}
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      {isWinnerAtEnd ? `★ ${getShortPlanTitle(cand)}` : getShortPlanTitle(cand)}
                    </text>

                    <text
                      x={candX}
                      y={candY - 5}
                      textAnchor="middle"
                      fill="#d7e1fa"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      20 Oct: {cand.plan.g11}s/{cand.plan.g12}s · 6 Ago: {cand.plan.g21}s/{cand.plan.g22}s
                    </text>

                    {/* Badge Alfa claro */}
                    <rect
                      x={candX - 100}
                      y={candY + 8}
                      width={200}
                      height={24}
                      fill="#090a14"
                      stroke={
                        isWinnerAtEnd
                          ? '#39ff14'
                          : hasAnyPruned
                          ? '#ff0055'
                          : '#ffb800'
                      }
                      strokeWidth="1.5"
                    />
                    <text
                      x={candX}
                      y={candY + 24}
                      textAnchor="middle"
                      fill={
                        isWinnerAtEnd
                          ? '#39ff14'
                          : hasAnyPruned
                          ? '#ff0055'
                          : '#ffb800'
                      }
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                    >
                      {hasAnyPruned
                        ? `DESCARTADO (Alfa = ${formatShortScore(candAlpha ?? -Infinity)} pts)`
                        : isWinnerAtEnd
                        ? `GANADOR (Peor caso: ${formatShortScore(candAlpha ?? -Infinity)} pts)`
                        : `Peor caso (Alfa): ${candAlpha !== undefined ? `${formatShortScore(candAlpha)} pts` : '—'}`}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Caja Raíz del Agente (Nivel 1) */}
            <g filter="url(#neonGlowCyan)">
              <rect
                x={rootX - 175}
                y={rootY - 40}
                width={350}
                height={82}
                fill="#111428"
                stroke={currentStep.activeNodeId === 'root-min' ? '#39ff14' : '#00f0ff'}
                strokeWidth="3"
              />
              <text
                x={rootX}
                y={rootY - 18}
                textAnchor="middle"
                fill="#00f0ff"
                fontSize="10"
                fontFamily="Press Start 2P, monospace"
              >
                AGENTE SMARTTRAFFIC
              </text>
              <text
                x={rootX}
                y={rootY + 5}
                textAnchor="middle"
                fill="#39ff14"
                fontSize="12"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
              >
                Mejor referencia (Beta): {formatScore(currentStep.beta)}
              </text>
              <text
                x={rootX}
                y={rootY + 26}
                textAnchor="middle"
                fill="#c7d3f5"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                Mejor plan hasta ahora: {currentStep.bestPlanLabel.split('(')[0].trim()}
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Ejercicio interactivo guiado para resolver a mano paso a paso con respuesta oculta */}
      <ManualAlphaBetaExercise />
    </motion.section>
  );
}
