import { decidePlanAlphaBeta } from './alphaBeta';
import { createSeededRng, type SeededRng } from './prng';
import { clampConventionalPlan, validatePSR } from './psr';
import {
  APPROACH_IDS,
  SCENARIOS,
  computeIntersectionPhase,
  createDefaultConfig,
  createInitialWorldState,
  getEffectiveArrivalRates,
  simulateSingleCycle,
} from './trafficModel';
import type {
  AlphaBetaTrace,
  ApproachId,
  ApproachRecord,
  ControllerMode,
  CorridorWorldState,
  CycleArrivalSample,
  DualCycleRecord,
  ScenarioId,
  SignalPlan,
  SimulationConfig,
  VisualCar,
} from './types';

export interface SimulatorSnapshot {
  config: SimulationConfig;
  conventional: CorridorWorldState;
  smart: CorridorWorldState;
  history: DualCycleRecord[];
  latestTrace: AlphaBetaTrace;
  activeScenarioSchedule: boolean;
}

/**
 * Motor dual sincronizado en TypeScript puro (0% React).
 * Ejecuta en paralelo el Semáforo Convencional (tiempo fijo configurable en segundos exactos)
 * y el Agente SmartTraffic (Poda Alfa-Beta + PSR) sobre EXACTAMENTE las mismas llegadas Poisson.
 */
export class DualCorridorSimulator {
  private config: SimulationConfig;
  private conventional: CorridorWorldState;
  private smart: CorridorWorldState;
  private history: DualCycleRecord[] = [];
  private latestTrace: AlphaBetaTrace;
  private rng: SeededRng;
  private baseSeed: number;
  private useScenarioSchedule = true;
  private nextCarId = 1;
  private visualCars: Record<ControllerMode, VisualCar[]> = {
    conventional: [],
    smart: [],
  };

  constructor(scenario: ScenarioId = 'pico', seed = 202604) {
    this.baseSeed = seed;
    this.config = createDefaultConfig(scenario);
    this.rng = createSeededRng(seed);
    this.conventional = createInitialWorldState(this.config.conventionalPlan);
    this.smart = createInitialWorldState(this.config.conventionalPlan);

    // Ejecutar decisión inicial para tener una traza real desde el ciclo 0
    const initialDecision = decidePlanAlphaBeta(
      0,
      this.smart.plan,
      this.smart.queues,
      this.smart.links,
      this.config.arrivalRates,
      this.config,
      this.baseSeed + 999
    );
    this.smart.plan = initialDecision.bestPlan;
    this.smart.lastDecisionLatencyMs = initialDecision.latencyMs;
    this.smart.lastEvaluatedNodes = initialDecision.evaluatedNodes;
    this.smart.lastPrunedBranches = initialDecision.prunedBranches;
    this.smart.lastWorstCost = initialDecision.worstCost;
    this.latestTrace = initialDecision.trace;

    this.syncVisualCarsToWorld('conventional');
    this.syncVisualCarsToWorld('smart');
  }

  public getConfig(): SimulationConfig {
    return {
      ...this.config,
      arrivalRates: { ...this.config.arrivalRates },
      conventionalPlan: { ...this.config.conventionalPlan },
    };
  }

  public getWorld(mode: ControllerMode): CorridorWorldState {
    return mode === 'conventional' ? this.conventional : this.smart;
  }

  public getVisualCars(mode: ControllerMode): readonly VisualCar[] {
    return this.visualCars[mode];
  }

  public getSnapshot(): SimulatorSnapshot {
    return {
      config: this.getConfig(),
      conventional: {
        ...this.conventional,
        queues: { ...this.conventional.queues },
        links: { ...this.conventional.links },
        plan: { ...this.conventional.plan },
      },
      smart: {
        ...this.smart,
        queues: { ...this.smart.queues },
        links: { ...this.smart.links },
        plan: { ...this.smart.plan },
      },
      history: [...this.history],
      latestTrace: this.latestTrace,
      activeScenarioSchedule: this.useScenarioSchedule,
    };
  }

  public setScenario(scenario: ScenarioId): void {
    const scenarioDef = SCENARIOS[scenario];
    this.config.scenario = scenario;
    this.config.arrivalRates = { ...scenarioDef.baseRates };
    this.useScenarioSchedule = true;
    this.reset(this.baseSeed);
  }

  public setArrivalRate(approach: ApproachId, value: number): void {
    this.config.arrivalRates[approach] = Math.max(0.5, Math.min(28, Number(value.toFixed(1))));
    this.useScenarioSchedule = false;
  }

  public setSaturationRate(value: number): void {
    this.config.saturationRate = Math.max(0.25, Math.min(1.1, Number(value.toFixed(2))));
  }

