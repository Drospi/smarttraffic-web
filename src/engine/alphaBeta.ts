import { createSeededRng } from './prng';
import { formatPlanShort, planKey, validatePSR } from './psr';
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
 * Heurística de ordenamiento (Move Ordering):
 * Prioriza planes cuyo reparto de verde se alinea con la presión actual de colas y tramos R12/R21.
 */
function scorePlanHeuristic(
  plan: SignalPlan,
  queues: ApproachRecord,
  links: LinkOccupancy,
  rates: ApproachRecord
): number {
  const pressureI1F1 = queues['I1-F1'] + rates['I1-F1'] * 1.15 + links.R21 * 0.7;
  const pressureI1F2 = queues['I1-F2'] + rates['I1-F2'] * 1.15;
  const pressureI2F1 = queues['I2-F1'] + rates['I2-F1'] * 1.15 + links.R12 * 0.7;
  const pressureI2F2 = queues['I2-F2'] + rates['I2-F2'] * 1.15;

  const targetRatioI1 = pressureI1F1 / Math.max(1, pressureI1F1 + pressureI1F2);
  const targetRatioI2 = pressureI2F1 / Math.max(1, pressureI2F1 + pressureI2F2);

  const actualRatioI1 = plan.g11 / 60;
  const actualRatioI2 = plan.g21 / 60;

  // Menor distancia = mejor candidato (más cercano a la proporción óptima de colas)
  const diffI1 = Math.abs(actualRatioI1 - targetRatioI1);
  const diffI2 = Math.abs(actualRatioI2 - targetRatioI2);

  // Penalización leve por empujar hacia un tramo ya muy cargado
  const r12Penalty = links.R12 > 18 && plan.g11 > 38 ? 0.08 : 0;
  const r21Penalty = links.R21 > 18 && plan.g21 > 38 ? 0.08 : 0;

  return Number((100 - (diffI1 + diffI2) * 100 - (r12Penalty + r21Penalty) * 100).toFixed(2));
}

/**
 * Búsqueda Local (hasta 2 iteraciones de vecindario Δg ∈ {-6, -3, 0, +3, +6})
 * estrictamente filtrada por el validador PSR y ordenada heurísticamente.
 */
