import { createSeededRng } from './prng';
import { clampPlanToPSR, formatPlanShort, planKey, validatePSR } from './psr';
import { evaluatePlanOnSample } from './trafficModel';
import type {
  AlphaBetaTrace,
  ApproachRecord,
  CycleArrivalSample,
  LinkOccupancy,
  PlanGenerationFormulaInfo,
  SignalPlan,
  SimulationConfig,
  TraceCandidate,
  TraceStep,
} from './types';

const DELTA_STEPS: readonly number[] = [-6, -3, 0, 3, 6] as const;

interface RawCandidate {
  plan: SignalPlan;
  originTag: string;
  isCurrentPlan: boolean;
  heuristicScore: number;
}

interface OrderedHorizonSample {
  label: string;
  totalDemand: number;
  horizonArrivals: CycleArrivalSample[];
}

/**
 * Fórmula Matemática Sencilla (Regla de Tres / Proporción Directa — sin Machine Learning):
 * Verde Base Horizontal = redondear(60 * Carga_Horizontal / (Carga_Horizontal + Carga_Vertical))
 * Verde Base Vertical   = 60 - Verde Base Horizontal
 * Genera automáticamente el plan proporcional exacto y su plan inverso espejo (ej. 39s/21s ↔ 21s/39s).
 */
export function computeProportionalPlanFormula(
  queues: ApproachRecord,
  links: LinkOccupancy,
  rates: ApproachRecord,
  horizon: number
): PlanGenerationFormulaInfo {
  const loadI1F1 = Number((queues['I1-F1'] + rates['I1-F1'] * horizon + links.R21 * 0.7).toFixed(1));
  const loadI1F2 = Number((queues['I1-F2'] + rates['I1-F2'] * horizon).toFixed(1));
  const loadI2F1 = Number((queues['I2-F1'] + rates['I2-F1'] * horizon + links.R12 * 0.7).toFixed(1));
  const loadI2F2 = Number((queues['I2-F2'] + rates['I2-F2'] * horizon).toFixed(1));

  const ratioI1 = loadI1F1 / Math.max(1, loadI1F1 + loadI1F2);
  const ratioI2 = loadI2F1 / Math.max(1, loadI2F1 + loadI2F2);

  const rawGreenI1 = Number((60 * ratioI1).toFixed(1));
  const rawGreenI2 = Number((60 * ratioI2).toFixed(1));

  const proportionalPlan = clampPlanToPSR(Math.round(rawGreenI1), Math.round(rawGreenI2));
  // Plan inverso espejo: invierte el reparto horizontal/vertical (ej. 39/21 -> 21/39) acotado a PSR
  const inversePlan = clampPlanToPSR(60 - proportionalPlan.g11, 60 - proportionalPlan.g21);

  return {
    rateI1F1: rates['I1-F1'],
    rateI1F2: rates['I1-F2'],
    rateI2F1: rates['I2-F1'],
    rateI2F2: rates['I2-F2'],
    loadI1F1,
    loadI1F2,
    loadI2F1,
    loadI2F2,
    ratioI1Pct: Number((ratioI1 * 100).toFixed(1)),
    ratioI2Pct: Number((ratioI2 * 100).toFixed(1)),
    rawGreenI1,
    rawGreenI2,
    proportionalPlan,
    inversePlan,
  };
}

/**
 * Heurística de ordenamiento (Move Ordering):
 * Prioriza planes cuyo reparto de verde se alinea con la carga proyectada de vehículos por ciclo, colas y tramos R12/R21.
 */
function scorePlanHeuristic(
  plan: SignalPlan,
  formula: PlanGenerationFormulaInfo,
  links: LinkOccupancy
): number {
  const targetRatioI1 = formula.ratioI1Pct / 100;
  const targetRatioI2 = formula.ratioI2Pct / 100;

  const actualRatioI1 = plan.g11 / 60;
  const actualRatioI2 = plan.g21 / 60;

  const diffI1 = Math.abs(actualRatioI1 - targetRatioI1);
  const diffI2 = Math.abs(actualRatioI2 - targetRatioI2);

  const r12Penalty = links.R12 > 18 && plan.g11 > 38 ? 0.08 : 0;
  const r21Penalty = links.R21 > 18 && plan.g21 > 38 ? 0.08 : 0;

  return Number((100 - (diffI1 + diffI2) * 100 - (r12Penalty + r21Penalty) * 100).toFixed(2));
}

