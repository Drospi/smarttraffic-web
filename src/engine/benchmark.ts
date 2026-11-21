import { DualCorridorSimulator } from './simulator';
import { SCENARIOS } from './trafficModel';
import type {
  BenchmarkControllerSummary,
  BenchmarkReport,
  BenchmarkScenarioResult,
  ScenarioId,
  SignalPlan,
} from './types';

const BENCHMARK_SCENARIOS: readonly { id: ScenarioId; seed: number }[] = [
  { id: 'habitual', seed: 10101 },
  { id: 'pico', seed: 20202 },
  { id: 'rafaga', seed: 30303 },
] as const;

function pctImprovement(baseline: number, smart: number, lowerIsBetter: boolean): number {
  if (baseline <= 0) return 0;
  const raw = lowerIsBetter
    ? ((baseline - smart) / baseline) * 100
    : ((smart - baseline) / baseline) * 100;
  return Number(raw.toFixed(1));
}

/**
 * Ejecuta el Benchmark completo pareado de 30 ciclos en los 3 escenarios
 * comparando exclusivamente:
 * - Semáforo Convencional (con los segundos exactos configurados por el usuario)
 * - Agente SmartTraffic (Poda Alfa-Beta + PSR)
 */
export function runFullBenchmark(
  conventionalPlan: SignalPlan,
  saturationRate: number,
  cyclesPerScenario = 30
): BenchmarkReport {
  const results: BenchmarkScenarioResult[] = BENCHMARK_SCENARIOS.map(({ id, seed }) => {
    const sim = new DualCorridorSimulator(id, seed);
    sim.setConventionalPlan(conventionalPlan.g11, conventionalPlan.g21);
    sim.setSaturationRate(saturationRate);

    let totalEvalNodes = 0;
    let totalPruned = 0;
    let totalDecisionMs = 0;
    let sumConvAvgQueue = 0;
    let sumSmartAvgQueue = 0;
    let sumConvWait = 0;
    let sumSmartWait = 0;

    for (let c = 0; c < cyclesPerScenario; c += 1) {
      const rec = sim.stepCycle();
      const smartWorld = sim.getWorld('smart');
      totalEvalNodes += rec.evaluatedNodes;
      totalPruned += rec.prunedBranches;
      totalDecisionMs += smartWorld.lastDecisionLatencyMs;
      sumConvAvgQueue += rec.conventionalAvgQueue;
      sumSmartAvgQueue += rec.smartAvgQueue;
      sumConvWait += rec.conventionalAvgWait;
      sumSmartWait += rec.smartAvgWait;
    }

    const snap = sim.getSnapshot();
    const convWorld = snap.conventional;
    const smartWorld = snap.smart;

    const totalPossibleLeaves = Math.max(1, totalEvalNodes + totalPruned);

    const conventionalSummary: BenchmarkControllerSummary = {
      avgWaitPerVeh: Number((sumConvWait / cyclesPerScenario).toFixed(2)),
      avgQueue: Number((sumConvAvgQueue / cyclesPerScenario).toFixed(2)),
      maxQueue: Number(convWorld.maxQueueEver.toFixed(2)),
      totalServed: Math.round(convWorld.totalServed),
      saturatedCycles: convWorld.saturatedCycles,
      psrViolations: 0,
      avgDecisionMs: 0,
      totalEvaluatedNodes: 0,
      totalPrunedBranches: 0,
      pruningRatePct: 0,
    };

    const smartSummary: BenchmarkControllerSummary = {
      avgWaitPerVeh: Number((sumSmartWait / cyclesPerScenario).toFixed(2)),
      avgQueue: Number((sumSmartAvgQueue / cyclesPerScenario).toFixed(2)),
      maxQueue: Number(smartWorld.maxQueueEver.toFixed(2)),
      totalServed: Math.round(smartWorld.totalServed),
      saturatedCycles: smartWorld.saturatedCycles,
      psrViolations: smartWorld.psrViolations,
      avgDecisionMs: Number((totalDecisionMs / cyclesPerScenario).toFixed(2)),
      totalEvaluatedNodes: totalEvalNodes,
      totalPrunedBranches: totalPruned,
      pruningRatePct: Number(((totalPruned / totalPossibleLeaves) * 100).toFixed(1)),
    };

    return {
      scenarioId: id,
      scenarioName: SCENARIOS[id].name,
      cycles: cyclesPerScenario,
      conventional: conventionalSummary,
      smart: smartSummary,
      waitImprovementPct: pctImprovement(
        conventionalSummary.avgWaitPerVeh,
        smartSummary.avgWaitPerVeh,
        true
      ),
      maxQueueImprovementPct: pctImprovement(
        conventionalSummary.maxQueue,
        smartSummary.maxQueue,
        true
      ),
      avgQueueImprovementPct: pctImprovement(
        conventionalSummary.avgQueue,
        smartSummary.avgQueue,
        true
      ),
      throughputImprovementPct: pctImprovement(
        conventionalSummary.totalServed,
        smartSummary.totalServed,
        false
      ),
      history: snap.history,
    };
  });

  return {
    generatedAt: Date.now(),
    conventionalPlan: { ...conventionalPlan },
    saturationRate,
    cyclesPerScenario,
    results,
  };
}
