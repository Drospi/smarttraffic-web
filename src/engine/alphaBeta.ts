import { createSeededRng } from './prng';
import { clampPlanToPSR, formatPlanShort, planKey, validatePSR } from './psr';
import { evaluatePlanOnSample } from './trafficModel';
import type {
  AlphaBetaTrace,
  ApproachRecord,
  CycleArrivalSample,
  LinkOccupancy,
  SignalPlan,
  SimulationConfig,
  TraceCandidate,
  TraceStep,
} from './types';

const DELTA_STEPS: readonly number[] = [-6, -3, 0, 3, 6] as const;

interface RawCandidate {
  plan: SignalPlan;
  isCurrentPlan: boolean;
  heuristicScore: number;
}

interface OrderedHorizonSample {
  label: string;
  totalDemand: number;
  horizonArrivals: CycleArrivalSample[];
}

/**
 * Calcula las proporciones de carga real proyectada sobre el horizonte H
 * para que la heurística detecte al instante tanto picos horizontales como inversiones hacia verticales.
 */
function computeDemandRatios(
  queues: ApproachRecord,
  links: LinkOccupancy,
  rates: ApproachRecord,
  horizon: number
): { targetRatioI1: number; targetRatioI2: number } {
  // Proyección sobre H ciclos (cola inicial + llegadas por ciclo * H + aporte del tramo entrante)
  const loadI1F1 = queues['I1-F1'] + rates['I1-F1'] * horizon + links.R21 * 0.7;
  const loadI1F2 = queues['I1-F2'] + rates['I1-F2'] * horizon;
  const loadI2F1 = queues['I2-F1'] + rates['I2-F1'] * horizon + links.R12 * 0.7;
  const loadI2F2 = queues['I2-F2'] + rates['I2-F2'] * horizon;

  return {
    targetRatioI1: loadI1F1 / Math.max(1, loadI1F1 + loadI1F2),
    targetRatioI2: loadI2F1 / Math.max(1, loadI2F1 + loadI2F2),
  };
}

/**
 * Heurística de ordenamiento (Move Ordering):
 * Prioriza planes cuyo reparto de verde se alinea con la carga proyectada de vehículos por ciclo, colas y tramos R12/R21.
 */
function scorePlanHeuristic(
  plan: SignalPlan,
  queues: ApproachRecord,
  links: LinkOccupancy,
  rates: ApproachRecord,
  horizon: number
): number {
  const { targetRatioI1, targetRatioI2 } = computeDemandRatios(queues, links, rates, horizon);

  const actualRatioI1 = plan.g11 / 60;
  const actualRatioI2 = plan.g21 / 60;

  // Menor distancia = mejor candidato (más cercano a la proporción óptima de carga real)
  const diffI1 = Math.abs(actualRatioI1 - targetRatioI1);
  const diffI2 = Math.abs(actualRatioI2 - targetRatioI2);

  // Penalización leve por empujar hacia un tramo ya muy cargado
  const r12Penalty = links.R12 > 18 && plan.g11 > 38 ? 0.08 : 0;
  const r21Penalty = links.R21 > 18 && plan.g21 > 38 ? 0.08 : 0;

  return Number((100 - (diffI1 + diffI2) * 100 - (r12Penalty + r21Penalty) * 100).toFixed(2));
}

/**
 * Búsqueda Local + Plan Objetivo Heurístico + Anclas PSR (estrictamente filtrados por PSR).
 * Permite reaccionar de inmediato (en 1 sola decisión) incluso ante inversiones completas de tráfico
 * (ej. de 44s/16s horizontal a 20s/40s vertical).
 */
