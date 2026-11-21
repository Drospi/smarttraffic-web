import { useCallback, useEffect, useRef, useState } from 'react';
import { Navbar, type ViewId } from './components/Navbar';
import { View1REAS } from './components/View1REAS';
import { View2Algorithm } from './components/View2Algorithm';
import { View3Simulator } from './components/View3Simulator';
import { View4Inspector } from './components/View4Inspector';
import { View5Benchmarks } from './components/View5Benchmarks';
import { DualCorridorSimulator, type SimulatorSnapshot } from './engine/simulator';

function createBootstrappedSimulator(): DualCorridorSimulator {
  const sim = new DualCorridorSimulator('pico', 202604);
  // Sembrar 3 ciclos iniciales reales para que el Inspector y las Gráficas tengan datos reales de entrada
  sim.stepCycle();
  sim.stepCycle();
  sim.stepCycle();
  return sim;
}

export function App() {
  const [activeView, setActiveView] = useState<ViewId>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(2);

  // Motor de simulación 100% desacoplado de React mantenido en useRef sin lecturas de ref en render
  const [initialSim] = useState<DualCorridorSimulator>(createBootstrappedSimulator);
  const simulatorRef = useRef<DualCorridorSimulator>(initialSim);

  const [snapshot, setSnapshot] = useState<SimulatorSnapshot>(() =>
    initialSim.getSnapshot()
  );

  const isRunningRef = useRef<boolean>(isRunning);
  const speedRef = useRef<number>(speed);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const syncSnapshot = useCallback((): void => {
    setSnapshot(simulatorRef.current.getSnapshot());
  }, []);

  // Loop maestro independiente de Hz con deltaTime acotado:
  // Nunca llama setState a 60 FPS; solo sincroniza React cuando termina un ciclo o cada 350ms para HUD.
  useEffect(() => {
    let rafId = 0;
    let lastTimestamp = performance.now();
    let hudAccumulator = 0;

    const tick = (now: number): void => {
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dtClamped = Math.min(0.1, Math.max(0, rawDt));

      if (isRunningRef.current) {
        // 1x = 7 segundos simulados por segundo real (un ciclo de 70s tarda 10s a 1x)
        const simSeconds = dtClamped * 7 * speedRef.current;
        const completedCycle = simulatorRef.current.advanceTime(simSeconds);
        hudAccumulator += dtClamped;

        if (completedCycle || hudAccumulator >= 0.35) {
          hudAccumulator = 0;
          setSnapshot(simulatorRef.current.getSnapshot());
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleStepCycle = useCallback((): void => {
    simulatorRef.current.stepCycle();
    syncSnapshot();
  }, [syncSnapshot]);

  const handleStepFiveCycles = useCallback((): void => {
    for (let i = 0; i < 5; i += 1) {
      simulatorRef.current.stepCycle();
    }
    syncSnapshot();
  }, [syncSnapshot]);

  const handleReset = useCallback((): void => {
    setIsRunning(false);
    simulatorRef.current.reset();
    syncSnapshot();
  }, [syncSnapshot]);

  return (
    <div className="min-h-screen pixel-grid-bg text-[#e6edf7] flex flex-col">
      <Navbar
        activeView={activeView}
        onSelectView={setActiveView}
        cycle={snapshot.smart.cycle}
        isRunning={isRunning}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-5 py-5">
        {activeView === 1 && <View1REAS onNextView={() => setActiveView(2)} />}

        {activeView === 2 && <View2Algorithm onNextView={() => setActiveView(3)} />}

        {activeView === 3 && (
          <View3Simulator
            simulatorRef={simulatorRef}
            snapshot={snapshot}
            isRunning={isRunning}
            speed={speed}
            onToggleRun={() => setIsRunning((prev) => !prev)}
            onStepCycle={handleStepCycle}
            onReset={handleReset}
            onChangeSpeed={setSpeed}
            onSyncSnapshot={syncSnapshot}
          />
        )}

        {activeView === 4 && <View4Inspector realTrace={snapshot.latestTrace} />}

        {activeView === 5 && (
          <View5Benchmarks
            snapshot={snapshot}
            onStepFiveCycles={handleStepFiveCycles}
          />
        )}
      </main>

      <footer className="border-t-2 border-[#1f284d] bg-[#090a14]/90 py-3 px-4 text-center text-[11px] text-[#7c8cb8] font-mono-code">
        SmartTraffic La Paz · Corredor Pérez Velasco (I1) – Acceso Autopista / Av. Montes (I2) · Motor IA en TypeScript puro (PSR + Poda Alfa-Beta)
      </footer>
    </div>
  );
}

export default App;
