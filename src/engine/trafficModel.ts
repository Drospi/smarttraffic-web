import type {
  ApproachId,
  ApproachRecord,
  CorridorWorldState,
  CycleArrivalSample,
  LinkOccupancy,
  ScenarioDefinition,
  ScenarioId,
  SignalPhase,
  SignalPlan,
  SimulationConfig,
} from './types';
import { PSR_BOUNDS } from './psr';

export const APPROACH_IDS: readonly ApproachId[] = ['I1-F1', 'I1-F2', 'I2-F1', 'I2-F2'] as const;

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  habitual: {
    id: 'habitual',
    name: 'Demanda Habitual',
    shortName: 'Habitual',
    description:
      'Flujo moderado en Sopocachi por C. Pedro Salazar entre Plaza Avaroa / Av. 20 de Octubre (I1) y Av. 6 de Agosto (I2).',
    baseRates: {
      'I1-F1': 9.2,
      'I1-F2': 5.2,
      'I2-F1': 9.0,
      'I2-F2': 4.8,
    },
  },
  pico: {
    id: 'pico',
    name: 'Hora Pico Sopocachi',
    shortName: 'Hora Pico',
    description:
      'Alta congestión en C. Pedro Salazar y conexión Belisario Salinas con riesgo de trancadera entre Av. 20 de Octubre y Av. 6 de Agosto.',
    baseRates: {
      'I1-F1': 15.5,
      'I1-F2': 7.0,
      'I2-F1': 15.0,
      'I2-F2': 6.5,
    },
  },
  rafaga: {
    id: 'rafaga',
    name: 'Ráfaga Av. 20 Oct / 6 Ago',
    shortName: 'Ráfaga',
    description:
      'Demanda base con ráfaga intensa subiendo por Av. 20 de Octubre y bajando por Av. 6 de Agosto (ciclos 8 a 16).',
    baseRates: {
      'I1-F1': 11.0,
      'I1-F2': 6.0,
      'I2-F1': 10.5,
      'I2-F2': 5.5,
    },
    burstRates: {
      'I1-F1': 8.0,
      'I1-F2': 17.5,
      'I2-F1': 8.0,
      'I2-F2': 16.5,
    },
    burstStartCycle: 8,
    burstEndCycle: 16,
  },
};

export function createDefaultConfig(scenario: ScenarioId = 'pico'): SimulationConfig {
  return {
    cycleLength: PSR_BOUNDS.CYCLE_LENGTH,
    effectiveGreen: PSR_BOUNDS.EFFECTIVE_GREEN_SUM,
    yellowTime: PSR_BOUNDS.YELLOW_TIME,
    allRedTime: PSR_BOUNDS.ALL_RED_TIME,
    linkCapacity: 24,
    linkTransferRatio: 0.7,
    corridorTransferFraction: 0.48,
    saturationRate: 0.58,
    saturationThreshold: 0.78,
    horizon: 4,
    sampleCount: 8,
    arrivalRates: { ...SCENARIOS[scenario].baseRates },
    conventionalPlan: { g11: 30, g12: 30, g21: 30, g22: 30 },
    scenario,
  };
}

export function getEffectiveArrivalRates(
  config: SimulationConfig,
  nextCycleNumber: number,
  useScenarioSchedule: boolean
): ApproachRecord {
  if (!useScenarioSchedule) {
    return { ...config.arrivalRates };
  }
  const def = SCENARIOS[config.scenario];
  if (
    def.burstRates &&
    def.burstStartCycle !== undefined &&
    def.burstEndCycle !== undefined &&
    nextCycleNumber >= def.burstStartCycle &&
    nextCycleNumber <= def.burstEndCycle
  ) {
    return { ...def.burstRates };
  }
  return { ...config.arrivalRates };
}

export interface CycleStepInput {
  queues: ApproachRecord;
  links: LinkOccupancy;
  plan: SignalPlan;
  arrivals: CycleArrivalSample;
  config: SimulationConfig;
}

export interface CycleStepOutput {
  nextQueues: ApproachRecord;
  nextLinks: LinkOccupancy;
  discharged: ApproachRecord;
  totalDischarged: number;
  totalArrivals: number;
  cycleWaitSeconds: number;
  avgWaitPerVeh: number;
  maxQueue: number;
  avgQueue: number;
  saturated: boolean;
}

/**
 * Ecuación de transición exacta por ciclo de 70s:
 * q_i(t+1) = max(0, q_i(t) + a_i(t) + a_link,i(t) - d_i(t))
 * con a_link,i(t) = 0.70 * ocupación del tramo conector entrante (R12 -> I2-F1, R21 -> I1-F1)
 * y descarga d_i(t) acotada por demanda disponible, saturación (s * g_i) y espacio libre en tramo receptor (anti-spillback).
 */