function generateOrderedCandidates(
  currentPlan: SignalPlan,
  queues: ApproachRecord,
  links: LinkOccupancy,
  rates: ApproachRecord,
  horizon: number,
  maxCandidates = 6
): RawCandidate[] {
  const seen = new Map<string, RawCandidate>();

  const tryAdd = (plan: SignalPlan, isCurrentPlan: boolean): void => {
    const check = validatePSR(plan);
    if (!check.valid) return;
    const key = planKey(plan);
    if (!seen.has(key)) {
      seen.set(key, {
        plan,
        isCurrentPlan,
        heuristicScore: scorePlanHeuristic(plan, queues, links, rates, horizon),
      });
    }
  };

  // 1) Asegurar plan vigente primero (fija cota inicial Beta)
  tryAdd({ ...currentPlan }, true);

  // 2) Plan objetivo proporcional directo a los vehículos/ciclo y colas actuales + su vecindario Δg
  const { targetRatioI1, targetRatioI2 } = computeDemandRatios(queues, links, rates, horizon);
  const targetPlan = clampPlanToPSR(Math.round(60 * targetRatioI1), Math.round(60 * targetRatioI2));
  tryAdd(targetPlan, false);

  for (const d1 of DELTA_STEPS) {
    for (const d2 of DELTA_STEPS) {
      if (d1 === 0 && d2 === 0) continue;
      // Vecinos alrededor del plan objetivo (reacción instantánea en inversiones)
      const tg11 = targetPlan.g11 + d1;
      const tg21 = targetPlan.g21 + d2;
      tryAdd({ g11: tg11, g12: 60 - tg11, g21: tg21, g22: 60 - tg21 }, false);

      // Vecinos alrededor del plan vigente (búsqueda local clásica)
      const cg11 = currentPlan.g11 + d1;
      const cg21 = currentPlan.g21 + d2;
      tryAdd({ g11: cg11, g12: 60 - cg11, g21: cg21, g22: 60 - cg21 }, false);
    }
  }

  // 3) Planes ancla PSR en los extremos (horizontal, vertical, equilibrado y asimétricos I1≠I2)
  const anchors: readonly SignalPlan[] = [
    { g11: 20, g12: 40, g21: 20, g22: 40 },
    { g11: 44, g12: 16, g21: 44, g22: 16 },
    { g11: 20, g12: 40, g21: 44, g22: 16 },
    { g11: 44, g12: 16, g21: 20, g22: 40 },
    { g11: 30, g12: 30, g21: 30, g22: 30 },
  ];
  for (const anchor of anchors) {
    tryAdd(anchor, false);
  }

  const currentEntry = seen.get(planKey(currentPlan));
  const others = Array.from(seen.values())
    .filter((c) => !c.isCurrentPlan)
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  // Incluir: plan vigente + mejores candidatos heurísticos + 1 candidato contrastante para evidenciar poda
  const selected: RawCandidate[] = [];
  if (currentEntry) {
    selected.push(currentEntry);
  }
  const topSlice = others.slice(0, Math.max(1, maxCandidates - 2));
  selected.push(...topSlice);
  const contrasting = others[others.length - 1];
  if (contrasting && !selected.some((c) => planKey(c.plan) === planKey(contrasting.plan))) {
    selected.push(contrasting);
  }

  return selected.slice(0, maxCandidates);
}

/**
 * Genera M muestras estocásticas Poisson sobre horizonte H ordenadas de MAYOR a MENOR demanda
 * para que el nodo MAX alcance pronto cotas altas y dispare podas α ≥ β.
 */
function generateOrderedPoissonSamples(
  rates: ApproachRecord,
  horizon: number,
  sampleCount: number,
  seed: number
): OrderedHorizonSample[] {
  const rng = createSeededRng(seed);
  const rawSamples: OrderedHorizonSample[] = [];

  for (let m = 0; m < sampleCount; m += 1) {
    const horizonArrivals: CycleArrivalSample[] = [];
    let totalDemand = 0;

    for (let h = 0; h < horizon; h += 1) {
      const sample: CycleArrivalSample = {
        'I1-F1': rng.poisson(rates['I1-F1']),
        'I1-F2': rng.poisson(rates['I1-F2']),
        'I2-F1': rng.poisson(rates['I2-F1']),
        'I2-F2': rng.poisson(rates['I2-F2']),
      };
      totalDemand += sample['I1-F1'] + sample['I1-F2'] + sample['I2-F1'] + sample['I2-F2'];
      horizonArrivals.push(sample);
    }

    rawSamples.push({
      label: `M${m + 1}`,
      totalDemand,
      horizonArrivals,
    });
  }

  // Ordenar de mayor a menor demanda total (adversario evalúa primero escenarios críticos)
  rawSamples.sort((a, b) => b.totalDemand - a.totalDemand);
  return rawSamples.map((s, idx) => ({
    ...s,
    label: `M${idx + 1}`,
  }));
}

export interface AlphaBetaDecisionResult {
  bestPlan: SignalPlan;
  worstCost: number;
  latencyMs: number;
  evaluatedNodes: number;
  prunedBranches: number;
  psrViolations: number;
  trace: AlphaBetaTrace;
}

