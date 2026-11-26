import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Calculator,
  Columns2,
  Flame,
  Image as ImageIcon,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Square,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type MutableRefObject } from 'react';
import { renderCorridorCanvas } from '../canvas/corridorRenderer';
import { spriteManager } from '../canvas/spriteManager';
import { SCENARIOS, APPROACH_IDS } from '../engine/trafficModel';
import type { DualCorridorSimulator, SimulatorSnapshot } from '../engine/simulator';
import type { ApproachId, ControllerMode, ScenarioId } from '../engine/types';

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10] as const;

const APPROACH_LABELS: Record<ApproachId, string> = {
  'I1-F1': 'I1-F1 · C. Pedro Salazar (Horizontal →)',
  'I1-F2': 'I1-F2 · Av. 20 de Octubre / Plaza Avaroa (Vertical ↑)',
  'I2-F1': 'I2-F1 · P. Salazar / Conex. Belisario (Horizontal ←)',
  'I2-F2': 'I2-F2 · Av. 6 de Agosto (Vertical ↓)',
};

interface View3SimulatorProps {
  simulatorRef: MutableRefObject<DualCorridorSimulator>;
  snapshot: SimulatorSnapshot;
  isRunning: boolean;
  speed: number;
  onToggleRun: () => void;
  onStepCycle: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
  onSyncSnapshot: () => void;
}

