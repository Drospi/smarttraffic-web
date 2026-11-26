export type ApproachId = 'I1-F1' | 'I1-F2' | 'I2-F1' | 'I2-F2';

export type LinkId = 'R12' | 'R21';

export type ScenarioId = 'habitual' | 'pico' | 'rafaga';

export type ControllerMode = 'conventional' | 'smart';

export type SignalPhase = 'F1' | 'Y1' | 'AR1' | 'F2' | 'Y2' | 'AR2';

export interface SignalPlan {
  g11: number; // I1 Fase 1 (corredor principal) [20..44]
  g12: number; // I1 Fase 2 (transversal)        [16..40]
  g21: number; // I2 Fase 1 (corredor principal) [20..44]
  g22: number; // I2 Fase 2 (transversal)        [16..40]
}

export type ApproachRecord = Record<ApproachId, number>;

export interface LinkOccupancy {
  R12: number; // Tramo I1 -> I2 (capacidad 24 veh)
  R21: number; // Tramo I2 -> I1 (capacidad 24 veh)
}

export interface SimulationConfig {
  cycleLength: number; // 70 s
  effectiveGreen: number; // 60 s
  yellowTime: number; // 3 s
  allRedTime: number; // 2 s
  linkCapacity: number; // 24 veh
  linkTransferRatio: number; // 0.70
  corridorTransferFraction: number; // Fracción de descarga F1 que entra al tramo conector
  saturationRate: number; // 0.58 veh/s por defecto
  saturationThreshold: number; // 0.78 (78%)
  horizon: number; // H = 4 ciclos
  sampleCount: number; // M = 8 muestras Poisson
  arrivalRates: ApproachRecord;
  conventionalPlan: SignalPlan;
  scenario: ScenarioId;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  shortName: string;
  description: string;
  baseRates: ApproachRecord;
  burstRates?: ApproachRecord;
  burstStartCycle?: number;
  burstEndCycle?: number;
}

export interface CorridorWorldState {
  cycle: number;
  queues: ApproachRecord;
  links: LinkOccupancy;
  plan: SignalPlan;
  elapsedInCycle: number; // 0..70s
  phaseI1: SignalPhase;
  phaseI2: SignalPhase;
  remainingPhaseI1: number;
  remainingPhaseI2: number;
  totalServed: number;
  totalArrivals: number;
  totalWaitSeconds: number;
  maxQueueEver: number;
  saturatedCycles: number;
  psrViolations: number;
  lastCycleServed: number;
  lastCycleWait: number;
  lastCycleAvgWaitPerVeh: number;
  lastCycleMaxQueue: number;
  lastCycleAvgQueue: number;
  lastDecisionLatencyMs: number;
  lastEvaluatedNodes: number;
  lastPrunedBranches: number;
  lastWorstCost: number;
}

export interface CycleArrivalSample {
  'I1-F1': number;
  'I1-F2': number;
  'I2-F1': number;
  'I2-F2': number;
}

export interface TraceSampleEval {
  sampleIndex: number;
  label: string;
  totalDemand: number;
  avgVehiclesPerCycle: number;
  horizonArrivals: CycleArrivalSample[];
  accumulatedWait: number | null;
  avgWaitPerVehicle: number | null;
  maxQueue: number | null;
  saturatedCycles: number | null;
  cost: number | null;
  waitComponent: number | null;
  queueComponent: number | null;
  satComponent: number | null;
  status: 'pending' | 'evaluated' | 'pruned';
}

export interface TraceCandidate {
  id: string;
  label: string;
  originTag: string;
  plan: SignalPlan;
  isCurrentPlan: boolean;
  heuristicScore: number;
  alphaValue: number;
  pruned: boolean;
  prunedCount: number;
  selectedAsBest: boolean;
  samples: TraceSampleEval[];
}

export interface PlanGenerationFormulaInfo {
  rateI1F1: number;
  rateI1F2: number;
  rateI2F1: number;
  rateI2F2: number;
  loadI1F1: number;
  loadI1F2: number;
  loadI2F1: number;
  loadI2F2: number;
  ratioI1Pct: number;
  ratioI2Pct: number;
  rawGreenI1: number;
  rawGreenI2: number;
  proportionalPlan: SignalPlan;
  inversePlan: SignalPlan;
}

export type TraceStepType =
  | 'init'
  | 'enter_candidate'
  | 'eval_sample'
  | 'update_alpha'
  | 'prune'
  | 'update_beta'
  | 'candidate_done'
  | 'complete';

export interface TraceStep {
  stepIndex: number;
  type: TraceStepType;
  activeNodeId: string;
  candidateIndex: number | null;
  sampleIndex: number | null;
  alpha: number;
  beta: number;
  bestPlanLabel: string;
  prunedBranchIds: string[];
  evaluatedLeafIds: string[];
  candidateAlphaSnapshot: Record<string, number>;
  narration: string;
  pseudocodeLines: number[];
}

export interface AlphaBetaTrace {
  source: 'simulator' | 'class_example';
  cycle: number;
  timestampMs: number;
  latencyMs: number;
  horizon: number;
  sampleCount: number;
  initialPlan: SignalPlan;
  bestPlan: SignalPlan;
  bestCost: number;
  totalLeavesPossible: number;
  evaluatedLeaves: number;
  prunedLeaves: number;
  planGeneration: PlanGenerationFormulaInfo;
  candidates: TraceCandidate[];
  steps: TraceStep[];
}

export interface DualCycleRecord {
  cycle: number;
  scenario: ScenarioId;
  conventionalAvgQueue: number;
  smartAvgQueue: number;
  conventionalMaxQueue: number;
  smartMaxQueue: number;
  conventionalAvgWait: number;
  smartAvgWait: number;
  conventionalServed: number;
  smartServed: number;
  conventionalCumulativeServed: number;
  smartCumulativeServed: number;
  conventionalR12Pct: number;
  smartR12Pct: number;
  conventionalR21Pct: number;
  smartR21Pct: number;
  evaluatedNodes: number;
  prunedBranches: number;
  smartPlan: SignalPlan;
  conventionalPlan: SignalPlan;
  psrViolations: number;
}

export interface VisualCar {
  id: number;
  approach: ApproachId;
  laneIndex: number;
  progress: number; // 0 (entrada) -> 1 (salida)
  speed: number; // progreso por segundo
  stopped: boolean;
  colorVariant: 0 | 1 | 2;
  world: ControllerMode;
}

export interface BenchmarkControllerSummary {
  avgWaitPerVeh: number;
  avgQueue: number;
  maxQueue: number;
  totalServed: number;
  saturatedCycles: number;
  psrViolations: number;
  avgDecisionMs: number;
  totalEvaluatedNodes: number;
  totalPrunedBranches: number;
  pruningRatePct: number;
}

export interface BenchmarkScenarioResult {
  scenarioId: ScenarioId;
  scenarioName: string;
  cycles: number;
  conventional: BenchmarkControllerSummary;
  smart: BenchmarkControllerSummary;
  waitImprovementPct: number;
  maxQueueImprovementPct: number;
  avgQueueImprovementPct: number;
  throughputImprovementPct: number;
  history: DualCycleRecord[];
}

export interface BenchmarkReport {
  generatedAt: number;
  conventionalPlan: SignalPlan;
  saturationRate: number;
  cyclesPerScenario: number;
  results: BenchmarkScenarioResult[];
}