/**
 * Genera candidatos a partir de la fórmula matemática proporcional directa (sin aprendizaje de modelos):
 * 1. Plan Vigente
 * 2. Plan Proporcional Exacto (regla de tres sobre vehículos/ciclo)
 * 3. Vecinos de ajuste fino (±3s, ±6s) alrededor del proporcional y del vigente
 * 4. Plan Inverso Espejo (ej. 21s/39s cuando el proporcional es 39s/21s)
 * 5. Anclas seguras PSR (equilibrado 30/30 y extremos asimétricos)
 */
function generateOrderedCandidates(
  currentPlan: SignalPlan,
  formula: PlanGenerationFormulaInfo,
  links: LinkOccupancy,
  maxCandidates = 6
): RawCandidate[] {
  const seen = new Map<string, RawCandidate>();

  const tryAdd = (plan: SignalPlan, originTag: string, isCurrentPlan: boolean): void => {
    const check = validatePSR(plan);
    if (!check.valid) return;
    const key = planKey(plan);
    if (!seen.has(key)) {
      seen.set(key, {
        plan,
        originTag,
        isCurrentPlan,
        heuristicScore: scorePlanHeuristic(plan, formula, links),
      });
    }
  };

  // 1) Plan vigente (fija la primera cota Beta)
  tryAdd({ ...currentPlan }, 'Plan Vigente', true);

  // 2) Plan proporcional calculado por regla de tres directa
  const targetPlan = formula.proportionalPlan;
  tryAdd(targetPlan, 'Proporcional exacto', false);

  // 3) Plan inverso espejo (60 - verde proporcional) para cubrir siempre la ruta opuesta
  const invPlan = formula.inversePlan;
  tryAdd(invPlan, 'Plan Inverso (espejo)', false);

  // 4) Variaciones de ajuste fino (±3s, ±6s) alrededor del proporcional y del vigente
  for (const d1 of DELTA_STEPS) {
    for (const d2 of DELTA_STEPS) {
      if (d1 === 0 && d2 === 0) continue;
      const tg11 = targetPlan.g11 + d1;
      const tg21 = targetPlan.g21 + d2;
      const deltaLabel = d1 === d2 ? `Ajuste ${d1 > 0 ? `+${d1}` : d1}s` : 'Ajuste fino I1/I2';
      tryAdd({ g11: tg11, g12: 60 - tg11, g21: tg21, g22: 60 - tg21 }, deltaLabel, false);

      const cg11 = currentPlan.g11 + d1;
      const cg21 = currentPlan.g21 + d2;
      tryAdd({ g11: cg11, g12: 60 - cg11, g21: cg21, g22: 60 - cg21 }, 'Vecino local', false);
    }
  }

  // 5) Anclas PSR (extremos horizontales, verticales, asimétricos y equilibrado)
  const anchors: readonly { plan: SignalPlan; tag: string }[] = [
    { plan: { g11: 20, g12: 40, g21: 20, g22: 40 }, tag: 'Máx. Verticales' },
    { plan: { g11: 44, g12: 16, g21: 44, g22: 16 }, tag: 'Máx. P. Salazar' },
    { plan: { g11: 20, g12: 40, g21: 44, g22: 16 }, tag: 'Asimétrico I1↓/I2↑' },
    { plan: { g11: 44, g12: 16, g21: 20, g22: 40 }, tag: 'Asimétrico I1↑/I2↓' },
    { plan: { g11: 30, g12: 30, g21: 30, g22: 30 }, tag: 'Equilibrado 30/30' },
  ];
  for (const anchor of anchors) {
    tryAdd(anchor.plan, anchor.tag, false);
  }

  const currentEntry = seen.get(planKey(currentPlan));
  const inverseEntry = seen.get(planKey(invPlan));
  const others = Array.from(seen.values())
    .filter((c) => !c.isCurrentPlan)
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  const selected: RawCandidate[] = [];
  if (currentEntry) {
    selected.push(currentEntry);
  }

  // Agregar los mejores candidatos ordenados por la fórmula proporcional
  for (const cand of others) {
    if (selected.length >= maxCandidates - 1) break;
    if (!selected.some((s) => planKey(s.plan) === planKey(cand.plan))) {
      selected.push(cand);
    }
  }

  // Garantizar que el Plan Inverso (espejo) esté siempre presente para contrastar y evidenciar poda
  if (inverseEntry && !selected.some((s) => planKey(s.plan) === planKey(inverseEntry.plan))) {
    selected.push(inverseEntry);
  } else {
    const contrasting = others[others.length - 1];
    if (contrasting && !selected.some((s) => planKey(s.plan) === planKey(contrasting.plan))) {
      selected.push(contrasting);
    }
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

  const planGeneration = computeProportionalPlanFormula(
    queues,
    links,
    effectiveRates,
    config.horizon
  );

  const rawCandidates = generateOrderedCandidates(
    currentPlan,
    planGeneration,
    links,
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
    originTag: c.originTag,
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
    planGeneration,
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
 * Ejemplo pedagógico de clase (5 planes generados con la fórmula matemática proporcional
 * directa + plan inverso espejo × 3 escenarios de tráfico).
 * Soporta tanto congestión en C. Pedro Salazar (gana 39s/21s) como congestión inversa
 * en Av. 20 de Octubre / Av. 6 de Agosto (gana 21s/39s) usando exactamente la misma fórmula.
 */
export function buildClassExampleTrace(
  direction: 'horizontal_peak' | 'vertical_peak' = 'horizontal_peak'
): AlphaBetaTrace {
  interface ClassSampleSpec {
    totalDemand: number;
    accumulatedWait: number;
    maxQueue: number;
    saturatedCycles: number;
  }

  interface ClassSpec {
    label: string;
    originTag: string;
    plan: SignalPlan;
    isCurrentPlan: boolean;
    heuristicScore: number;
    samples: [ClassSampleSpec, ClassSampleSpec, ClassSampleSpec];
  }

  const horizon = 4;
  const isHorizontal = direction === 'horizontal_peak';

  const planGeneration: PlanGenerationFormulaInfo = isHorizontal
    ? {
        rateI1F1: 16.0,
        rateI1F2: 8.5,
        rateI2F1: 15.5,
        rateI2F2: 8.5,
        loadI1F1: 64.0,
        loadI1F2: 34.0,
        loadI2F1: 62.0,
        loadI2F2: 34.0,
        ratioI1Pct: 65.3,
        ratioI2Pct: 64.6,
        rawGreenI1: 39.2,
        rawGreenI2: 38.8,
        proportionalPlan: { g11: 39, g12: 21, g21: 39, g22: 21 },
        inversePlan: { g11: 21, g12: 39, g21: 21, g22: 39 },
      }
    : {
        rateI1F1: 8.5,
        rateI1F2: 16.0,
        rateI2F1: 8.5,
        rateI2F2: 15.5,
        loadI1F1: 34.0,
        loadI1F2: 64.0,
        loadI2F1: 34.0,
        loadI2F2: 62.0,
        ratioI1Pct: 34.7,
        ratioI2Pct: 35.4,
        rawGreenI1: 20.8,
        rawGreenI2: 21.2,
        proportionalPlan: { g11: 21, g12: 39, g21: 21, g22: 39 },
        inversePlan: { g11: 39, g12: 21, g21: 39, g22: 21 },
      };

  // 5 planes generados con la fórmula matemática: Vigente + Proporcional + Ajustes ±3s + Plan Inverso (21s/39s ↔ 39s/21s)
  const specs: ClassSpec[] = isHorizontal
    ? [
        {
          label: 'Plan Vigente (30,30 | 30,30)',
          originTag: 'Plan Vigente',
          plan: { g11: 30, g12: 30, g21: 30, g22: 30 },
          isCurrentPlan: true,
          heuristicScore: 76.0,
          samples: [
            { totalDemand: 192, accumulatedWait: 9728, maxQueue: 21, saturatedCycles: 1 }, // 58.0
            { totalDemand: 168, accumulatedWait: 8360, maxQueue: 19, saturatedCycles: 1 }, // 51.5
            { totalDemand: 144, accumulatedWait: 7600, maxQueue: 16, saturatedCycles: 0 }, // 41.0
          ],
        },
        {
          label: 'Plan B Proporcional (39,21 | 39,21)',
          originTag: 'Fórmula proporcional',
          plan: { g11: 39, g12: 21, g21: 39, g22: 21 },
          isCurrentPlan: false,
          heuristicScore: 99.2,
          samples: [
            { totalDemand: 192, accumulatedWait: 7600, maxQueue: 14, saturatedCycles: 1 }, // 25.0 + 14.0 + 5.0 = 44.0
            { totalDemand: 168, accumulatedWait: 6992, maxQueue: 12, saturatedCycles: 0 }, // 23.0 + 12.0 + 0.0 = 35.0
            { totalDemand: 144, accumulatedWait: 6080, maxQueue: 10, saturatedCycles: 0 }, // 20.0 + 10.0 + 0.0 = 30.0
          ],
        },
        {
          label: 'Plan C Ajuste +3s (42,18 | 42,18)',
          originTag: 'Ajuste +3s',
          plan: { g11: 42, g12: 18, g21: 42, g22: 18 },
          isCurrentPlan: false,
          heuristicScore: 91.5,
          samples: [
            { totalDemand: 192, accumulatedWait: 8208, maxQueue: 16, saturatedCycles: 1 }, // 27.0 + 16.0 + 5.0 = 48.0 -> PODA (>= 44.0)
            { totalDemand: 168, accumulatedWait: 7296, maxQueue: 14, saturatedCycles: 0 },
            { totalDemand: 144, accumulatedWait: 6384, maxQueue: 11, saturatedCycles: 0 },
          ],
        },
        {
          label: 'Plan D Ajuste -3s (36,24 | 36,24)',
          originTag: 'Ajuste -3s',
          plan: { g11: 36, g12: 24, g21: 36, g22: 24 },
          isCurrentPlan: false,
          heuristicScore: 90.0,
          samples: [
            { totalDemand: 192, accumulatedWait: 8512, maxQueue: 17, saturatedCycles: 1 }, // 28.0 + 17.0 + 5.0 = 50.0 -> PODA (>= 44.0)
            { totalDemand: 168, accumulatedWait: 7600, maxQueue: 14, saturatedCycles: 0 },
            { totalDemand: 144, accumulatedWait: 6688, maxQueue: 12, saturatedCycles: 0 },
          ],
        },
        {
          label: 'Plan E Inverso (21,39 | 21,39)',
          originTag: 'Plan Inverso (espejo)',
          plan: { g11: 21, g12: 39, g21: 21, g22: 39 },
          isCurrentPlan: false,
          heuristicScore: 39.8,
          samples: [
            { totalDemand: 192, accumulatedWait: 11552, maxQueue: 26, saturatedCycles: 2 }, // 38.0 + 26.0 + 10.0 = 74.0 -> PODA INMEDIATA
            { totalDemand: 168, accumulatedWait: 9728, maxQueue: 22, saturatedCycles: 1 },
            { totalDemand: 144, accumulatedWait: 8512, maxQueue: 19, saturatedCycles: 1 },
          ],
        },
      ]
    : [
        {
          label: 'Plan Vigente (30,30 | 30,30)',
          originTag: 'Plan Vigente',
          plan: { g11: 30, g12: 30, g21: 30, g22: 30 },
          isCurrentPlan: true,
          heuristicScore: 76.0,
          samples: [
            { totalDemand: 192, accumulatedWait: 9728, maxQueue: 21, saturatedCycles: 1 }, // 58.0
            { totalDemand: 168, accumulatedWait: 8360, maxQueue: 19, saturatedCycles: 1 }, // 51.5
            { totalDemand: 144, accumulatedWait: 7600, maxQueue: 16, saturatedCycles: 0 }, // 41.0
          ],
        },
        {
          label: 'Plan B Inverso Prop. (21,39 | 21,39)',
          originTag: 'Fórmula proporcional',
          plan: { g11: 21, g12: 39, g21: 21, g22: 39 },
          isCurrentPlan: false,
          heuristicScore: 99.1,
          samples: [
            { totalDemand: 192, accumulatedWait: 7448, maxQueue: 14, saturatedCycles: 1 }, // 24.5 + 14.0 + 5.0 = 43.5
            { totalDemand: 168, accumulatedWait: 6840, maxQueue: 12, saturatedCycles: 0 }, // 22.5 + 12.0 + 0.0 = 34.5
            { totalDemand: 144, accumulatedWait: 5928, maxQueue: 10, saturatedCycles: 0 }, // 19.5 + 10.0 + 0.0 = 29.5
          ],
        },
        {
          label: 'Plan C Ajuste +3s (24,36 | 24,36)',
          originTag: 'Ajuste +3s',
          plan: { g11: 24, g12: 36, g21: 24, g22: 36 },
          isCurrentPlan: false,
          heuristicScore: 91.2,
          samples: [
            { totalDemand: 192, accumulatedWait: 8208, maxQueue: 16, saturatedCycles: 1 }, // 48.0 -> PODA
            { totalDemand: 168, accumulatedWait: 7296, maxQueue: 14, saturatedCycles: 0 },
            { totalDemand: 144, accumulatedWait: 6384, maxQueue: 11, saturatedCycles: 0 },
          ],
        },
        {
          label: 'Plan D Máx. Vert. (20,40 | 20,40)',
          originTag: 'Límite PSR vertical',
          plan: { g11: 20, g12: 40, g21: 20, g22: 40 },
          isCurrentPlan: false,
          heuristicScore: 94.0,
          samples: [
            { totalDemand: 192, accumulatedWait: 7904, maxQueue: 15, saturatedCycles: 1 }, // 46.0 -> PODA (>= 43.5)
            { totalDemand: 168, accumulatedWait: 7144, maxQueue: 13, saturatedCycles: 0 },
            { totalDemand: 144, accumulatedWait: 6232, maxQueue: 11, saturatedCycles: 0 },
          ],
        },
        {
          label: 'Plan E Espejo Horiz. (39,21 | 39,21)',
          originTag: 'Plan Inverso (espejo)',
          plan: { g11: 39, g12: 21, g21: 39, g22: 21 },
          isCurrentPlan: false,
          heuristicScore: 39.5,
          samples: [
            { totalDemand: 192, accumulatedWait: 11552, maxQueue: 26, saturatedCycles: 2 }, // 74.0 -> PODA INMEDIATA
            { totalDemand: 168, accumulatedWait: 9728, maxQueue: 22, saturatedCycles: 1 },
            { totalDemand: 144, accumulatedWait: 8512, maxQueue: 19, saturatedCycles: 1 },
          ],
        },
      ];

  const sampleLabels = ['Esc. 1 (Pico)', 'Esc. 2 (Media)', 'Esc. 3 (Suave)'];

  const candidates: TraceCandidate[] = specs.map((spec, idx) => ({
    id: `cand-${idx}`,
    label: spec.label,
    originTag: spec.originTag,
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
    isHorizontal
      ? 'Ejemplo con Fórmula Proporcional (5 planes × 3 escenarios — Congestión en C. Pedro Salazar): Con 16 veh/ciclo horizontal vs. 8.5 vertical, la regla de tres propone 39s/21s, sus ajustes ±3s y también su inverso 21s/39s. Empezamos probando el Plan Vigente (30s/30s) para fijar la referencia Beta.'
      : 'Ejemplo con Fórmula Proporcional INVERSA (5 planes × 3 escenarios — Congestión en Av. 20 de Octubre y 6 de Agosto): Con 8.5 veh/ciclo horizontal vs. 16 vertical, la MISMA regla de tres calcula automáticamente 21s/39s, sus ajustes cercanos y el espejo 39s/21s.',
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
    totalLeavesPossible: candidates.length * 3,
    evaluatedLeaves,
    prunedLeaves,
    planGeneration,
    candidates,
    steps,
  };
}