export function simulateSingleCycle(input: CycleStepInput): CycleStepOutput {
  const { queues, links, plan, arrivals, config } = input;
  const { cycleLength, linkCapacity, linkTransferRatio, corridorTransferFraction, saturationRate, saturationThreshold } = config;

  // Transferencias desde tramos conectores entrantes (70% de ocupación)
  const aLinkToI2F1 = links.R12 * linkTransferRatio;
  const aLinkToI1F1 = links.R21 * linkTransferRatio;

  const remainingR12 = Math.max(0, links.R12 - aLinkToI2F1);
  const remainingR21 = Math.max(0, links.R21 - aLinkToI1F1);

  const freeSpaceR12 = Math.max(0, linkCapacity - remainingR12);
  const freeSpaceR21 = Math.max(0, linkCapacity - remainingR21);

  // Demanda total disponible en cada acceso durante el ciclo
  const demandI1F1 = queues['I1-F1'] + arrivals['I1-F1'] + aLinkToI1F1;
  const demandI1F2 = queues['I1-F2'] + arrivals['I1-F2'];
  const demandI2F1 = queues['I2-F1'] + arrivals['I2-F1'] + aLinkToI2F1;
  const demandI2F2 = queues['I2-F2'] + arrivals['I2-F2'];

  // Capacidad de descarga por fase según verde efectivo y tasa de saturación
  const capI1F1 = saturationRate * plan.g11;
  const capI1F2 = saturationRate * plan.g12;
  const capI2F1 = saturationRate * plan.g21;
  const capI2F2 = saturationRate * plan.g22;

  // Límite anti-spillback para accesos que alimentan R12 y R21
  const spillbackLimitI1F1 = corridorTransferFraction > 0 ? freeSpaceR12 / corridorTransferFraction : Infinity;
  const spillbackLimitI2F1 = corridorTransferFraction > 0 ? freeSpaceR21 / corridorTransferFraction : Infinity;

  const dI1F1 = Math.min(demandI1F1, capI1F1, spillbackLimitI1F1);
  const dI1F2 = Math.min(demandI1F2, capI1F2);
  const dI2F1 = Math.min(demandI2F1, capI2F1, spillbackLimitI2F1);
  const dI2F2 = Math.min(demandI2F2, capI2F2);

  const nextQueues: ApproachRecord = {
    'I1-F1': Math.max(0, demandI1F1 - dI1F1),
    'I1-F2': Math.max(0, demandI1F2 - dI1F2),
    'I2-F1': Math.max(0, demandI2F1 - dI2F1),
    'I2-F2': Math.max(0, demandI2F2 - dI2F2),
  };

  const nextLinks: LinkOccupancy = {
    R12: Math.min(linkCapacity, remainingR12 + dI1F1 * corridorTransferFraction),
    R21: Math.min(linkCapacity, remainingR21 + dI2F1 * corridorTransferFraction),
  };

  const discharged: ApproachRecord = {
    'I1-F1': dI1F1,
    'I1-F2': dI1F2,
    'I2-F1': dI2F1,
    'I2-F2': dI2F2,
  };

  // Cálculo de espera acumulada del ciclo (veh·s):
  // Vehículos remanentes en cola esperan el ciclo completo + vehículos despachados esperan media fase roja
  const waitI1F1 = nextQueues['I1-F1'] * cycleLength + dI1F1 * Math.max(5, (cycleLength - plan.g11) * 0.5);
  const waitI1F2 = nextQueues['I1-F2'] * cycleLength + dI1F2 * Math.max(5, (cycleLength - plan.g12) * 0.5);
  const waitI2F1 = nextQueues['I2-F1'] * cycleLength + dI2F1 * Math.max(5, (cycleLength - plan.g21) * 0.5);
  const waitI2F2 = nextQueues['I2-F2'] * cycleLength + dI2F2 * Math.max(5, (cycleLength - plan.g22) * 0.5);

  const cycleWaitSeconds = waitI1F1 + waitI1F2 + waitI2F1 + waitI2F2;
  const totalDischarged = dI1F1 + dI1F2 + dI2F1 + dI2F2;
  const totalArrivals =
    arrivals['I1-F1'] + arrivals['I1-F2'] + arrivals['I2-F1'] + arrivals['I2-F2'];

  const totalVehiclesPresent = Math.max(
    1,
    totalDischarged +
      nextQueues['I1-F1'] +
      nextQueues['I1-F2'] +
      nextQueues['I2-F1'] +
      nextQueues['I2-F2']
  );

  const avgWaitPerVeh = cycleWaitSeconds / totalVehiclesPresent;

  const qValues = [
    nextQueues['I1-F1'],
    nextQueues['I1-F2'],
    nextQueues['I2-F1'],
    nextQueues['I2-F2'],
  ];
  const maxQueue = Math.max(...qValues);
  const avgQueue = (qValues[0] + qValues[1] + qValues[2] + qValues[3]) / 4;

  const r12Ratio = nextLinks.R12 / linkCapacity;
  const r21Ratio = nextLinks.R21 / linkCapacity;
  const saturated = r12Ratio > saturationThreshold || r21Ratio > saturationThreshold || maxQueue >= 24;

  return {
    nextQueues,
    nextLinks,
    discharged,
    totalDischarged,
    totalArrivals,
    cycleWaitSeconds,
    avgWaitPerVeh,
    maxQueue,
    avgQueue,
    saturated,
  };
}