  public setConventionalPlan(g11: number, g21: number): void {
    const plan = clampConventionalPlan(g11, g21);
    this.config.conventionalPlan = plan;
    this.conventional.plan = { ...plan };
    this.updatePhaseTimers(this.conventional);
  }

  public injectBurst(vehiclesPerApproach = 9): void {
    const addBurst = (world: CorridorWorldState): void => {
      world.queues['I1-F1'] += vehiclesPerApproach;
      world.queues['I1-F2'] += Math.round(vehiclesPerApproach * 0.7);
      world.queues['I2-F1'] += vehiclesPerApproach;
      world.queues['I2-F2'] += Math.round(vehiclesPerApproach * 0.7);
      world.links.R12 = Math.min(this.config.linkCapacity, world.links.R12 + 4);
      world.links.R21 = Math.min(this.config.linkCapacity, world.links.R21 + 4);
      world.maxQueueEver = Math.max(
        world.maxQueueEver,
        world.queues['I1-F1'],
        world.queues['I1-F2'],
        world.queues['I2-F1'],
        world.queues['I2-F2']
      );
    };

    addBurst(this.conventional);
    addBurst(this.smart);
    this.syncVisualCarsToWorld('conventional');
    this.syncVisualCarsToWorld('smart');
  }

  public reset(seed = this.baseSeed): void {
    this.baseSeed = seed;
    this.rng = createSeededRng(seed);
    this.history = [];
    this.conventional = createInitialWorldState(this.config.conventionalPlan);
    this.smart = createInitialWorldState({ g11: 30, g12: 30, g21: 30, g22: 30 });
    this.visualCars = { conventional: [], smart: [] };

    const initialDecision = decidePlanAlphaBeta(
      0,
      this.smart.plan,
      this.smart.queues,
      this.smart.links,
      this.config.arrivalRates,
      this.config,
      this.baseSeed + 999
    );
    this.smart.plan = initialDecision.bestPlan;
    this.smart.lastDecisionLatencyMs = initialDecision.latencyMs;
    this.smart.lastEvaluatedNodes = initialDecision.evaluatedNodes;
    this.smart.lastPrunedBranches = initialDecision.prunedBranches;
    this.smart.lastWorstCost = initialDecision.worstCost;
    this.latestTrace = initialDecision.trace;

    this.syncVisualCarsToWorld('conventional');
    this.syncVisualCarsToWorld('smart');
  }

  /**
   * Avanza la simulación en tiempo real (segundos simulados).
   * Devuelve true cuando se completó al menos un ciclo de 70s (para sincronizar React/Recharts).
   */
  public advanceTime(dtSimSeconds: number): boolean {
    const safeDt = Math.max(0, Math.min(dtSimSeconds, 140));
    let completedCycle = false;

    this.conventional.elapsedInCycle += safeDt;
    this.smart.elapsedInCycle += safeDt;

    while (this.conventional.elapsedInCycle >= this.config.cycleLength) {
      this.conventional.elapsedInCycle -= this.config.cycleLength;
      this.smart.elapsedInCycle -= this.config.cycleLength;
      this.executePairedCycle();
      completedCycle = true;
    }

    this.updatePhaseTimers(this.conventional);
    this.updatePhaseTimers(this.smart);
    this.updateVisualCars(safeDt, 'conventional');
    this.updateVisualCars(safeDt, 'smart');

    return completedCycle;
  }

  /**
   * Avanza exactamente 1 ciclo completo de 70s de forma inmediata.
   */
  public stepCycle(): DualCycleRecord {
    this.conventional.elapsedInCycle = 0;
    this.smart.elapsedInCycle = 0;
    const record = this.executePairedCycle();
    this.updatePhaseTimers(this.conventional);
    this.updatePhaseTimers(this.smart);
    this.syncVisualCarsToWorld('conventional');
    this.syncVisualCarsToWorld('smart');
    return record;
  }

  private updatePhaseTimers(world: CorridorWorldState): void {
    const p1 = computeIntersectionPhase(
      world.elapsedInCycle,
      world.plan.g11,
      world.plan.g12,
      this.config.yellowTime,
      this.config.allRedTime
    );
    const p2 = computeIntersectionPhase(
      world.elapsedInCycle,
      world.plan.g21,
      world.plan.g22,
      this.config.yellowTime,
      this.config.allRedTime
    );
    world.phaseI1 = p1.phase;
    world.remainingPhaseI1 = p1.remaining;
    world.phaseI2 = p2.phase;
    world.remainingPhaseI2 = p2.remaining;
  }

