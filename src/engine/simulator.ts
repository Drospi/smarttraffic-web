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
    this.replanNow();
    this.syncVisualCarsToWorld('conventional');
    this.syncVisualCarsToWorld('smart');
  }

  public setAllArrivalRates(rates: ApproachRecord): void {
    for (const approach of APPROACH_IDS) {
      this.config.arrivalRates[approach] = Math.max(0.5, Math.min(28, Number(rates[approach].toFixed(1))));
    }
    this.useScenarioSchedule = false;
    this.replanNow();
    this.syncVisualCarsToWorld('conventional');
    this.syncVisualCarsToWorld('smart');
  }

  public setSaturationRate(value: number): void {
    this.config.saturationRate = Math.max(0.25, Math.min(1.1, Number(value.toFixed(2))));
    this.replanNow();
  }

  public setConventionalPlan(g11: number, g21: number): void {
    const plan = clampConventionalPlan(g11, g21);
    this.config.conventionalPlan = plan;
    this.conventional.plan = { ...plan };
    this.updatePhaseTimers(this.conventional);
  }

  /**
   * Recalcula el plan óptimo del agente SmartTraffic en tiempo récord (< 1 ms)
   * cuando el usuario modifica los vehículos por ciclo o inyecta una ráfaga.
   */
  public replanNow(): void {
    const rates = getEffectiveArrivalRates(
      this.config,
      Math.max(1, this.smart.cycle + 1),
      this.useScenarioSchedule
    );
    const decision = decidePlanAlphaBeta(
      this.smart.cycle,
      this.smart.plan,
      this.smart.queues,
      this.smart.links,
      rates,
      this.config,
      this.baseSeed + (this.smart.cycle + 1) * 7919 + Math.round(rates['I1-F2'] * 37 + rates['I1-F1'] * 19)
    );
    const psrCheck = validatePSR(decision.bestPlan);
    if (psrCheck.valid) {
      this.smart.plan = decision.bestPlan;
    }
    this.smart.lastDecisionLatencyMs = decision.latencyMs;
    this.smart.lastEvaluatedNodes = decision.evaluatedNodes;
    this.smart.lastPrunedBranches = decision.prunedBranches;
    this.smart.lastWorstCost = decision.worstCost;
    this.latestTrace = decision.trace;
    this.updatePhaseTimers(this.smart);
  }

  public injectBurst(target: 'all' | 'horizontal' | 'vertical' = 'all', vehiclesDelta = 6): void {
    const targets: readonly ApproachId[] =
      target === 'horizontal'
        ? ['I1-F1', 'I2-F1']
        : target === 'vertical'
        ? ['I1-F2', 'I2-F2']
        : APPROACH_IDS;

    // 1) Aumentar directamente los vehículos por ciclo (llegadas) para que afecte la simulación continua
    for (const ap of targets) {
      this.config.arrivalRates[ap] = Math.min(26, Number((this.config.arrivalRates[ap] + 4.5).toFixed(1)));
    }
    this.useScenarioSchedule = false;

    // 2) Inyectar vehículos reales en cola simultáneamente en ambos mundos
    const addBurst = (world: CorridorWorldState): void => {
      for (const ap of targets) {
        world.queues[ap] += vehiclesDelta;
      }
      if (target !== 'vertical') {
        world.links.R12 = Math.min(this.config.linkCapacity, world.links.R12 + 3);
        world.links.R21 = Math.min(this.config.linkCapacity, world.links.R21 + 3);
      }
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

    // 3) Ejecutar inmediatamente 1 ciclo pareado para ver el impacto real en espera, filas y respuesta récord del agente
    this.executePairedCycle();
    this.updatePhaseTimers(this.conventional);
    this.updatePhaseTimers(this.smart);
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

    // Puntos exactos sincronizados con corridorRenderer.ts (fuera de las cajas de intersección)
    const H_STOP_1 = 0.21;
    const H_BOX_EXIT_1 = 0.36;
    const H_STOP_2 = 0.63;
    const V_STOP_1 = 0.34;

    for (const approach of APPROACH_IDS) {
      const isHorizontal = approach === 'I1-F1' || approach === 'I2-F1';
      const activeRates = getEffectiveArrivalRates(
        this.config,
        Math.max(1, world.cycle + 1),
        this.useScenarioSchedule
      );
      const demandDriver = Math.max(world.queues[approach], activeRates[approach] * 0.85);
      const linkExtra =
        approach === 'I1-F1'
          ? world.links.R12 * 0.25
          : approach === 'I2-F1'
          ? world.links.R21 * 0.25
          : 0;
      const targetVisible = isHorizontal
        ? Math.max(1, Math.min(12, Math.round(demandDriver * 0.4 + linkExtra) + 1))
        : Math.max(1, Math.min(8, Math.round(demandDriver * 0.42) + 1));

      const existing = list.filter((c) => c.approach === approach);

      if (existing.length < targetVisible) {
        const missing = targetVisible - existing.length;
        const spacing = isHorizontal ? 0.055 : 0.092;

        for (let i = 0; i < missing; i += 1) {
          const idx = existing.length + i;
          const colorVariant = ((this.nextCarId + i) % 3) as 0 | 1 | 2;
          let progress: number;
          if (isHorizontal && idx < 3) {
            // Poblar el tramo central R12/R21 respetando el paso de cebra 2 y fuera de la caja 1
            progress = Math.max(H_BOX_EXIT_1 + 0.02, H_STOP_2 - idx * spacing);
          } else {
            const qIdx = isHorizontal ? Math.max(0, idx - 3) : idx;
            const anchor = isHorizontal ? H_STOP_1 : V_STOP_1;
            progress = Math.max(0.015, anchor - qIdx * spacing);
          }

          // Evitar superposición con autos ya presentes en ese mismo acceso
          const overlaps = existing.some((c) => Math.abs(c.progress - progress) < spacing * 0.8);
          if (overlaps) continue;

          const created: VisualCar = {
            id: this.nextCarId++,
            approach,
            laneIndex: idx % 2,
            progress,
            speed: isHorizontal ? 0.155 + (i % 3) * 0.008 : 0.22 + (i % 3) * 0.012,
            stopped: false,
            colorVariant,
            world: mode,
          };
          list.push(created);
          existing.push(created);
        }
      }
    }
  }

  private updateVisualCars(dtSimSeconds: number, mode: ControllerMode): void {
    const world = this.getWorld(mode);
    const list = this.visualCars[mode];

    // Escala visual agradable (ni muy lenta ni caótica a 10x)
    const dtVisual = Math.min(0.25, dtSimSeconds * 0.22);

    // Puntos de parada y salida de caja sincronizados pixel a pixel con corridorRenderer.ts
    const H_STOP_1 = 0.21;
    const H_BOX_EXIT_1 = 0.36;
    const H_STOP_2 = 0.63;
    const H_BOX_EXIT_2 = 0.78;
    const V_STOP_1 = 0.34;
    const V_BOX_EXIT_1 = 0.64;

    for (const approach of APPROACH_IDS) {
      const isHorizontal = approach === 'I1-F1' || approach === 'I2-F1';
      const firstGreen = this.isApproachGreen(world, approach);
      const secondGreen =
        approach === 'I1-F1'
          ? world.phaseI2 === 'F1'
          : approach === 'I2-F1'
          ? world.phaseI1 === 'F1'
          : true;

      // Detectar si el semáforo PERPENDICULAR está actualmente en verde (la caja debe estar 100% libre)
      const firstPerpGreen =
        approach === 'I1-F1'
          ? world.phaseI1 === 'F2'
          : approach === 'I1-F2'
          ? world.phaseI1 === 'F1'
          : approach === 'I2-F1'
          ? world.phaseI2 === 'F2'
          : world.phaseI2 === 'F1';
      const secondPerpGreen =
        approach === 'I1-F1'
          ? world.phaseI2 === 'F2'
          : approach === 'I2-F1'
          ? world.phaseI1 === 'F2'
          : false;

      const stopLine1 = isHorizontal ? H_STOP_1 : V_STOP_1;
      const boxExit1 = isHorizontal ? H_BOX_EXIT_1 : V_BOX_EXIT_1;
      const stopLine2 = isHorizontal ? H_STOP_2 : null;
      const boxExit2 = isHorizontal ? H_BOX_EXIT_2 : null;
      const minSpacing = isHorizontal ? 0.052 : 0.092;

      const laneCars = list
        .filter((c) => c.approach === approach)
        .sort((a, b) => b.progress - a.progress);

      // Densidad proporcional a la cola real del motor y a los vehículos/ciclo configurados
      const activeRates = getEffectiveArrivalRates(
        this.config,
        Math.max(1, world.cycle + 1),
        this.useScenarioSchedule
      );
      const demandDriver = Math.max(world.queues[approach], activeRates[approach] * 0.85);
      const linkExtra =
        approach === 'I1-F1'
          ? world.links.R12 * 0.25
          : approach === 'I2-F1'
          ? world.links.R21 * 0.25
          : 0;
      const targetCount = isHorizontal
        ? Math.max(1, Math.min(13, Math.round(demandDriver * 0.42 + linkExtra) + 1))
        : Math.max(1, Math.min(9, Math.round(demandDriver * 0.45) + 1));

      if (laneCars.length < targetCount) {
        const tail = laneCars[laneCars.length - 1];
        if (!tail || tail.progress > minSpacing + 0.025) {
          const colorVariant = (this.nextCarId % 3) as 0 | 1 | 2;
          const newCar: VisualCar = {
            id: this.nextCarId++,
            approach,
            laneIndex: laneCars.length % 2,
            progress: 0.005,
            speed: isHorizontal
              ? 0.16 + (this.nextCarId % 4) * 0.008
              : 0.23 + (this.nextCarId % 4) * 0.012,
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

        const insideBox1 = car.progress > stopLine1 + 0.002 && car.progress < boxExit1;
        const insideBox2 =
          stopLine2 !== null &&
          boxExit2 !== null &&
          car.progress > stopLine2 + 0.002 &&
          car.progress < boxExit2;

        // REGLA A: Si el auto YA entró a la caja del cruce, NUNCA se detiene dentro del cuadrado:
        // acelera suavemente durante el amarillo (2s) / todo rojo (3s) para despejarla por completo.
        if (insideBox1 || insideBox2) {
          const exitTarget = insideBox1 ? boxExit1 : (boxExit2 as number);
          const perpIsGreen = insideBox1 ? firstPerpGreen : secondPerpGreen;
          if (perpIsGreen) {
            // Invariante absoluta: ningún auto queda dentro del cuadrado cuando el cruce perpendicular tiene verde
            car.progress = exitTarget + 0.01;
            car.stopped = false;
            continue;
          }
          const boost = (insideBox1 && !firstGreen) || (insideBox2 && !secondGreen) ? 1.65 : 1.15;
          car.progress += car.speed * boost * dtVisual;
          car.stopped = false;
          continue;
        }

        const proposedProgress = car.progress + car.speed * dtVisual;
        let targetProgress = proposedProgress;
        let blocked = false;

        // REGLA B: Antes del 1er paso de cebra (stopLine1)
        // - En rojo/amarillo: el auto SIGUE avanzando hasta llegar exactamente al paso de cebra (stopLine1),
        //   nunca queda detenido en medio de una calle vacía.
        // - En verde: verifica que haya espacio libre al otro lado de la caja (anti-trancadera en el cuadrado).
        if (car.progress <= stopLine1 + 0.002 && targetProgress > stopLine1) {
          const box1BlockedAhead =
            ahead !== null && ahead.progress < boxExit1 + minSpacing + 0.01;
          if (!firstGreen || box1BlockedAhead) {
            targetProgress = stopLine1;
            blocked = Math.abs(stopLine1 - car.progress) < 0.004;
          }
        }

        // REGLA C: Antes del 2do paso de cebra (stopLine2 en la avenida horizontal)
        // - En rojo/amarillo: avanza por todo el tramo R12/R21 hasta llegar al 2do paso de cebra (stopLine2).
        // - En verde: verifica espacio libre al salir de la 2da caja.
        if (
          stopLine2 !== null &&
          boxExit2 !== null &&
          car.progress >= boxExit1 - 0.005 &&
          car.progress <= stopLine2 + 0.002 &&
          targetProgress > stopLine2
        ) {
          const box2BlockedAhead =
            ahead !== null && ahead.progress < boxExit2 + minSpacing + 0.01;
          if (!secondGreen || box2BlockedAhead) {
            targetProgress = stopLine2;
            blocked = Math.abs(stopLine2 - car.progress) < 0.004;
          }
        }

        // REGLA D: Mantener distancia segura con el auto inmediatamente adelante (solo si ese auto no está en la otra zona libre)
        if (ahead) {
          const maxAllowed = ahead.progress - minSpacing;
          if (targetProgress > maxAllowed) {
            targetProgress = Math.max(car.progress, maxAllowed);
            if (targetProgress - car.progress < 0.0015) {
              blocked = true;
            }
          }
        }

        car.progress = targetProgress;
        car.stopped = blocked;
      }
    }

    // Eliminar autos únicamente cuando ya salieron completamente fuera del lienzo
    this.visualCars[mode] = list.filter((c) => c.progress < 1.02);
  }
}

export function getActiveRatesSummary(config: SimulationConfig, cycle: number, useSchedule: boolean): ApproachRecord {
  return getEffectiveArrivalRates(config, Math.max(1, cycle), useSchedule);
}