function generateOrderedCandidates(
  currentPlan: SignalPlan,
  queues: ApproachRecord,
  links: LinkOccupancy,
  rates: ApproachRecord,
  maxCandidates = 7
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
        heuristicScore: scorePlanHeuristic(plan, queues, links, rates),
      });
    }
  };

  // Asegurar plan vigente primero
  tryAdd({ ...currentPlan }, true);

  // Iteración 1: vecinos directos desde el plan vigente
  for (const d1 of DELTA_STEPS) {
    for (const d2 of DELTA_STEPS) {
      if (d1 === 0 && d2 === 0) continue;
      const g11 = currentPlan.g11 + d1;
      const g21 = currentPlan.g21 + d2;
      tryAdd({ g11, g12: 60 - g11, g21, g22: 60 - g21 }, false);
    }
  }

  // Seleccionar el mejor vecino heurístico para expandir una 2da iteración de búsqueda local
  const iter1Sorted = Array.from(seen.values())
    .filter((c) => !c.isCurrentPlan)
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  const pivot = iter1Sorted[0];
  if (pivot) {
    for (const d1 of DELTA_STEPS) {
      for (const d2 of DELTA_STEPS) {
        if (d1 === 0 && d2 === 0) continue;
        const g11 = pivot.plan.g11 + d1;
        const g21 = pivot.plan.g21 + d2;
        tryAdd({ g11, g12: 60 - g11, g21, g22: 60 - g21 }, false);
      }
    }
  }

  const currentEntry = seen.get(planKey(currentPlan));
  const others = Array.from(seen.values())
    .filter((c) => !c.isCurrentPlan)
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  // Incluir los mejores candidatos heurísticos + 1 candidato contrastante para evidenciar poda clara
  const selected: RawCandidate[] = [];
  if (currentEntry) {
    selected.push(currentEntry);
  }
  const topSlice = others.slice(0, Math.max(1, maxCandidates - 2));
  selected.push(...topSlice);
  const contrasting = others[Math.min(others.length - 1, topSlice.length + 2)];
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

  const rawCandidates = generateOrderedCandidates(currentPlan, queues, links, effectiveRates, 6);
  const samples = generateOrderedPoissonSamples(
    effectiveRates,
    config.horizon,
    config.sampleCount,
    decisionSeed
  );

  const candidates: TraceCandidate[] = rawCandidates.map((c, idx) => ({
    id: `cand-${idx}`,
    label: c.isCurrentPlan ? `Vigente ${formatPlanShort(c.plan)}` : `Plan ${String.fromCharCode(65 + idx)} ${formatPlanShort(c.plan)}`,
    plan: { ...c.plan },
    isCurrentPlan: c.isCurrentPlan,
    heuristicScore: c.heuristicScore,
    alphaValue: -Infinity,
    pruned: false,
    prunedCount: 0,
    selectedAsBest: false,
    samples: samples.map((s, sIdx) => ({
      sampleIndex: sIdx,
      label: s.label,
      totalDemand: s.totalDemand,
      horizonArrivals: s.horizonArrivals,
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
    `Ciclo ${cycle}: Inicia búsqueda MIN-MAX con ${candidates.length} planes válidos PSR y ${samples.length} muestras Poisson ordenadas de mayor a menor demanda. β = +∞.`,
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
      `Evaluando nodo MAX "${candidate.label}" (heúrística ${candidate.heuristicScore.toFixed(1)}). Se inicia α = -∞ frente a cota actual β = ${Number.isFinite(beta) ? beta.toFixed(2) : '+∞'}.`,
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
        `Muestra ${sampleSlot.label} (${sampleSlot.totalDemand} veh en H=${config.horizon}) para ${candidate.label}: costo C = ${evaluation.cost.toFixed(2)} (Espera ${evaluation.waitComponent.toFixed(1)}, Cola ${evaluation.queueComponent.toFixed(1)}, Sat ${evaluation.satComponent.toFixed(1)}).`,
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
          `El entorno adversario (MAX) actualiza α de ${candidate.label} a ${alpha.toFixed(2)} tras la muestra ${sampleSlot.label}.`,
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
            ? `¡CORTE ALFA-BETA! En ${candidate.label}, α (${alpha.toFixed(2)}) ≥ β (${beta.toFixed(2)}). Es imposible mejorar al mejor plan vigente. Se podan ${remainingSamples.length} muestras restantes (${remainingSamples.join(', ')}).`
            : `¡CORTE ALFA-BETA! En ${candidate.label}, α (${alpha.toFixed(2)}) ≥ β (${beta.toFixed(2)}) en la última muestra. El plan queda descartado.`,
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
        `El nodo raíz (MIN) mejora su cota superior: β baja a ${beta.toFixed(2)} con el nuevo mejor plan "${candidate.label}".`,
        [12, 13, 14]
      );
    } else if (!wasPruned) {
      pushStep(
        'candidate_done',
        candidate.id,
        cIdx,
        null,
        alpha,
        `Finalizó "${candidate.label}" con peor costo ${alpha.toFixed(2)} (no mejora β = ${beta.toFixed(2)}).`,
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
    `Decisión completada en ${latencyMs.toFixed(2)} ms: se selecciona "${bestCandidate.label}" con peor costo β = ${beta.toFixed(2)}. Evaluadas ${evaluatedLeaves}/${candidates.length * samples.length} hojas (${prunedLeaves} ramas podadas, 0 violaciones PSR).`,
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
  interface ClassSpec {
    label: string;
    plan: SignalPlan;
    isCurrentPlan: boolean;
    heuristicScore: number;
    sampleCosts: [number, number, number];
    sampleDemands: [number, number, number];
  }

  const specs: ClassSpec[] = [
    {
      label: 'Plan A Vigente (30,30 | 30,30)',
      plan: { g11: 30, g12: 30, g21: 30, g22: 30 },
      isCurrentPlan: true,
      heuristicScore: 76.0,
      sampleCosts: [58.0, 51.4, 44.2],
      sampleDemands: [192, 168, 145],
    },
    {
      label: 'Plan B Desfavorable (24,36 | 24,36)',
      plan: { g11: 24, g12: 36, g21: 24, g22: 36 },
      isCurrentPlan: false,
      heuristicScore: 54.0,
      sampleCosts: [65.0, 59.2, 52.0],
      sampleDemands: [192, 168, 145],
    },
    {
      label: 'Plan C Óptimo (39,21 | 39,21)',
      plan: { g11: 39, g12: 21, g21: 39, g22: 21 },
      isCurrentPlan: false,
      heuristicScore: 95.5,
      sampleCosts: [46.5, 41.2, 36.8],
      sampleDemands: [192, 168, 145],
    },
  ];

  const sampleLabels = ['M3 (Pico)', 'M2 (Media)', 'M1 (Baja)'];

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
    samples: sampleLabels.map((sLabel, sIdx) => ({
      sampleIndex: sIdx,
      label: sLabel,
      totalDemand: spec.sampleDemands[sIdx],
      horizonArrivals: [],
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
    'Ejemplo de Clase (3 planes × 3 muestras): La raíz MIN busca minimizar el peor costo W(p). Se inicializa β = +∞ y se evalúa primero el Plan A (Vigente) para fijar una cota fuerte.',
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
      `Entrando al nodo MAX "${candidate.label}". α = -∞, cota global del agente β = ${Number.isFinite(beta) ? beta.toFixed(1) : '+∞'}.`,
      [5, 6]
    );

    let wasPruned = false;

    for (let sIdx = 0; sIdx < 3; sIdx += 1) {
      const cost = spec.sampleCosts[sIdx];
      const slot = candidate.samples[sIdx];
      const leafId = `${candidate.id}-s${sIdx}`;

      slot.cost = cost;
      slot.waitComponent = Number((cost * 0.52).toFixed(1));
      slot.queueComponent = Number((cost * 0.31).toFixed(1));
      slot.satComponent = Number((cost * 0.17).toFixed(1));
      slot.status = 'evaluated';
      evaluatedLeaves += 1;
      evaluatedLeafIds.push(leafId);

      pushStep(
        'eval_sample',
        leafId,
        cIdx,
        sIdx,
        alpha,
        `Se evalúa ${slot.label} en ${candidate.label} → Costo = ${cost.toFixed(1)}.`,
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
          `El nodo MAX actualiza su peor caso conocido: α = ${alpha.toFixed(1)}.`,
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
          `${candidate.label} alcanzó costo ${alpha.toFixed(1)} en ${slot.label}. Como α (${alpha.toFixed(1)}) ≥ β (${beta.toFixed(1)}), es imposible que mejore al plan vigente. Se podan ${remLabels.join(' y ')}.`,
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
        `El nodo MIN encuentra un plan estrictamente mejor: β se actualiza a ${beta.toFixed(1)} (${candidate.label}).`,
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
    `Resultado final: se elige "${candidates[bestIndex].label}" con peor costo β = ${beta.toFixed(1)}. Se ahorraron ${prunedLeaves} evaluaciones mediante corte α ≥ β.`,
    [15]
  );

  return {
    source: 'class_example',
    cycle: 1,
    timestampMs: Date.now(),
    latencyMs: 0.42,
    horizon: 4,
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