  private executePairedCycle(): DualCycleRecord {
    const nextCycle = this.smart.cycle + 1;
    const rates = getEffectiveArrivalRates(this.config, nextCycle, this.useScenarioSchedule);

    // Misma realización Poisson para ambos controladores (comparación 100% justa)
    const arrivals: CycleArrivalSample = {
      'I1-F1': this.rng.poisson(rates['I1-F1']),
      'I1-F2': this.rng.poisson(rates['I1-F2']),
      'I2-F1': this.rng.poisson(rates['I2-F1']),
      'I2-F2': this.rng.poisson(rates['I2-F2']),
    };

    // 1) Decisión del Agente SmartTraffic con Poda Alfa-Beta + PSR en el límite del ciclo
    const decision = decidePlanAlphaBeta(
      nextCycle,
      this.smart.plan,
      this.smart.queues,
      this.smart.links,
      rates,
      this.config,
      this.baseSeed + nextCycle * 7919
    );

    const psrCheck = validatePSR(decision.bestPlan);
    const appliedSmartPlan: SignalPlan = psrCheck.valid ? decision.bestPlan : this.smart.plan;

    // 2) Simular 1 ciclo en ambos mundos
    const convStep = simulateSingleCycle({
      queues: this.conventional.queues,
      links: this.conventional.links,
      plan: this.config.conventionalPlan,
      arrivals,
      config: this.config,
    });

    const smartStep = simulateSingleCycle({
      queues: this.smart.queues,
      links: this.smart.links,
      plan: appliedSmartPlan,
      arrivals,
      config: this.config,
    });

    // 3) Actualizar estado Convencional
    this.conventional.cycle = nextCycle;
    this.conventional.plan = { ...this.config.conventionalPlan };
    this.conventional.queues = convStep.nextQueues;
    this.conventional.links = convStep.nextLinks;
    this.conventional.totalServed += convStep.totalDischarged;
    this.conventional.totalArrivals += convStep.totalArrivals;
    this.conventional.totalWaitSeconds += convStep.cycleWaitSeconds;
    this.conventional.maxQueueEver = Math.max(this.conventional.maxQueueEver, convStep.maxQueue);
    if (convStep.saturated) this.conventional.saturatedCycles += 1;
    this.conventional.lastCycleServed = convStep.totalDischarged;
    this.conventional.lastCycleWait = convStep.cycleWaitSeconds;
    this.conventional.lastCycleAvgWaitPerVeh = convStep.avgWaitPerVeh;
    this.conventional.lastCycleMaxQueue = convStep.maxQueue;
    this.conventional.lastCycleAvgQueue = convStep.avgQueue;

    // 4) Actualizar estado SmartTraffic
    this.smart.cycle = nextCycle;
    this.smart.plan = { ...appliedSmartPlan };
    this.smart.queues = smartStep.nextQueues;
    this.smart.links = smartStep.nextLinks;
    this.smart.totalServed += smartStep.totalDischarged;
    this.smart.totalArrivals += smartStep.totalArrivals;
    this.smart.totalWaitSeconds += smartStep.cycleWaitSeconds;
    this.smart.maxQueueEver = Math.max(this.smart.maxQueueEver, smartStep.maxQueue);
    if (smartStep.saturated) this.smart.saturatedCycles += 1;
    this.smart.psrViolations += decision.psrViolations;
    this.smart.lastCycleServed = smartStep.totalDischarged;
    this.smart.lastCycleWait = smartStep.cycleWaitSeconds;
    this.smart.lastCycleAvgWaitPerVeh = smartStep.avgWaitPerVeh;
    this.smart.lastCycleMaxQueue = smartStep.maxQueue;
    this.smart.lastCycleAvgQueue = smartStep.avgQueue;
    this.smart.lastDecisionLatencyMs = decision.latencyMs;
    this.smart.lastEvaluatedNodes = decision.evaluatedNodes;
    this.smart.lastPrunedBranches = decision.prunedBranches;
    this.smart.lastWorstCost = decision.worstCost;

    this.latestTrace = decision.trace;

    const record: DualCycleRecord = {
      cycle: nextCycle,
      scenario: this.config.scenario,
      conventionalAvgQueue: Number(convStep.avgQueue.toFixed(2)),
      smartAvgQueue: Number(smartStep.avgQueue.toFixed(2)),
      conventionalMaxQueue: Number(convStep.maxQueue.toFixed(2)),
      smartMaxQueue: Number(smartStep.maxQueue.toFixed(2)),
      conventionalAvgWait: Number(convStep.avgWaitPerVeh.toFixed(2)),
      smartAvgWait: Number(smartStep.avgWaitPerVeh.toFixed(2)),
      conventionalServed: Number(convStep.totalDischarged.toFixed(1)),
      smartServed: Number(smartStep.totalDischarged.toFixed(1)),
      conventionalCumulativeServed: Math.round(this.conventional.totalServed),
      smartCumulativeServed: Math.round(this.smart.totalServed),
      conventionalR12Pct: Math.round((this.conventional.links.R12 / this.config.linkCapacity) * 100),
      smartR12Pct: Math.round((this.smart.links.R12 / this.config.linkCapacity) * 100),
      conventionalR21Pct: Math.round((this.conventional.links.R21 / this.config.linkCapacity) * 100),
      smartR21Pct: Math.round((this.smart.links.R21 / this.config.linkCapacity) * 100),
      evaluatedNodes: decision.evaluatedNodes,
      prunedBranches: decision.prunedBranches,
      smartPlan: { ...appliedSmartPlan },
      conventionalPlan: { ...this.config.conventionalPlan },
      psrViolations: decision.psrViolations,
    };

    this.history.push(record);
    if (this.history.length > 60) {
      this.history.shift();
    }

    return record;
  }