export interface HorizonCostEvaluation {
  cost: number;
  waitComponent: number;
  queueComponent: number;
  satComponent: number;
  accumulatedWait: number;
  maxQueue: number;
  saturatedCycles: number;
}

/**
 * Función de Costo / Utilidad oficial sobre horizonte H:
 * C(p, m) = 100 * [ 0.50 * (Espera_acum / (H * 3800)) + 0.30 * (Cola_max / 30) + 0.20 * (Ciclos_saturados / H) ]
 */
export function evaluatePlanOnSample(
  initialQueues: ApproachRecord,
  initialLinks: LinkOccupancy,
  plan: SignalPlan,
  horizonArrivals: CycleArrivalSample[],
  config: SimulationConfig
): HorizonCostEvaluation {
  let queues: ApproachRecord = { ...initialQueues };
  let links: LinkOccupancy = { ...initialLinks };
  let accumulatedWait = 0;
  let maxQueue = 0;
  let saturatedCycles = 0;
  const H = Math.max(1, horizonArrivals.length);

  for (let h = 0; h < H; h += 1) {
    const step = simulateSingleCycle({
      queues,
      links,
      plan,
      arrivals: horizonArrivals[h],
      config,
    });
    queues = step.nextQueues;
    links = step.nextLinks;
    accumulatedWait += step.cycleWaitSeconds;
    if (step.maxQueue > maxQueue) {
      maxQueue = step.maxQueue;
    }
    if (step.saturated) {
      saturatedCycles += 1;
    }
  }

  const waitComponent = 100 * 0.5 * (accumulatedWait / (H * 3800));
  const queueComponent = 100 * 0.3 * (maxQueue / 30);
  const satComponent = 100 * 0.2 * (saturatedCycles / H);
  const cost = waitComponent + queueComponent + satComponent;

  return {
    cost: Number(cost.toFixed(2)),
    waitComponent: Number(waitComponent.toFixed(2)),
    queueComponent: Number(queueComponent.toFixed(2)),
    satComponent: Number(satComponent.toFixed(2)),
    accumulatedWait: Number(accumulatedWait.toFixed(1)),
    maxQueue: Number(maxQueue.toFixed(2)),
    saturatedCycles,
  };
}

/**
 * Calcula la fase exacta (F1, Y1, AR1, F2, Y2, AR2) y cuenta regresiva en segundos exactos
 * para una intersección dada el tiempo transcurrido en el ciclo de 70s.
 */
export function computeIntersectionPhase(
  elapsedInCycle: number,
  g1: number,
  g2: number,
  yellowTime = 2,
  allRedTime = 3
): { phase: SignalPhase; remaining: number } {
  const cycle = g1 + yellowTime + allRedTime + g2 + yellowTime + allRedTime;
  const t = ((elapsedInCycle % cycle) + cycle) % cycle;

  const tY1 = g1;
  const tAR1 = tY1 + yellowTime;
  const tF2 = tAR1 + allRedTime;
  const tY2 = tF2 + g2;
  const tAR2 = tY2 + yellowTime;

  if (t < tY1) return { phase: 'F1', remaining: Math.ceil(tY1 - t) };
  if (t < tAR1) return { phase: 'Y1', remaining: Math.ceil(tAR1 - t) };
  if (t < tF2) return { phase: 'AR1', remaining: Math.ceil(tF2 - t) };
  if (t < tY2) return { phase: 'F2', remaining: Math.ceil(tY2 - t) };
  if (t < tAR2) return { phase: 'Y2', remaining: Math.ceil(tAR2 - t) };
  return { phase: 'AR2', remaining: Math.ceil(cycle - t) };
}

export function createInitialWorldState(plan: SignalPlan): CorridorWorldState {
  return {
    cycle: 0,
    queues: {
      'I1-F1': 6,
      'I1-F2': 3,
      'I2-F1': 6,
      'I2-F2': 3,
    },
    links: {
      R12: 5,
      R21: 5,
    },
    plan: { ...plan },
    elapsedInCycle: 0,
    phaseI1: 'F1',
    phaseI2: 'F1',
    remainingPhaseI1: plan.g11,
    remainingPhaseI2: plan.g21,
    totalServed: 0,
    totalArrivals: 0,
    totalWaitSeconds: 0,
    maxQueueEver: 6,
    saturatedCycles: 0,
    psrViolations: 0,
    lastCycleServed: 0,
    lastCycleWait: 0,
    lastCycleAvgWaitPerVeh: 0,
    lastCycleMaxQueue: 6,
    lastCycleAvgQueue: 4.5,
    lastDecisionLatencyMs: 0,
    lastEvaluatedNodes: 0,
    lastPrunedBranches: 0,
    lastWorstCost: 0,
  };
}