/**
 * Algoritmo oficial DECIDIR_PODA_ALFA_BETA:
 * - Raíz MIN: Agente SmartTraffic que minimiza el peor costo W(p) = max_m C(p, m)
 * - Nivel 1 MAX: Entorno adversario sobre M=8 muestras Poisson ordenadas (horizonte H=4)
 * - Regla de corte: si α ≥ β, podar inmediatamente el resto de muestras del candidato
 */
export function decidePlanAlphaBeta(
  cycle: number,
  currentPlan: SignalPlan,
  queues: ApproachRecord,
  links: LinkOccupancy,
  effectiveRates: ApproachRecord,
  config: SimulationConfig,
  decisionSeed: number
): AlphaBetaDecisionResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const rawCandidates = generateOrderedCandidates(
    currentPlan,
    queues,
    links,
    effectiveRates,
    config.horizon,
    6
  );
  const samples = generateOrderedPoissonSamples(
    effectiveRates,
    config.horizon,
    config.sampleCount,
    decisionSeed
  );

  const candidates: TraceCandidate[] = rawCandidates.map((c, idx) => ({
    id: `cand-${idx}`,
    label: c.isCurrentPlan
      ? `Plan Vigente ${formatPlanShort(c.plan)}`
      : `Plan ${String.fromCharCode(65 + idx)} ${formatPlanShort(c.plan)}`,
    plan: { ...c.plan },
    isCurrentPlan: c.isCurrentPlan,
    heuristicScore: c.heuristicScore,
    alphaValue: -Infinity,
    pruned: false,
    prunedCount: 0,
    selectedAsBest: false,
    samples: samples.map((s, sIdx) => ({
      sampleIndex: sIdx,
      label: `Esc. ${sIdx + 1}`,
      totalDemand: s.totalDemand,
      avgVehiclesPerCycle: Number((s.totalDemand / Math.max(1, config.horizon)).toFixed(1)),
      horizonArrivals: s.horizonArrivals,
      accumulatedWait: null,
      avgWaitPerVehicle: null,
      maxQueue: null,
      saturatedCycles: null,
      cost: null,
      waitComponent: null,
      queueComponent: null,
      satComponent: null,
      status: 'pending',
    })),
  }));

  const steps: TraceStep[] = [];
  const prunedBranchIds: string[] = [];
  const evaluatedLeafIds: string[] = [];
  const candidateAlphaSnapshot: Record<string, number> = {};

  let beta = Infinity;
  let bestIndex = 0;
  let evaluatedLeaves = 0;
  let prunedLeaves = 0;

  const pushStep = (
    type: TraceStep['type'],
    activeNodeId: string,
    candidateIndex: number | null,
    sampleIndex: number | null,
    alpha: number,
    narration: string,
    pseudocodeLines: number[]
  ): void => {
    steps.push({
      stepIndex: steps.length,
      type,
      activeNodeId,
      candidateIndex,
      sampleIndex,
      alpha,
      beta,
      bestPlanLabel: candidates[bestIndex]?.label ?? '',
      prunedBranchIds: [...prunedBranchIds],
      evaluatedLeafIds: [...evaluatedLeafIds],
      candidateAlphaSnapshot: { ...candidateAlphaSnapshot },
      narration,
      pseudocodeLines,
    });
  };

  pushStep(
    'init',
    'root-min',
    null,
    null,
    -Infinity,
    `Ciclo ${cycle}: El agente va a comparar ${candidates.length} planes de semáforo seguros frente a ${samples.length} escenarios posibles de tráfico (ordenados del más cargado al más ligero). Todavía no hay ningún plan evaluado, así que el puntaje de referencia Beta empieza sin límite.`,
    [1, 2, 3, 4]
  );

  for (let cIdx = 0; cIdx < candidates.length; cIdx += 1) {
    const candidate = candidates[cIdx];
    let alpha = -Infinity;
    candidateAlphaSnapshot[candidate.id] = alpha;

    pushStep(
      'enter_candidate',
      candidate.id,
      cIdx,
      null,
      alpha,
      `Probamos "${candidate.label}" (Av. 20 de Octubre/P. Salazar ${candidate.plan.g11}s/${candidate.plan.g12}s y Av. 6 de Agosto/P. Salazar ${candidate.plan.g21}s/${candidate.plan.g22}s). Buscaremos cuál es su peor puntaje de congestión (Alfa) para compararlo contra el mejor plan guardado hasta ahora (Beta = ${Number.isFinite(beta) ? `${beta.toFixed(1)} pts` : 'sin definir'}).`,
      [5, 6]
    );

    let wasPruned = false;

    for (let sIdx = 0; sIdx < candidate.samples.length; sIdx += 1) {
      const sampleSlot = candidate.samples[sIdx];
      const leafId = `${candidate.id}-s${sIdx}`;

      const evaluation = evaluatePlanOnSample(
        queues,
        links,
        candidate.plan,
        sampleSlot.horizonArrivals,
        config
      );

      evaluatedLeaves += 1;
      sampleSlot.accumulatedWait = evaluation.accumulatedWait;
      sampleSlot.avgWaitPerVehicle = Number(
        (evaluation.accumulatedWait / Math.max(1, sampleSlot.totalDemand)).toFixed(1)
      );
      sampleSlot.maxQueue = evaluation.maxQueue;
      sampleSlot.saturatedCycles = evaluation.saturatedCycles;
      sampleSlot.cost = evaluation.cost;
      sampleSlot.waitComponent = evaluation.waitComponent;
      sampleSlot.queueComponent = evaluation.queueComponent;
      sampleSlot.satComponent = evaluation.satComponent;
      sampleSlot.status = 'evaluated';
      evaluatedLeafIds.push(leafId);

      pushStep(
        'eval_sample',
        leafId,
        cIdx,
        sIdx,
        alpha,
        `En ${sampleSlot.label} llegan ${sampleSlot.totalDemand} vehículos en ${config.horizon} ciclos (${sampleSlot.avgVehiclesPerCycle} vehículos por ciclo). Con este plan se acumulan ${Math.round(evaluation.accumulatedWait)} s de espera, una fila máxima de ${evaluation.maxQueue.toFixed(1)} vehículos y ${evaluation.saturatedCycles} de ${config.horizon} ciclos saturados → Puntaje total: ${evaluation.cost.toFixed(1)} pts.`,
        [7, 8]
      );

      if (evaluation.cost > alpha) {
        alpha = evaluation.cost;
        candidate.alphaValue = alpha;
        candidateAlphaSnapshot[candidate.id] = alpha;

        pushStep(
          'update_alpha',
          candidate.id,
          cIdx,
          sIdx,
          alpha,
          `Nuevo peor caso encontrado para "${candidate.label}": su puntaje Alfa sube a ${alpha.toFixed(1)} pts debido a ${sampleSlot.label} (${sampleSlot.avgVehiclesPerCycle} vehículos por ciclo).`,
          [9]
        );
      }

      // Regla de corte Alfa-Beta: si α >= β, podar el resto de muestras
      if (alpha >= beta) {
        const remainingSamples: string[] = [];
        for (let rem = sIdx + 1; rem < candidate.samples.length; rem += 1) {
          candidate.samples[rem].status = 'pruned';
          const remLeafId = `${candidate.id}-s${rem}`;
          prunedBranchIds.push(remLeafId);
          remainingSamples.push(candidate.samples[rem].label);
          prunedLeaves += 1;
          candidate.prunedCount += 1;
        }
        candidate.pruned = true;
        wasPruned = true;

        pushStep(
          'prune',
          candidate.id,
          cIdx,
          sIdx,
          alpha,
          remainingSamples.length > 0
            ? `¡SE PODA ESTE PLAN! "${candidate.label}" ya alcanzó ${alpha.toFixed(1)} pts (Alfa), que es igual o peor que nuestro mejor plan guardado (${beta.toFixed(1)} pts en Beta). Ya no puede ganar, así que descartamos sin calcular los ${remainingSamples.length} escenarios restantes (${remainingSamples.join(', ')}).`
            : `¡PLAN DESCARTADO! "${candidate.label}" alcanzó ${alpha.toFixed(1)} pts (Alfa), sin lograr mejorar el puntaje de referencia Beta (${beta.toFixed(1)} pts).`,
          [10, 11]
        );
        break;
      }
    }

    if (!wasPruned && alpha < beta) {
      beta = alpha;
      bestIndex = cIdx;
      pushStep(
        'update_beta',
        'root-min',
        cIdx,
        null,
        alpha,
        `¡NUEVO MEJOR PLAN! "${candidate.label}" resistió todos los escenarios con un peor puntaje de solo ${beta.toFixed(1)} pts. El agente actualiza su mejor referencia Beta a ${beta.toFixed(1)} pts.`,
        [12, 13, 14]
      );
    } else if (!wasPruned) {
      pushStep(
        'candidate_done',
        candidate.id,
        cIdx,
        null,
        alpha,
        `Terminó la revisión de "${candidate.label}" con un peor puntaje de ${alpha.toFixed(1)} pts (no mejora al mejor plan actual de ${beta.toFixed(1)} pts).`,
        [12]
      );
    }
  }

  candidates.forEach((c, idx) => {
    c.selectedAsBest = idx === bestIndex;
  });

  const bestCandidate = candidates[bestIndex];
  const psrCheck = validatePSR(bestCandidate.plan);

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const latencyMs = Number(Math.max(0.15, endTime - startTime).toFixed(2));

  pushStep(
    'complete',
    'root-min',
    bestIndex,
    null,
    bestCandidate.alphaValue,
    `Decisión lista en ${latencyMs.toFixed(2)} ms: gana "${bestCandidate.label}" con el menor puntaje de congestión (${beta.toFixed(1)} pts). Solo se calcularon ${evaluatedLeaves} de ${candidates.length * samples.length} escenarios porque la poda ahorró ${prunedLeaves} cálculos innecesarios.`,
    [15]
  );

  const trace: AlphaBetaTrace = {
    source: 'simulator',
    cycle,
    timestampMs: Date.now(),
    latencyMs,
    horizon: config.horizon,
    sampleCount: samples.length,
    initialPlan: { ...currentPlan },
    bestPlan: { ...bestCandidate.plan },
    bestCost: Number(beta.toFixed(2)),
    totalLeavesPossible: candidates.length * samples.length,
    evaluatedLeaves,
    prunedLeaves,
    candidates,
    steps,
  };

  return {
    bestPlan: { ...bestCandidate.plan },
    worstCost: Number(beta.toFixed(2)),
    latencyMs,
    evaluatedNodes: evaluatedLeaves,
    prunedBranches: prunedLeaves,
    psrViolations: psrCheck.valid ? 0 : psrCheck.violations.length,
    trace,
  };
}