export function View3Simulator({
  simulatorRef,
  snapshot,
  isRunning,
  speed,
  onToggleRun,
  onStepCycle,
  onReset,
  onChangeSpeed,
  onSyncSnapshot,
}: View3SimulatorProps) {
  const [selectedController, setSelectedController] = useState<ControllerMode>('smart');
  const [splitScreen, setSplitScreen] = useState<boolean>(false);
  const [useSprites, setUseSprites] = useState<boolean>(true);

  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const convCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesDialogRef = useRef<HTMLDialogElement | null>(null);
  const spritesTitleId = useId();

  // Refs para leer opciones visuales dentro de requestAnimationFrame sin recrear el loop
  const renderPrefsRef = useRef({
    selectedController,
    splitScreen,
    useSprites,
  });

  useEffect(() => {
    renderPrefsRef.current = { selectedController, splitScreen, useSprites };
  }, [selectedController, splitScreen, useSprites]);

  // Fallback de light-dismiss para <dialog closedby="any"> cuando el navegador no soporta closedBy
  useEffect(() => {
    const dialog = spritesDialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent): boolean => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    const onPointerDown = (e: PointerEvent): void => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent): void => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  // Loop dedicado de renderizado Canvas 2D a 60 FPS (cero setState por frame)
  useEffect(() => {
    let rafId = 0;
    let startTime = performance.now();

    const drawFrame = (now: number): void => {
      const elapsedSec = (now - startTime) / 1000;
      const sim = simulatorRef.current;
      const cfg = sim.getConfig();
      const prefs = renderPrefsRef.current;

      if (prefs.splitScreen) {
        const cCanvas = convCanvasRef.current;
        const sCanvas = smartCanvasRef.current;
        if (cCanvas) {
          const ctx = cCanvas.getContext('2d');
          if (ctx) {
            renderCorridorCanvas(ctx, cCanvas.width, cCanvas.height, {
              world: sim.getWorld('conventional'),
              cars: sim.getVisualCars('conventional'),
              mode: 'conventional',
              linkCapacity: cfg.linkCapacity,
              saturationThreshold: cfg.saturationThreshold,
              useSprites: prefs.useSprites,
              timeSeconds: elapsedSec,
              compact: true,
            });
          }
        }
        if (sCanvas) {
          const ctx = sCanvas.getContext('2d');
          if (ctx) {
            renderCorridorCanvas(ctx, sCanvas.width, sCanvas.height, {
              world: sim.getWorld('smart'),
              cars: sim.getVisualCars('smart'),
              mode: 'smart',
              linkCapacity: cfg.linkCapacity,
              saturationThreshold: cfg.saturationThreshold,
              useSprites: prefs.useSprites,
              timeSeconds: elapsedSec,
              compact: true,
            });
          }
        }
      } else {
        const canvas = singleCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderCorridorCanvas(ctx, canvas.width, canvas.height, {
              world: sim.getWorld(prefs.selectedController),
              cars: sim.getVisualCars(prefs.selectedController),
              mode: prefs.selectedController,
              linkCapacity: cfg.linkCapacity,
              saturationThreshold: cfg.saturationThreshold,
              useSprites: prefs.useSprites,
              timeSeconds: elapsedSec,
              compact: false,
            });
          }
        }
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    startTime = performance.now();
    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [simulatorRef]);

  const activeWorld =
    selectedController === 'smart' ? snapshot.smart : snapshot.conventional;
  const r12Pct = Math.round((activeWorld.links.R12 / snapshot.config.linkCapacity) * 100);
  const r21Pct = Math.round((activeWorld.links.R21 / snapshot.config.linkCapacity) * 100);

  const handleScenarioChange = (scenario: ScenarioId): void => {
    simulatorRef.current.setScenario(scenario);
    onSyncSnapshot();
  };

  const handleConventionalChange = (which: 'g11' | 'g21', value: number): void => {
    const clamped = Math.max(10, Math.min(50, Math.round(value)));
    const nextG11 = which === 'g11' ? clamped : snapshot.config.conventionalPlan.g11;
    const nextG21 = which === 'g21' ? clamped : snapshot.config.conventionalPlan.g21;
    simulatorRef.current.setConventionalPlan(nextG11, nextG21);
    onSyncSnapshot();
  };

  const handleArrivalRateChange = (approach: ApproachId, value: number): void => {
    simulatorRef.current.setArrivalRate(approach, value);
    onSyncSnapshot();
  };

  const handleSaturationRateChange = (value: number): void => {
    simulatorRef.current.setSaturationRate(value);
    onSyncSnapshot();
  };

  const handleInjectBurst = (target: 'all' | 'horizontal' | 'vertical' = 'all'): void => {
    simulatorRef.current.injectBurst(target, 6);
    onSyncSnapshot();
  };

  const handleInvertTraffic = (): void => {
    const r = snapshot.config.arrivalRates;
    const isCurrentlyHorizontalDominant = r['I1-F1'] + r['I2-F1'] >= r['I1-F2'] + r['I2-F2'];
    if (isCurrentlyHorizontalDominant) {
      // Invertir: pico fuerte en calles verticales (F2) y flujo bajo en avenida horizontal (F1)
      simulatorRef.current.setAllArrivalRates({
        'I1-F1': 3.0,
        'I1-F2': 22.0,
        'I2-F1': 3.0,
        'I2-F2': 21.0,
      });
    } else {
      // Volver a pico fuerte en avenida horizontal (F1) y flujo bajo en verticales (F2)
      simulatorRef.current.setAllArrivalRates({
        'I1-F1': 21.0,
        'I1-F2': 3.5,
        'I2-F1': 20.0,
        'I2-F2': 3.5,
      });
    }
    // Avanzar 1 ciclo pareado inmediatamente para ver el impacto real en tiempos de espera y respuesta récord
    simulatorRef.current.stepCycle();
    onSyncSnapshot();
  };

  const openSpritesModal = (): void => {
    spritesDialogRef.current?.showModal();
  };

  // Datos en vivo para la tarjeta de Fórmula del Simulador
  const rates = snapshot.config.arrivalRates;
  const satRate = snapshot.config.saturationRate;
  const totalIncomingPerCycle =
    rates['I1-F1'] + rates['I1-F2'] + rates['I2-F1'] + rates['I2-F2'];
  const convCapI1F1 = (satRate * snapshot.conventional.plan.g11).toFixed(1);
  const convCapI1F2 = (satRate * snapshot.conventional.plan.g12).toFixed(1);
  const smartCapI1F1 = (satRate * snapshot.smart.plan.g11).toFixed(1);
  const smartCapI1F2 = (satRate * snapshot.smart.plan.g12).toFixed(1);
  const waitDiffSeconds =
    snapshot.conventional.lastCycleAvgWaitPerVeh - snapshot.smart.lastCycleAvgWaitPerVeh;

  const canonicalSprites = spriteManager.getCanonicalStatus();
  const detectedFiles = spriteManager.getDetectedFilenames();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Barra de Control Superior */}
      <div className="pixel-panel-cyan p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleRun}
            className={`arcade-btn ${isRunning ? 'arcade-btn-amber' : 'arcade-btn-green'}`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'PAUSAR' : 'PLAY'}
          </button>

          <button type="button" onClick={onStepCycle} className="arcade-btn arcade-btn-cyan">
            <SkipForward className="w-4 h-4" />
            +1 CICLO
          </button>

          <button type="button" onClick={onReset} className="arcade-btn arcade-btn-pink">
            <RotateCcw className="w-4 h-4" />
            REINICIAR
          </button>

          <button
            type="button"
            onClick={() => handleInjectBurst('all')}
            className="arcade-btn arcade-btn-pink"
            title="Aumenta los vehículos por ciclo en todos los accesos e inyecta una ráfaga real"
          >
            <Flame className="w-4 h-4" />
            AUMENTAR AUTOS (+RÁFAGA)
          </button>

          <button
            type="button"
            onClick={handleInvertTraffic}
            className="arcade-btn arcade-btn-amber"
            title="Invierte el tráfico entre avenida horizontal y calles verticales para ver la reacción inmediata del agente"
          >
            <ArrowLeftRight className="w-4 h-4" />
            INVERTIR TRÁFICO
          </button>
        </div>

        {/* Velocidad + Modos de Vista + Sprites */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#090a14] border-2 border-[#2a3461] p-1 gap-1">
            <span className="text-[10px] font-pixel text-[#9aa8d1] px-1.5">VEL:</span>
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChangeSpeed(opt)}
                className={`px-2 py-1 text-[11px] font-mono-code font-bold cursor-pointer ${
                  speed === opt
                    ? 'bg-[#00f0ff] text-[#090a14]'
                    : 'text-[#a5b3db] hover:text-white'
                }`}
              >
                {opt}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSplitScreen((prev) => !prev)}
            className={`arcade-btn !py-2 !px-3 ${
              splitScreen ? 'arcade-btn-cyan-solid' : 'arcade-btn-cyan'
            }`}
            title="Comparar Semáforo Convencional y SmartTraffic en paralelo"
          >
            {splitScreen ? <Square className="w-3.5 h-3.5" /> : <Columns2 className="w-3.5 h-3.5" />}
            {splitScreen ? 'VISTA SIMPLE' : 'PANTALLA DIVIDIDA'}
          </button>

          <button
            type="button"
            onClick={openSpritesModal}
            className="arcade-btn arcade-btn-amber !py-2 !px-3"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            SPRITES
          </button>
        </div>
      </div>

      {/* KPIs Neón en Vivo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
        <div className="pixel-panel-cyan p-2.5">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Ciclo Actual</div>
          <div className="font-pixel text-sm text-[#00f0ff] mt-1">{activeWorld.cycle}</div>
          <div className="text-[10px] text-[#7c8cb8]">
            {splitScreen ? 'Dual pareado' : selectedController === 'smart' ? 'SmartTraffic' : 'Convencional'}
          </div>
        </div>

        <div className="pixel-panel p-2.5 border-[#ffb800]">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Espera Prom.</div>
          <div className="font-pixel text-sm text-[#ffb800] mt-1">
            {activeWorld.lastCycleAvgWaitPerVeh.toFixed(1)}s
          </div>
          <div className="text-[10px] text-[#7c8cb8]">
            Smart: {snapshot.smart.lastCycleAvgWaitPerVeh.toFixed(1)}s
          </div>
        </div>

        <div className="pixel-panel p-2.5 border-[#ff0055]">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Cola Máxima</div>
          <div className="font-pixel text-sm text-[#ff0055] mt-1">
            {activeWorld.lastCycleMaxQueue.toFixed(1)}
          </div>
          <div className="text-[10px] text-[#7c8cb8]">
            Pico hist: {activeWorld.maxQueueEver.toFixed(1)} veh
          </div>
        </div>

        <div className="pixel-panel-green p-2.5">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Autos Atendidos</div>
          <div className="font-pixel text-sm text-[#39ff14] mt-1">
            {Math.round(activeWorld.totalServed)}
          </div>
          <div className="text-[10px] text-[#7c8cb8]">
            +{activeWorld.lastCycleServed.toFixed(1)} últ. ciclo
          </div>
        </div>

        <div className="pixel-panel p-2.5">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Tramos R12 / R21</div>
          <div
            className={`font-pixel text-xs mt-1.5 ${
              r12Pct > 78 || r21Pct > 78 ? 'text-[#ff0055]' : 'text-[#00f0ff]'
            }`}
          >
            {r12Pct}% / {r21Pct}%
          </div>
          <div className="text-[10px] text-[#7c8cb8]">Umbral sat: 78%</div>
        </div>

        <div className="pixel-panel-green p-2.5">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Violaciones PSR</div>
          <div className="font-pixel text-sm text-[#39ff14] mt-1">
            {snapshot.smart.psrViolations}
          </div>
          <div className="text-[10px] text-[#7c8cb8]">Seguridad 100%</div>
        </div>

        <div className="pixel-panel-pink p-2.5">
          <div className="text-[10px] text-[#8f9ec9] uppercase">Ramas Podadas</div>
          <div className="font-pixel text-sm text-[#ff0055] mt-1">
            {snapshot.smart.lastPrunedBranches}
          </div>
          <div className="text-[10px] text-[#7c8cb8]">
            {snapshot.smart.lastDecisionLatencyMs.toFixed(2)} ms lat.
          </div>
        </div>
      </div>

      {/* Área Principal: Canvas + Panel Lateral de Controles */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Lienzo(s) Canvas 2D */}
        <div className="xl:col-span-8 space-y-3">
          {!splitScreen && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111428] border-2 border-[#2a3461] px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-pixel text-[10px] text-[#9aa8d1]">CONTROLADOR EN VISTA:</span>
                <button
                  type="button"
                  onClick={() => setSelectedController('smart')}
                  className={`px-2.5 py-1 border-2 font-bold text-xs cursor-pointer ${
                    selectedController === 'smart'
                      ? 'border-[#00f0ff] bg-[#00f0ff]/15 text-[#00f0ff]'
                      : 'border-[#2c3663] text-[#8f9ec9] hover:text-white'
                  }`}
                >
                  SmartTraffic (Poda Alfa-Beta)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedController('conventional')}
                  className={`px-2.5 py-1 border-2 font-bold text-xs cursor-pointer ${
                    selectedController === 'conventional'
                      ? 'border-[#ffb800] bg-[#ffb800]/15 text-[#ffb800]'
                      : 'border-[#2c3663] text-[#8f9ec9] hover:text-white'
                  }`}
                >
                  Semáforo Convencional (Fijo)
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#b5c2e8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSprites}
                  onChange={(e) => setUseSprites(e.target.checked)}
                  className="accent-[#00f0ff]"
                />
                <span>Usar Sprites PNG (si existen)</span>
              </label>
            </div>
          )}

          {splitScreen ? (
            <div className="space-y-3">
              <div className="pixel-panel-amber p-2">
                <canvas
                  ref={convCanvasRef}
                  width={880}
                  height={330}
                  className="w-full h-auto block pixelated bg-[#090a14]"
                />
              </div>
              <div className="pixel-panel-cyan p-2">
                <canvas
                  ref={smartCanvasRef}
                  width={880}
                  height={330}
                  className="w-full h-auto block pixelated bg-[#090a14]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9aa8d1] bg-[#111428] border-2 border-[#2a3461] px-3 py-2">
                <span>
                  Ambos lienzos reciben exactamente la misma secuencia de llegadas Poisson en cada ciclo.
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-[#e6edf7]">
                  <input
                    type="checkbox"
                    checked={useSprites}
                    onChange={(e) => setUseSprites(e.target.checked)}
                    className="accent-[#00f0ff]"
                  />
                  <span>Sprites PNG</span>
                </label>
              </div>
            </div>
          ) : (
            <div
              className={`p-2 ${
                selectedController === 'smart' ? 'pixel-panel-cyan' : 'pixel-panel-amber'
              }`}
            >
              <canvas
                ref={singleCanvasRef}
                width={880}
                height={500}
                className="w-full h-auto block pixelated bg-[#090a14]"
              />
            </div>
          )}

          {/* Resumen rápido comparativo debajo del Canvas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="pixel-panel-amber p-3 flex items-center justify-between">
              <div>
                <div className="font-pixel text-[10px] text-[#ffb800]">CONVENCIONAL FIJO</div>
                <div className="text-[#c8d4f5] mt-1">
                  I1: {snapshot.conventional.plan.g11}s Horiz / {snapshot.conventional.plan.g12}s Vert · I2:{' '}
                  {snapshot.conventional.plan.g21}s / {snapshot.conventional.plan.g22}s
                </div>
              </div>
              <div className="text-right font-mono-code">
                <div className="text-[#ffb800] font-bold">
                  Espera: {snapshot.conventional.lastCycleAvgWaitPerVeh.toFixed(1)}s
                </div>
                <div className="text-[#9aa8d1]">
                  Cola máx: {snapshot.conventional.lastCycleMaxQueue.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="pixel-panel-cyan p-3 flex items-center justify-between">
              <div>
                <div className="font-pixel text-[10px] text-[#00f0ff]">
                  SMARTTRAFFIC α-β · RÉCORD {snapshot.smart.lastDecisionLatencyMs.toFixed(2)} ms
                </div>
                <div className="text-[#c8d4f5] mt-1">
                  I1: {snapshot.smart.plan.g11}s Horiz / {snapshot.smart.plan.g12}s Vert · I2:{' '}
                  {snapshot.smart.plan.g21}s / {snapshot.smart.plan.g22}s
                </div>
              </div>
              <div className="text-right font-mono-code">
                <div className="text-[#39ff14] font-bold">
                  Espera: {snapshot.smart.lastCycleAvgWaitPerVeh.toFixed(1)}s
                </div>
                <div className="text-[#9aa8d1]">
                  Cola máx: {snapshot.smart.lastCycleMaxQueue.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          {/* FÓRMULA EN VIVO DEL SIMULADOR (CON DATOS REALES Y RESPUESTA EN TIEMPO RÉCORD) */}
          <div className="pixel-panel-green p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#213d29] pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#39ff14]" />
                <h3 className="font-pixel text-[10px] text-[#39ff14]">
                  FÓRMULAS EN VIVO DEL SIMULADOR (CON DATOS ACTUALES)
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-[#00f0ff]/15 border border-[#00f0ff] text-[#00f0ff] font-mono-code font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Decisión Agente: {snapshot.smart.lastDecisionLatencyMs.toFixed(2)} ms ·{' '}
                {waitDiffSeconds >= 0
                  ? `Ahorra ${waitDiffSeconds.toFixed(1)} s/veh de espera`
                  : `Delta ${Math.abs(waitDiffSeconds).toFixed(1)} s/veh`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Fórmula 1: Ecuación de transición por ciclo */}
              <div className="bg-[#090a14] border-2 border-[#293668] p-3 space-y-2">
                <div className="font-pixel text-[9px] text-[#00f0ff]">
                  1. ECUACIÓN DE FILA Y DESCARGA (POR CICLO DE 70 s)
                </div>
                <div className="bg-[#111428] border border-[#00f0ff]/50 px-2.5 py-1.5 font-mono-code text-[11px] text-[#9bfaff]">
                  q(t+1) = max(0, q(t) + veh/ciclo + 0.70·tramo − s·g)
                </div>
                <div className="space-y-1 text-[11px] text-[#cfd9f7] font-mono-code">
                  <div>
                    • Total entrando ahora:{' '}
                    <strong className="text-white">{totalIncomingPerCycle.toFixed(1)} veh/ciclo</strong>{' '}
                    (Horiz: {(rates['I1-F1'] + rates['I2-F1']).toFixed(1)} · Vert:{' '}
                    {(rates['I1-F2'] + rates['I2-F2']).toFixed(1)})
                  </div>
                  <div>
                    • Descarga I1 Convencional ({snapshot.conventional.plan.g11}s/{snapshot.conventional.plan.g12}s):{' '}
                    <span className="text-[#ffb800]">
                      Horiz {convCapI1F1} | Vert {convCapI1F2} veh/ciclo
                    </span>
                  </div>
                  <div>
                    • Descarga I1 SmartTraffic ({snapshot.smart.plan.g11}s/{snapshot.smart.plan.g12}s):{' '}
                    <span className="text-[#39ff14] font-bold">
                      Horiz {smartCapI1F1} | Vert {smartCapI1F2} veh/ciclo
                    </span>
                  </div>
                </div>
              </div>

              {/* Fórmula 2: Función de Costo / Utilidad en tiempo récord */}
              <div className="bg-[#090a14] border-2 border-[#293668] p-3 space-y-2">
                <div className="font-pixel text-[9px] text-[#ffb800]">
                  2. FUNCIÓN DE COSTO ALFA-BETA (HORIZONTE H = 4)
                </div>
                <div className="bg-[#111428] border border-[#ffb800]/50 px-2.5 py-1.5 font-mono-code text-[11px] text-[#ffd466]">
                  C = 100·[0.50·(Espera/(4·3800)) + 0.30·(ColaMáx/30) + 0.20·(Sat/4)]
                </div>
                <div className="space-y-1 text-[11px] text-[#cfd9f7] font-mono-code">
                  <div>
                    • Peor costo mínimo hallado (β):{' '}
                    <strong className="text-[#39ff14]">{snapshot.smart.lastWorstCost.toFixed(1)} pts</strong>{' '}
                    ({snapshot.smart.lastPrunedBranches} ramas podadas)
                  </div>
                  <div>
                    • Espera último ciclo:{' '}
                    <span className="text-[#ffb800]">
                      Conv {snapshot.conventional.lastCycleAvgWaitPerVeh.toFixed(1)} s
                    </span>{' '}
                    vs.{' '}
                    <span className="text-[#00f0ff] font-bold">
                      Smart {snapshot.smart.lastCycleAvgWaitPerVeh.toFixed(1)} s
                    </span>
                  </div>
                  <div>
                    • Reacción del agente:{' '}
                    <strong className="text-[#39ff14]">
                      {snapshot.smart.lastDecisionLatencyMs.toFixed(2)} ms
                    </strong>{' '}
                    (0 violaciones PSR)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Controles en Vivo */}
        <aside className="xl:col-span-4 space-y-4">
          {/* 1. Escenarios Preconfigurados */}
          <div className="pixel-panel p-4 space-y-3">
            <div className="flex items-center gap-2 border-b-2 border-[#263059] pb-2">
              <SlidersHorizontal className="w-4 h-4 text-[#00f0ff]" />
              <h3 className="font-pixel text-[11px] text-[#00f0ff]">ESCENARIOS SOPOCACHI (LA PAZ)</h3>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {(['habitual', 'pico', 'rafaga'] as const).map((scId) => {
                const sc = SCENARIOS[scId];
                const isActive = snapshot.config.scenario === scId;
                return (
                  <button
                    key={scId}
                    type="button"
                    onClick={() => handleScenarioChange(scId)}
                    className={`text-left p-2.5 border-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'border-[#00f0ff] bg-[#00f0ff]/12'
                        : 'border-[#27315c] bg-[#090a14] hover:border-[#4b5ca1]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-pixel text-[10px] ${
                          isActive ? 'text-[#00f0ff]' : 'text-white'
                        }`}
                      >
                        {sc.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-[#39ff14]">ACTIVO</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#9aa8d1] mt-1 leading-snug">{sc.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Configuración del Semáforo Convencional (Segundos Exactos) */}
          <div className="pixel-panel-amber p-4 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#3b3015] pb-2">
              <h3 className="font-pixel text-[10px] text-[#ffb800]">
                SEMÁFORO CONVENCIONAL (SEGUNDOS EXACTOS)
              </h3>
              <span className="text-[10px] text-[#ffd466] font-mono-code">Σ = 60s</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#e6edf7] font-bold">I1 · Av. 20 Oct / P. Salazar</span>
                  <div className="flex items-center gap-1.5 font-mono-code">
                    <label className="sr-only" htmlFor="conv-g11">
                      Segundos verde I1 C. Pedro Salazar
                    </label>
                    <input
                      id="conv-g11"
                      type="number"
                      min={10}
                      max={50}
                      value={snapshot.config.conventionalPlan.g11}
                      onChange={(e) => handleConventionalChange('g11', Number(e.target.value))}
                      className="w-14 bg-[#090a14] border-2 border-[#ffb800] px-1.5 py-0.5 text-center text-[#ffb800] font-bold"
                    />
                    <span className="text-[#9aa8d1]">s /</span>
                    <span className="w-10 text-center bg-[#090a14] border border-[#3a4575] py-0.5 text-white">
                      {snapshot.config.conventionalPlan.g12}s
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={1}
                  value={snapshot.config.conventionalPlan.g11}
                  onChange={(e) => handleConventionalChange('g11', Number(e.target.value))}
                  className="w-full retro-range amber"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#e6edf7] font-bold">I2 · Av. 6 Ago / P. Salazar</span>
                  <div className="flex items-center gap-1.5 font-mono-code">
                    <label className="sr-only" htmlFor="conv-g21">
                      Segundos verde I2 C. Pedro Salazar
                    </label>
                    <input
                      id="conv-g21"
                      type="number"
                      min={10}
                      max={50}
                      value={snapshot.config.conventionalPlan.g21}
                      onChange={(e) => handleConventionalChange('g21', Number(e.target.value))}
                      className="w-14 bg-[#090a14] border-2 border-[#ffb800] px-1.5 py-0.5 text-center text-[#ffb800] font-bold"
                    />
                    <span className="text-[#9aa8d1]">s /</span>
                    <span className="w-10 text-center bg-[#090a14] border border-[#3a4575] py-0.5 text-white">
                      {snapshot.config.conventionalPlan.g22}s
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={1}
                  value={snapshot.config.conventionalPlan.g21}
                  onChange={(e) => handleConventionalChange('g21', Number(e.target.value))}
                  className="w-full retro-range amber"
                />
              </div>
            </div>
          </div>

          {/* 3. Controles de Entrada (veh/ciclo) y Salida (tasa de saturación) */}
          <div className="pixel-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#263059] pb-2">
              <h3 className="font-pixel text-[10px] text-[#39ff14]">
                VEHÍCULOS POR CICLO Y DESCARGA EN VIVO
              </h3>
              <span className="text-[10px] text-[#8f9ec9]">
                {snapshot.activeScenarioSchedule ? 'Auto escenario' : 'Manual activo'}
              </span>
            </div>

            {/* Botones rápidos para aumentar autos en eje horizontal o vertical */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleInjectBurst('horizontal')}
                className="px-2 py-1.5 text-[10px] font-mono-code font-bold border-2 border-[#00f0ff] bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20 cursor-pointer"
              >
                + AUTOS HORIZ. (F1)
              </button>
              <button
                type="button"
                onClick={() => handleInjectBurst('vertical')}
                className="px-2 py-1.5 text-[10px] font-mono-code font-bold border-2 border-[#ffb800] bg-[#ffb800]/10 text-[#ffb800] hover:bg-[#ffb800]/20 cursor-pointer"
              >
                + AUTOS VERT. (F2)
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {APPROACH_IDS.map((approach) => (
                <label key={approach} className="block space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#c8d4f5]">{APPROACH_LABELS[approach]}</span>
                    <span className="font-mono-code font-bold text-[#00f0ff]">
                      {snapshot.config.arrivalRates[approach].toFixed(1)} veh/ciclo
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={26}
                    step={0.5}
                    value={snapshot.config.arrivalRates[approach]}
                    onChange={(e) => handleArrivalRateChange(approach, Number(e.target.value))}
                    className={`w-full retro-range ${
                      approach.endsWith('F2') ? 'amber' : ''
                    }`}
                  />
                </label>
              ))}

              <label className="block space-y-1 pt-2 border-t border-[#242e57]">
                <div className="flex justify-between">
                  <span className="text-[#39ff14] font-bold">Tasa de salida / descarga</span>
                  <span className="font-mono-code font-bold text-[#39ff14]">
                    {snapshot.config.saturationRate.toFixed(2)} veh/s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.02}
                  value={snapshot.config.saturationRate}
                  onChange={(e) => handleSaturationRateChange(Number(e.target.value))}
                  className="w-full retro-range green"
                />
              </label>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal nativo <dialog> de Sprites (cumple modern-web-guidance: dialog) */}
      <dialog
        ref={spritesDialogRef}
        aria-labelledby={spritesTitleId}
        {...({ closedby: 'any' } as Record<string, string>)}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b-2 border-[#26325e] pb-3">
            <div>
              <h3 id={spritesTitleId} className="font-pixel text-xs sm:text-sm text-[#00f0ff]">
                GESTOR DE SPRITES PIXEL-ART
              </h3>
              <p className="text-xs text-[#a5b3db] mt-1">
                Ruta automática detectada por Vite:{' '}
                <code className="bg-[#090a14] border border-[#00f0ff]/40 px-1.5 py-0.5 text-[#39ff14]">
                  src/assets/sprites/
                </code>
              </p>
            </div>
            <form method="dialog">
              <button
                type="submit"
                aria-label="Cerrar ventana de sprites"
                className="arcade-btn arcade-btn-pink !p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>

          <p className="text-xs text-[#d2ddf8] leading-relaxed">
            Coloca tus archivos PNG, SVG o WebP en <code className="text-[#00f0ff]">src/assets/sprites/</code> con
            los nombres recomendados (tamaño sugerido <strong>32×32</strong> o <strong>64×64 px</strong>) para
            reemplazar los gráficos sin tocar el código. Si falta algún archivo, el simulador dibuja automáticamente
            el fallback pixel-art neón por código.
          </p>

          <div className="space-y-2">
            {canonicalSprites.map((item) => (
              <div
                key={item.key}
                className="bg-[#090a14] border-2 border-[#25305c] p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-mono-code font-bold text-[#00f0ff]">
                    {item.recommendedFile}{' '}
                    <span className="text-[10px] text-[#9aa8d1] font-normal">({item.recommendedSize})</span>
                  </div>
                  <div className="text-[11px] text-[#a5b3db]">{item.description}</div>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-pixel ${
                    item.matchedFile
                      ? 'bg-[#39ff14]/15 border border-[#39ff14] text-[#39ff14]'
                      : 'bg-[#ffb800]/15 border border-[#ffb800] text-[#ffb800]'
                  }`}
                >
                  {item.matchedFile ? `ACTIVO (${item.matchedFile})` : 'FALLBACK PROCEDURAL'}
                </span>
              </div>
            ))}
          </div>

          {detectedFiles.length > 0 && (
            <div className="bg-[#090a14] border border-[#2a3668] p-3 text-[11px] text-[#9aa8d1]">
              <strong className="text-white">Archivos detectados actualmente en src/assets/sprites/:</strong>{' '}
              {detectedFiles.join(', ')}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <form method="dialog">
              <button type="submit" autoFocus className="arcade-btn arcade-btn-cyan">
                ENTENDIDO
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </motion.section>
  );
}