  private isApproachGreen(world: CorridorWorldState, approach: ApproachId): boolean {
    switch (approach) {
      case 'I1-F1':
        return world.phaseI1 === 'F1';
      case 'I1-F2':
        return world.phaseI1 === 'F2';
      case 'I2-F1':
        return world.phaseI2 === 'F1';
      case 'I2-F2':
        return world.phaseI2 === 'F2';
    }
  }

  private syncVisualCarsToWorld(mode: ControllerMode): void {
    const world = this.getWorld(mode);
    const list = this.visualCars[mode];

    for (const approach of APPROACH_IDS) {
      const targetVisible = Math.max(1, Math.min(10, Math.round(world.queues[approach] * 0.55) + 1));
      const existing = list.filter((c) => c.approach === approach);

      if (existing.length < targetVisible) {
        const missing = targetVisible - existing.length;
        for (let i = 0; i < missing; i += 1) {
          const laneIdx = (existing.length + i) % 2;
          const colorVariant = ((this.nextCarId + i) % 3) as 0 | 1 | 2;
          list.push({
            id: this.nextCarId++,
            approach,
            laneIndex: laneIdx,
            progress: Math.max(0.02, 0.36 - (existing.length + i) * 0.055),
            speed: 0.14 + (i % 3) * 0.015,
            stopped: false,
            colorVariant,
            world: mode,
          });
        }
      }
    }
  }

  private updateVisualCars(dtSimSeconds: number, mode: ControllerMode): void {
    const world = this.getWorld(mode);
    const list = this.visualCars[mode];

    // Escala visual agradable (ni muy lenta ni caótica a 10x)
    const dtVisual = Math.min(0.25, dtSimSeconds * 0.22);

    const stopLine = 0.42;
    const minSpacing = 0.082;

    for (const approach of APPROACH_IDS) {
      const green = this.isApproachGreen(world, approach);
      const laneCars = list
        .filter((c) => c.approach === approach)
        .sort((a, b) => b.progress - a.progress);

      // Asegurar densidad proporcional a la cola real del motor
      const targetCount = Math.max(2, Math.min(11, Math.round(world.queues[approach] * 0.52) + 2));
      if (laneCars.length < targetCount) {
        const tail = laneCars[laneCars.length - 1];
        if (!tail || tail.progress > 0.1) {
          const colorVariant = (this.nextCarId % 3) as 0 | 1 | 2;
          const newCar: VisualCar = {
            id: this.nextCarId++,
            approach,
            laneIndex: laneCars.length % 2,
            progress: 0.01,
            speed: 0.24 + (this.nextCarId % 4) * 0.015,
            stopped: false,
            colorVariant,
            world: mode,
          };
          list.push(newCar);
          laneCars.push(newCar);
        }
      }

      for (let i = 0; i < laneCars.length; i += 1) {
        const car = laneCars[i];
        const ahead = i > 0 ? laneCars[i - 1] : null;
        let blocked = false;

        // Freno en línea de parada si el semáforo está en rojo/amarillo y el auto aún no cruzó
        if (!green && car.progress <= stopLine && car.progress + car.speed * dtVisual >= stopLine - 0.012) {
          car.progress = Math.min(car.progress, stopLine - 0.012);
          blocked = true;
        }

        // Mantener distancia respecto al vehículo de adelante
        if (ahead) {
          const maxAllowed = ahead.progress - minSpacing;
          if (car.progress + car.speed * dtVisual >= maxAllowed) {
            car.progress = Math.max(0, Math.min(car.progress, maxAllowed));
            blocked = true;
          }
        }

        if (!blocked) {
          car.progress += car.speed * dtVisual;
        }
        car.stopped = blocked;
      }
    }

    // Eliminar autos que ya salieron del corredor
    this.visualCars[mode] = list.filter((c) => c.progress < 1.04);
  }
}

export function getActiveRatesSummary(config: SimulationConfig, cycle: number, useSchedule: boolean): ApproachRecord {
  return getEffectiveArrivalRates(config, Math.max(1, cycle), useSchedule);
}