/**
 * Ejemplo pedagógico de clase (3 planes × 3 muestras) generado con la misma estructura exacta
 * de poda Alfa-Beta para explicar paso a paso en la defensa.
 */
export function buildClassExampleTrace(): AlphaBetaTrace {
  interface ClassSampleSpec {
    totalDemand: number;
    accumulatedWait: number;
    maxQueue: number;
    saturatedCycles: number;
  }

  interface ClassSpec {
    label: string;
    plan: SignalPlan;
    isCurrentPlan: boolean;
    heuristicScore: number;
    samples: [ClassSampleSpec, ClassSampleSpec, ClassSampleSpec];
  }

  const horizon = 4;

  // Datos reales de tráfico (vehículos, tiempo de espera acumulado, fila máxima y ciclos saturados)
  // El puntaje total se calcula exactamente con esos mismos datos (50% espera + 30% fila máxima + 20% saturación)
  const specs: ClassSpec[] = [
    {
      label: 'Plan A Vigente (30,30 | 30,30)',
      plan: { g11: 30, g12: 30, g21: 30, g22: 30 },
      isCurrentPlan: true,
      heuristicScore: 76.0,
      samples: [
        { totalDemand: 192, accumulatedWait: 9728, maxQueue: 21, saturatedCycles: 1 }, // 32.0 + 21.0 + 5.0 = 58.0
        { totalDemand: 168, accumulatedWait: 8360, maxQueue: 19, saturatedCycles: 1 }, // 27.5 + 19.0 + 5.0 = 51.5
        { totalDemand: 144, accumulatedWait: 7600, maxQueue: 16, saturatedCycles: 0 }, // 25.0 + 16.0 + 0.0 = 41.0
      ],
    },
    {
      label: 'Plan B Desfavorable (24,36 | 24,36)',
      plan: { g11: 24, g12: 36, g21: 24, g22: 36 },
      isCurrentPlan: false,
      heuristicScore: 54.0,
      samples: [
        { totalDemand: 192, accumulatedWait: 10944, maxQueue: 24, saturatedCycles: 2 }, // 36.0 + 24.0 + 10.0 = 70.0 -> PODA
        { totalDemand: 168, accumulatedWait: 9424, maxQueue: 21, saturatedCycles: 1 },
        { totalDemand: 144, accumulatedWait: 8208, maxQueue: 18, saturatedCycles: 1 },
      ],
    },
    {
      label: 'Plan C Óptimo (39,21 | 39,21)',
      plan: { g11: 39, g12: 21, g21: 39, g22: 21 },
      isCurrentPlan: false,
      heuristicScore: 95.5,
      samples: [
        { totalDemand: 192, accumulatedWait: 7904, maxQueue: 15, saturatedCycles: 1 }, // 26.0 + 15.0 + 5.0 = 46.0
        { totalDemand: 168, accumulatedWait: 7296, maxQueue: 13, saturatedCycles: 0 }, // 24.0 + 13.0 + 0.0 = 37.0
        { totalDemand: 144, accumulatedWait: 6384, maxQueue: 11, saturatedCycles: 0 }, // 21.0 + 11.0 + 0.0 = 32.0
      ],
    },
  ];

  const sampleLabels = ['Esc. 1 (Pico)', 'Esc. 2 (Media)', 'Esc. 3 (Suave)'];

  const candidates: TraceCandidate[] = specs.map((spec, idx) => ({
    id: `cand-${idx}`,
    label: spec.label,
    plan: spec.plan,
    isCurrentPlan: spec.isCurrentPlan,
    heuristicScore: spec.heuristicScore,
    alphaValue: -Infinity,
    pruned: false,
    prunedCount: 0,
    selectedAsBest: false,
    samples: sampleLabels.map((sLabel, sIdx) => {
      const sp = spec.samples[sIdx];
      return {
        sampleIndex: sIdx,
        label: sLabel,
        totalDemand: sp.totalDemand,
        avgVehiclesPerCycle: Number((sp.totalDemand / horizon).toFixed(1)),
        horizonArrivals: [],
        accumulatedWait: null,
        avgWaitPerVehicle: null,
        maxQueue: null,
        saturatedCycles: null,
        cost: null,
        waitComponent: null,
        queueComponent: null,
        satComponent: null,
        status: 'pending',
      };
    }),
  }));

  const steps: TraceStep[] = [];
  const prunedBranchIds: string[] = [];
  const evaluatedLeafIds: string[] = [];
  const candidateAlphaSnapshot: Record<string, number> = {};

  let beta = Infinity;
  let bestIndex = 0;
  let evaluatedLeaves = 0;
  let prunedLeaves = 0;

  const pushStep = (
    type: TraceStep['type'],
    activeNodeId: string,
    candidateIndex: number | null,
    sampleIndex: number | null,
    alpha: number,
    narration: string,
    pseudocodeLines: number[]
  ): void => {
    steps.push({
      stepIndex: steps.length,
      type,
      activeNodeId,
      candidateIndex,
      sampleIndex,
      alpha,
      beta,
      bestPlanLabel: candidates[bestIndex].label,
      prunedBranchIds: [...prunedBranchIds],
      evaluatedLeafIds: [...evaluatedLeafIds],
      candidateAlphaSnapshot: { ...candidateAlphaSnapshot },
      narration,
      pseudocodeLines,
    });
  };

  pushStep(
    'init',
    'root-min',
    null,
    null,
    -Infinity,
    'Ejemplo de Clase (3 planes × 3 escenarios de tráfico): El agente compara cuántos segundos esperan los vehículos, qué tan larga se vuelve la fila y si se satura la cuadra central. Empezamos probando el Plan A (el que está activo hoy) para fijar la primera referencia Beta.',
    [1, 2, 3, 4]
  );

  for (let cIdx = 0; cIdx < candidates.length; cIdx += 1) {
    const candidate = candidates[cIdx];
    const spec = specs[cIdx];
    let alpha = -Infinity;
    candidateAlphaSnapshot[candidate.id] = alpha;

    pushStep(
      'enter_candidate',
      candidate.id,
      cIdx,
      null,
      alpha,
      `Probamos "${candidate.label}". Revisaremos primero el escenario más cargado (48 vehículos por ciclo) para hallar su peor puntaje (Alfa) y compararlo con la mejor referencia Beta = ${Number.isFinite(beta) ? `${beta.toFixed(1)} pts` : 'sin definir'}.`,
      [5, 6]
    );

    let wasPruned = false;

    for (let sIdx = 0; sIdx < 3; sIdx += 1) {
      const sp = spec.samples[sIdx];
      const waitComponent = Number((100 * 0.5 * (sp.accumulatedWait / (horizon * 3800))).toFixed(1));
      const queueComponent = Number((100 * 0.3 * (sp.maxQueue / 30)).toFixed(1));
      const satComponent = Number((100 * 0.2 * (sp.saturatedCycles / horizon)).toFixed(1));
      const cost = Number((waitComponent + queueComponent + satComponent).toFixed(1));

      const slot = candidate.samples[sIdx];
      const leafId = `${candidate.id}-s${sIdx}`;

      slot.accumulatedWait = sp.accumulatedWait;
      slot.avgWaitPerVehicle = Number((sp.accumulatedWait / sp.totalDemand).toFixed(1));
      slot.maxQueue = sp.maxQueue;
      slot.saturatedCycles = sp.saturatedCycles;
      slot.cost = cost;
      slot.waitComponent = waitComponent;
      slot.queueComponent = queueComponent;
      slot.satComponent = satComponent;
      slot.status = 'evaluated';
      evaluatedLeaves += 1;
      evaluatedLeafIds.push(leafId);

      pushStep(
        'eval_sample',
        leafId,
        cIdx,
        sIdx,
        alpha,
        `En ${slot.label} llegan ${sp.totalDemand} vehículos (${slot.avgVehiclesPerCycle} vehículos por ciclo): generan ${sp.accumulatedWait.toLocaleString('es-BO')} s de espera (${waitComponent} pts) + fila máxima de ${sp.maxQueue} vehículos (${queueComponent} pts) + ${sp.saturatedCycles} de 4 ciclos saturados (${satComponent} pts) = ${cost.toFixed(1)} pts.`,
        [7, 8]
      );

      if (cost > alpha) {
        alpha = cost;
        candidate.alphaValue = alpha;
        candidateAlphaSnapshot[candidate.id] = alpha;
        pushStep(
          'update_alpha',
          candidate.id,
          cIdx,
          sIdx,
          alpha,
          `El peor puntaje encontrado hasta ahora para "${candidate.label}" (Alfa) se actualiza a ${alpha.toFixed(1)} pts.`,
          [9]
        );
      }

      if (alpha >= beta) {
        const remLabels: string[] = [];
        for (let r = sIdx + 1; r < 3; r += 1) {
          candidate.samples[r].status = 'pruned';
          prunedBranchIds.push(`${candidate.id}-s${r}`);
          remLabels.push(candidate.samples[r].label);
          prunedLeaves += 1;
          candidate.prunedCount += 1;
        }
        candidate.pruned = true;
        wasPruned = true;

        pushStep(
          'prune',
          candidate.id,
          cIdx,
          sIdx,
          alpha,
          `¡SE PODA "${candidate.label}"! Solo en ${slot.label} ya produjo ${alpha.toFixed(1)} pts de congestión (Alfa), superando los ${beta.toFixed(1)} pts del mejor plan guardado (Beta). Como ya no puede ganar, descartamos sin calcular ${remLabels.join(' y ')}.`,
          [10, 11]
        );
        break;
      }
    }

    if (!wasPruned && alpha < beta) {
      beta = alpha;
      bestIndex = cIdx;
      pushStep(
        'update_beta',
        'root-min',
        cIdx,
        null,
        alpha,
        `¡MEJOR PLAN ACTUALIZADO! "${candidate.label}" superó los 3 escenarios con un peor puntaje de ${beta.toFixed(1)} pts. Beta baja a ${beta.toFixed(1)} pts.`,
        [12, 13, 14]
      );
    }
  }

  candidates[bestIndex].selectedAsBest = true;

  pushStep(
    'complete',
    'root-min',
    bestIndex,
    null,
    candidates[bestIndex].alphaValue,
    `Resultado final: el agente elige "${candidates[bestIndex].label}" porque garantiza el menor nivel de congestión (${beta.toFixed(1)} pts en el peor escenario). La poda evitó calcular ${prunedLeaves} escenarios innecesarios.`,
    [15]
  );

  return {
    source: 'class_example',
    cycle: 1,
    timestampMs: Date.now(),
    latencyMs: 0.42,
    horizon,
    sampleCount: 3,
    initialPlan: { g11: 30, g12: 30, g21: 30, g22: 30 },
    bestPlan: { ...candidates[bestIndex].plan },
    bestCost: beta,
    totalLeavesPossible: 9,
    evaluatedLeaves,
    prunedLeaves,
    candidates,
    steps,
  };
}
