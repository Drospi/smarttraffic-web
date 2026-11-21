import { motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Pause,
  Play,
  RotateCcw,
  Scissors,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildClassExampleTrace } from '../engine/alphaBeta';
import type { AlphaBetaTrace, TraceStep } from '../engine/types';

interface View4InspectorProps {
  realTrace: AlphaBetaTrace;
}

const MINI_PSEUDO: readonly { num: number; text: string }[] = [
  { num: 4, text: 'β ← +∞ ; ordenar planes (PSR) y muestras (mayor→menor)' },
  { num: 6, text: 'para cada plan p en candidatos:  α ← -∞' },
  { num: 8, text: '  costo ← EVALUAR(p, muestra m)' },
  { num: 9, text: '  α ← max(α, costo)' },
  { num: 10, text: '  si α ≥ β → PODAR muestras restantes' },
  { num: 13, text: 'si α < β → β ← α ; mejor_plan ← p' },
  { num: 15, text: 'retornar mejor_plan, β' },
];

function formatBound(val: number): string {
  if (!Number.isFinite(val)) {
    return val > 0 ? '+∞' : '-∞';
  }
  return val.toFixed(1);
}

export function View4Inspector({ realTrace }: View4InspectorProps) {
  const [traceMode, setTraceMode] = useState<'real' | 'class'>('real');
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
    }, 950);
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

  // Geometría dinámica del árbol SVG MIN–MAX
  const candCount = trace.candidates.length;
  const maxSamples = Math.max(
    1,
    ...trace.candidates.map((c) => c.samples.length)
  );
  const leafSpacing = maxSamples > 5 ? 36 : 56;
  const candBlockWidth = Math.max(190, maxSamples * leafSpacing + 28);
  const svgWidth = Math.max(960, candCount * candBlockWidth + 60);
  const svgHeight = 470;
  const rootX = svgWidth / 2;
  const rootY = 58;
  const candY = 205;
  const leafY = 385;

  const progressPct =
    trace.steps.length > 1
      ? Math.round((stepIndex / (trace.steps.length - 1)) * 100)
      : 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Encabezado y Selector de Traza */}
      <div className="pixel-panel-pink p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-block px-2 py-1 text-[10px] font-pixel bg-[#ff0055]/15 text-[#ff0055] border border-[#ff0055] mb-1.5">
            VISTA 04 / 05 — INSPECTOR INTERACTIVO MIN–MAX
          </span>
          <h2 className="font-pixel text-xs sm:text-sm text-white leading-relaxed">
            INSPECTOR PASO A PASO DE PODA ALFA-BETA
          </h2>
          <p className="text-xs text-[#a5b3db] mt-1">
            {traceMode === 'real'
              ? `Mostrando traza real del Ciclo ${trace.cycle} del Simulador (${trace.candidates.length} planes × ${trace.sampleCount} muestras, ${trace.prunedLeaves} ramas podadas en ${trace.latencyMs.toFixed(2)} ms).`
              : 'Mostrando Ejemplo de Clase (3 planes × 3 muestras) para explicación paso a paso en la defensa.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTraceMode('real')}
            className={`arcade-btn ${
              traceMode === 'real' ? 'arcade-btn-cyan-solid' : 'arcade-btn-cyan'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            ÚLTIMA DECISIÓN REAL (C{realTrace.cycle})
          </button>
          <button
            type="button"
            onClick={() => setTraceMode('class')}
            className={`arcade-btn ${
              traceMode === 'class' ? 'arcade-btn-amber' : 'arcade-btn-amber opacity-80'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            CARGAR EJEMPLO DE CLASE
          </button>
        </div>
      </div>

      {/* Controles de Reproducción Paso a Paso */}
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
            PASO ANTERIOR
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
            PASO SIGUIENTE
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
            {autoPlay ? 'PAUSAR AUTO' : 'AUTO-REPRODUCIR'}
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

      {/* Árbol SVG + Panel Lateral Explicativo */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Árbol MIN-MAX en SVG */}
        <div className="xl:col-span-8 pixel-panel-cyan p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-[#00f0ff]">
                <span className="w-3 h-3 bg-[#00f0ff] inline-block" /> Nodo MIN (Agente)
              </span>
              <span className="flex items-center gap-1.5 text-[#ffb800]">
                <span className="w-3 h-3 bg-[#ffb800] inline-block" /> Nodo MAX (Demanda)
              </span>
              <span className="flex items-center gap-1.5 text-[#39ff14]">
                <span className="w-3 h-3 bg-[#39ff14] inline-block" /> Evaluado / Mejor Plan
              </span>
              <span className="flex items-center gap-1.5 text-[#ff0055]">
                <span className="w-3 h-3 bg-[#ff0055] inline-block" /> Corte α ≥ β (PODADO)
              </span>
            </div>
            <span className="font-mono-code text-[#9aa8d1]">
              Desliza horizontalmente si hay muchos candidatos
            </span>
          </div>

          <div className="overflow-x-auto bg-[#090a14] border-2 border-[#1f2950] p-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              width={svgWidth}
              height={svgHeight}
              className="block mx-auto select-none"
              role="img"
              aria-label="Árbol interactivo MIN-MAX de Poda Alfa-Beta"
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

              {/* Guías horizontales de niveles */}
              <text x="12" y={rootY + 4} fill="#5e6fa3" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                NIVEL 0 (MIN)
              </text>
              <text x="12" y={candY + 4} fill="#5e6fa3" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                NIVEL 1 (MAX)
              </text>
              <text x="12" y={leafY + 4} fill="#5e6fa3" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                HOJAS (M)
              </text>

              {/* Aristas y Nodos por Candidato */}
              {trace.candidates.map((cand, cIdx) => {
                const blockLeft = 30 + cIdx * candBlockWidth;
                const candX = blockLeft + candBlockWidth / 2;
                const candActive = currentStep.activeNodeId === cand.id;
                const candAlpha = currentStep.candidateAlphaSnapshot[cand.id];
                const isCandVisited = candAlpha !== undefined;
                const hasAnyPruned = cand.samples.some((_, sIdx) => prunedSet.has(`${cand.id}-s${sIdx}`));
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
                    {/* Arista Raíz MIN -> Candidato MAX */}
                    <line
                      x1={rootX}
                      y1={rootY + 34}
                      x2={candX}
                      y2={candY - 34}
                      stroke={edgeColor}
                      strokeWidth={isWinnerAtEnd || candActive ? 3 : 2}
                    />

                    {/* Hojas de muestras */}
                    {cand.samples.map((sample, sIdx) => {
                      const totalSpan = (cand.samples.length - 1) * leafSpacing;
                      const leafX = candX - totalSpan / 2 + sIdx * leafSpacing;
                      const leafId = `${cand.id}-s${sIdx}`;
                      const isEvaluated = evaluatedSet.has(leafId);
                      const isPruned = prunedSet.has(leafId);
                      const isLeafActive = currentStep.activeNodeId === leafId;

                      const midX = (candX + leafX) / 2;
                      const midY = (candY + 32 + leafY - 22) / 2;

                      return (
                        <g key={leafId}>
                          {/* Arista Candidato -> Hoja */}
                          <line
                            x1={candX}
                            y1={candY + 32}
                            x2={leafX}
                            y2={leafY - 22}
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
                            strokeDasharray={isPruned ? '5 4' : undefined}
                          />

                          {/* Línea roja neón de corte sobre rama podada */}
                          {isPruned && (
                            <g filter="url(#neonGlowPink)">
                              <line
                                x1={midX - 11}
                                y1={midY - 8}
                                x2={midX + 11}
                                y2={midY + 8}
                                stroke="#ff0055"
                                strokeWidth="3.5"
                              />
                              <line
                                x1={midX - 11}
                                y1={midY + 8}
                                x2={midX + 11}
                                y2={midY - 8}
                                stroke="#ff0055"
                                strokeWidth="3.5"
                              />
                            </g>
                          )}

                          {/* Nodo Hoja */}
                          <rect
                            x={leafX - 16}
                            y={leafY - 22}
                            width={32}
                            height={44}
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
                            y={leafY - 6}
                            textAnchor="middle"
                            fill={isPruned ? '#ff6b9a' : '#9aa8d1'}
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                          >
                            {sample.label.split(' ')[0]}
                          </text>

                          <text
                            x={leafX}
                            y={leafY + 12}
                            textAnchor="middle"
                            fill={
                              isPruned
                                ? '#ff0055'
                                : isEvaluated
                                ? '#39ff14'
                                : '#5c6b99'
                            }
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                          >
                            {isPruned
                              ? '✕'
                              : isEvaluated && sample.cost !== null
                              ? sample.cost.toFixed(0)
                              : '—'}
                          </text>

                          {isPruned && (
                            <text
                              x={leafX}
                              y={leafY + 34}
                              textAnchor="middle"
                              fill="#ff0055"
                              fontSize="8"
                              fontFamily="Press Start 2P, monospace"
                            >
                              POD
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Nodo Nivel 1: Candidato MAX */}
                    <g
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
                        x={candX - 78}
                        y={candY - 34}
                        width={156}
                        height={66}
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
                        y={candY - 17}
                        textAnchor="middle"
                        fill={isWinnerAtEnd ? '#39ff14' : hasAnyPruned ? '#ff6b9a' : '#ffb800'}
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        {cand.label.length > 22 ? `${cand.label.slice(0, 22)}…` : cand.label}
                      </text>

                      <text
                        x={candX}
                        y={candY - 2}
                        textAnchor="middle"
                        fill="#c9d5f7"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        I1:{cand.plan.g11}/{cand.plan.g12} I2:{cand.plan.g21}/{cand.plan.g22}
                      </text>

                      {/* Badge α */}
                      <rect
                        x={candX - 58}
                        y={candY + 8}
                        width={116}
                        height={18}
                        fill="#090a14"
                        stroke={hasAnyPruned ? '#ff0055' : '#ffb800'}
                        strokeWidth="1.5"
                      />
                      <text
                        x={candX}
                        y={candY + 20}
                        textAnchor="middle"
                        fill={hasAnyPruned ? '#ff0055' : '#ffb800'}
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight="bold"
                      >
                        {hasAnyPruned
                          ? `PODADO (α=${formatBound(candAlpha ?? -Infinity)})`
                          : `α = ${candAlpha !== undefined ? formatBound(candAlpha) : '—'}`}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Nodo Raíz MIN (Nivel 0) */}
              <g filter="url(#neonGlowCyan)">
                <rect
                  x={rootX - 125}
                  y={rootY - 34}
                  width={250}
                  height={68}
                  fill="#111428"
                  stroke={currentStep.activeNodeId === 'root-min' ? '#39ff14' : '#00f0ff'}
                  strokeWidth="3"
                />
                <text
                  x={rootX}
                  y={rootY - 14}
                  textAnchor="middle"
                  fill="#00f0ff"
                  fontSize="10"
                  fontFamily="Press Start 2P, monospace"
                >
                  AGENTE MIN (RAÍZ)
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
                  β = {formatBound(currentStep.beta)}
                </text>
                <text
                  x={rootX}
                  y={rootY + 22}
                  textAnchor="middle"
                  fill="#a6b4db"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  Mejor: {currentStep.bestPlanLabel.slice(0, 28)}
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Panel Lateral Explicativo en Español */}
        <aside className="xl:col-span-4 space-y-3">
          {/* Cotas α y β en vivo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="pixel-panel-amber p-3 text-center">
              <div className="text-[10px] font-pixel text-[#ffb800]">COTA α (MAX)</div>
              <div className="font-pixel text-base text-white mt-1.5">
                {formatBound(currentStep.alpha)}
              </div>
              <div className="text-[10px] text-[#9aa8d1] mt-1">Peor costo candidato</div>
            </div>

            <div className="pixel-panel-cyan p-3 text-center">
              <div className="text-[10px] font-pixel text-[#00f0ff]">COTA β (MIN)</div>
              <div className="font-pixel text-base text-[#39ff14] mt-1.5">
                {formatBound(currentStep.beta)}
              </div>
              <div className="text-[10px] text-[#9aa8d1] mt-1">Mejor cota agente</div>
            </div>
          </div>

          {/* Narración Paso a Paso */}
          <div
            className={`p-4 space-y-2.5 ${
              currentStep.type === 'prune'
                ? 'pixel-panel-pink'
                : currentStep.type === 'update_beta' || currentStep.type === 'complete'
                ? 'pixel-panel-green'
                : 'pixel-panel-cyan'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-pixel text-[10px] text-white flex items-center gap-1.5">
                {currentStep.type === 'prune' && <Scissors className="w-4 h-4 text-[#ff0055]" />}
                EXPLICACIÓN DEL PASO {stepIndex + 1}
              </span>
              <span
                className={`px-2 py-0.5 text-[9px] font-pixel ${
                  currentStep.type === 'prune'
                    ? 'bg-[#ff0055] text-white'
                    : currentStep.type === 'update_beta'
                    ? 'bg-[#39ff14] text-[#090a14]'
                    : 'bg-[#00f0ff] text-[#090a14]'
                }`}
              >
                {currentStep.type === 'prune'
                  ? 'CORTE α ≥ β'
                  : currentStep.type === 'update_beta'
                  ? 'MEJORA β'
                  : currentStep.type === 'complete'
                  ? 'DECISIÓN FINAL'
                  : 'EXPLORANDO'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#e6edf7] leading-relaxed">
              {currentStep.narration}
            </p>
          </div>

          {/* Estadísticas de Poda de esta decisión */}
          <div className="pixel-panel p-4 space-y-2 text-xs">
            <div className="font-pixel text-[10px] text-[#00f0ff] mb-2">
              RESUMEN DE PODA DE ESTA DECISIÓN
            </div>
            <div className="flex justify-between">
              <span className="text-[#9aa8d1]">Hojas posibles totales:</span>
              <span className="font-mono-code font-bold text-white">
                {trace.totalLeavesPossible}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9aa8d1]">Hojas evaluadas al paso actual:</span>
              <span className="font-mono-code font-bold text-[#39ff14]">
                {currentStep.evaluatedLeafIds.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9aa8d1]">Ramas podadas al paso actual:</span>
              <span className="font-mono-code font-bold text-[#ff0055]">
                {currentStep.prunedBranchIds.length}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#242f59] pt-2">
              <span className="text-[#9aa8d1]">Eficiencia total de poda:</span>
              <span className="font-mono-code font-bold text-[#00f0ff]">
                {trace.totalLeavesPossible > 0
                  ? ((trace.prunedLeaves / trace.totalLeavesPossible) * 100).toFixed(1)
                  : '0.0'}
                % ahorrado
              </span>
            </div>
          </div>

          {/* Mini Pseudocódigo Sincronizado */}
          <div className="pixel-panel p-3 space-y-1.5">
            <div className="font-pixel text-[9px] text-[#9aa8d1] mb-1">
              TRAZA EN PSEUDOCÓDIGO
            </div>
            <div className="bg-[#090a14] border border-[#222c54] p-2 font-mono-code text-[11px] space-y-1">
              {MINI_PSEUDO.map((line) => {
                const active = currentStep.pseudocodeLines.includes(line.num);
                return (
                  <div
                    key={line.num}
                    className={`px-1.5 py-0.5 ${
                      active
                        ? line.num === 10
                          ? 'bg-[#ff0055]/25 text-[#ff6b9a] font-bold border-l-2 border-[#ff0055]'
                          : 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold border-l-2 border-[#00f0ff]'
                        : 'text-[#6a79a6]'
                    }`}
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </motion.section>
  );
}
