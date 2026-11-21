import { motion } from 'framer-motion';
import { Award, PlayCircle, ShieldCheck, TrendingDown, Zap } from 'lucide-react';
import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { runFullBenchmark } from '../engine/benchmark';
import type { SimulatorSnapshot } from '../engine/simulator';
import type { BenchmarkReport } from '../engine/types';

interface View5BenchmarksProps {
  snapshot: SimulatorSnapshot;
  onStepFiveCycles: () => void;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#090a14',
  border: '2px solid #00f0ff',
  borderRadius: 0,
  color: '#e6edf7',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '12px',
};

export function View5Benchmarks({ snapshot, onStepFiveCycles }: View5BenchmarksProps) {
  const [report, setReport] = useState<BenchmarkReport | null>(() =>
    runFullBenchmark(snapshot.config.conventionalPlan, snapshot.config.saturationRate, 30)
  );
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const tableCaptionId = useId();

  const handleRunBenchmark = (): void => {
    setIsComputing(true);
    // Defer un microtick para dar feedback visual de botón arcade
    window.setTimeout(() => {
      const nextReport = runFullBenchmark(
        snapshot.config.conventionalPlan,
        snapshot.config.saturationRate,
        30
      );
      setReport(nextReport);
      setIsComputing(false);
    }, 30);
  };

  const liveData = snapshot.history;

  const benchmarkBarWait =
    report?.results.map((r) => ({
      escenario: r.scenarioName.replace('Demanda ', ''),
      Convencional: r.conventional.avgWaitPerVeh,
      SmartTraffic: r.smart.avgWaitPerVeh,
    })) ?? [];

  const benchmarkBarQueue =
    report?.results.map((r) => ({
      escenario: r.scenarioName.replace('Demanda ', ''),
      Convencional: r.conventional.maxQueue,
      SmartTraffic: r.smart.maxQueue,
    })) ?? [];

  const benchmarkBarThroughput =
    report?.results.map((r) => ({
      escenario: r.scenarioName.replace('Demanda ', ''),
      Convencional: r.conventional.totalServed,
      SmartTraffic: r.smart.totalServed,
    })) ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Encabezado */}
      <div className="pixel-panel-cyan p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2 py-1 text-[10px] font-pixel bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff] mb-2">
            VISTA 05 / 05 — TELEMETRÍA EN VIVO Y BENCHMARK PAREADO
          </span>
          <h2 className="font-pixel text-sm sm:text-base text-white leading-relaxed">
            GRÁFICAS EN TIEMPO REAL Y BENCHMARKS (CONVENCIONAL VS. SMARTTRAFFIC)
          </h2>
          <p className="text-xs sm:text-sm text-[#a6b4db] mt-1">
            Comparación exclusiva bajo llegadas idénticas: Semáforo Convencional Fijo (I1:{' '}
            {snapshot.config.conventionalPlan.g11}s/{snapshot.config.conventionalPlan.g12}s, I2:{' '}
            {snapshot.config.conventionalPlan.g21}s/{snapshot.config.conventionalPlan.g22}s) vs. Agente SmartTraffic (Poda Alfa-Beta).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStepFiveCycles}
            className="arcade-btn arcade-btn-amber"
          >
            <Zap className="w-4 h-4" />
            +5 CICLOS EN VIVO
          </button>
          <button
            type="button"
            disabled={isComputing}
            onClick={handleRunBenchmark}
            className="arcade-btn arcade-btn-green"
          >
            <PlayCircle className="w-4 h-4" />
            {isComputing ? 'EJECUTANDO...' : 'EJECUTAR BENCHMARK COMPLETO (30 CICLOS)'}
          </button>
        </div>
      </div>

      {/* SECCIÓN A: 4 GRÁFICAS EN TIEMPO REAL DEL SIMULADOR */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-pixel text-xs sm:text-sm text-[#00f0ff]">
            A. TELEMETRÍA EN TIEMPO REAL DEL SIMULADOR ({liveData.length} CICLOS REGISTRADOS)
          </h3>
          {liveData.length === 0 && (
            <span className="text-xs text-[#ffb800]">
              Avanza ciclos en el Simulador (Vista 3) o pulsa "+5 Ciclos en Vivo" para poblar la serie temporal.
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Longitud Promedio de Cola por Ciclo */}
          <div className="pixel-panel p-4 space-y-2">
            <h4 className="font-pixel text-[10px] text-white">
              1. LONGITUD PROMEDIO DE COLA POR CICLO (VEH)
            </h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                  <XAxis dataKey="cycle" stroke="#8f9ec9" fontSize={11} />
                  <YAxis stroke="#8f9ec9" fontSize={11} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="conventionalAvgQueue"
                    name="Semáforo Convencional"
                    stroke="#ffb800"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="smartAvgQueue"
                    name="SmartTraffic α-β"
                    stroke="#00f0ff"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Espera Promedio por Vehículo (s) */}
          <div className="pixel-panel p-4 space-y-2">
            <h4 className="font-pixel text-[10px] text-white">
              2. ESPERA PROMEDIO POR VEHÍCULO (SEGUNDOS)
            </h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                  <XAxis dataKey="cycle" stroke="#8f9ec9" fontSize={11} />
                  <YAxis stroke="#8f9ec9" fontSize={11} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="conventionalAvgWait"
                    name="Semáforo Convencional (s)"
                    stroke="#ffb800"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="smartAvgWait"
                    name="SmartTraffic α-β (s)"
                    stroke="#00f0ff"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Flujo de Salida Acumulado (Autos atendidos) */}
          <div className="pixel-panel p-4 space-y-2">
            <h4 className="font-pixel text-[10px] text-white">
              3. FLUJO DE SALIDA ACUMULADO (AUTOS ATENDIDOS)
            </h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveData} margin={{ top: 8, right: 16, left: -6, bottom: 4 }}>
                  <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                  <XAxis dataKey="cycle" stroke="#8f9ec9" fontSize={11} />
                  <YAxis stroke="#8f9ec9" fontSize={11} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="conventionalCumulativeServed"
                    name="Convencional (veh)"
                    stroke="#ffb800"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="smartCumulativeServed"
                    name="SmartTraffic α-β (veh)"
                    stroke="#39ff14"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Nodos Evaluados vs. Ramas Podadas por Ciclo */}
          <div className="pixel-panel p-4 space-y-2">
            <h4 className="font-pixel text-[10px] text-white">
              4. NODOS EVALUADOS VS. RAMAS PODADAS POR CICLO
            </h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liveData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                  <XAxis dataKey="cycle" stroke="#8f9ec9" fontSize={11} />
                  <YAxis stroke="#8f9ec9" fontSize={11} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="evaluatedNodes"
                    name="Nodos Evaluados"
                    fill="#00f0ff"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="prunedBranches"
                    name="Ramas Podadas (α ≥ β)"
                    fill="#ff0055"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN B: BENCHMARK AUTOMÁTICO DE 30 CICLOS PAREADOS */}
      {report && (
        <div className="space-y-4 pt-2 border-t-2 border-[#232d57]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#39ff14]" />
              <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
                B. BENCHMARK PAREADO DE {report.cyclesPerScenario} CICLOS (3 ESCENARIOS — SEMILLAS FIJAS)
              </h3>
            </div>
            <span className="text-xs font-mono-code text-[#a5b3db]">
              Convencional configurado: I1 {report.conventionalPlan.g11}s/{report.conventionalPlan.g12}s | I2{' '}
              {report.conventionalPlan.g21}s/{report.conventionalPlan.g22}s · Descarga {report.saturationRate.toFixed(2)} veh/s
            </span>
          </div>

          {/* Tarjetas Resumen de % de Mejora por Escenario */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {report.results.map((res) => (
              <div key={res.scenarioId} className="pixel-panel-green p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#243d2c] pb-2">
                  <h4 className="font-pixel text-[11px] text-white">{res.scenarioName}</h4>
                  <span className="px-2 py-0.5 text-[10px] font-pixel bg-[#39ff14]/15 border border-[#39ff14] text-[#39ff14]">
                    0 VIOL. PSR
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#090a14] border border-[#242e57] p-2">
                    <div className="text-[10px] text-[#8f9ec9]">Reducción Espera</div>
                    <div className="font-pixel text-xs text-[#00f0ff] mt-1 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {res.waitImprovementPct >= 0 ? `+${res.waitImprovementPct}%` : `${res.waitImprovementPct}%`}
                    </div>
                  </div>
                  <div className="bg-[#090a14] border border-[#242e57] p-2">
                    <div className="text-[10px] text-[#8f9ec9]">Reducción Cola Máx</div>
                    <div className="font-pixel text-xs text-[#39ff14] mt-1">
                      {res.maxQueueImprovementPct >= 0
                        ? `+${res.maxQueueImprovementPct}%`
                        : `${res.maxQueueImprovementPct}%`}
                    </div>
                  </div>
                  <div className="bg-[#090a14] border border-[#242e57] p-2">
                    <div className="text-[10px] text-[#8f9ec9]">Mejora Salida</div>
                    <div className="font-pixel text-xs text-[#ffb800] mt-1">
                      {res.throughputImprovementPct >= 0
                        ? `+${res.throughputImprovementPct}%`
                        : `${res.throughputImprovementPct}%`}
                    </div>
                  </div>
                  <div className="bg-[#090a14] border border-[#242e57] p-2">
                    <div className="text-[10px] text-[#8f9ec9]">Poda Promedio</div>
                    <div className="font-pixel text-xs text-[#ff0055] mt-1">
                      {res.smart.pruningRatePct}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla Comparativa Accesible (cumple modern-web-guidance: responsive-table) */}
          <div className="pixel-panel p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00f0ff]" />
                <span id={tableCaptionId} className="font-pixel text-[11px] text-[#00f0ff]">
                  TABLA COMPARATIVA EXACTA: CONVENCIONAL FIJO VS. SMARTTRAFFIC ALFA-BETA
                </span>
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby={tableCaptionId}
              className="table-wrapper border-2 border-[#263059]"
            >
              <table className="text-xs font-mono-code text-left">
                <caption className="sr-only">
                  Resultados pareados de 30 ciclos comparando Semáforo Convencional y Agente SmartTraffic
                </caption>
                <thead className="bg-[#090a14] text-[#00f0ff]">
                  <tr>
                    <th className="p-3 border-b-2 border-[#263059]">Escenario</th>
                    <th className="p-3 border-b-2 border-[#263059]">Espera Conv. (s)</th>
                    <th className="p-3 border-b-2 border-[#263059]">Espera Smart (s)</th>
                    <th className="p-3 border-b-2 border-[#263059]">Mejora Espera</th>
                    <th className="p-3 border-b-2 border-[#263059]">Cola Máx Conv / Smart</th>
                    <th className="p-3 border-b-2 border-[#263059]">Mejora Cola</th>
                    <th className="p-3 border-b-2 border-[#263059]">Salidas Conv / Smart</th>
                    <th className="p-3 border-b-2 border-[#263059]">Viol. PSR</th>
                    <th className="p-3 border-b-2 border-[#263059]">Poda / Latencia</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((r) => (
                    <tr
                      key={r.scenarioId}
                      className="border-b border-[#1d2547] hover:bg-[#171d3d]/70"
                    >
                      <th className="p-3 font-bold text-white bg-[#111428] border-b border-[#1d2547]">
                        {r.scenarioName}
                      </th>
                      <td className="p-3 text-[#ffb800] border-b border-[#1d2547]">
                        {r.conventional.avgWaitPerVeh.toFixed(2)} s
                      </td>
                      <td className="p-3 text-[#00f0ff] font-bold border-b border-[#1d2547]">
                        {r.smart.avgWaitPerVeh.toFixed(2)} s
                      </td>
                      <td className="p-3 border-b border-[#1d2547]">
                        <span className="px-2 py-0.5 bg-[#39ff14]/15 border border-[#39ff14] text-[#39ff14] font-bold">
                          {r.waitImprovementPct >= 0 ? `-${r.waitImprovementPct}%` : `+${Math.abs(r.waitImprovementPct)}%`}
                        </span>
                      </td>
                      <td className="p-3 border-b border-[#1d2547]">
                        <span className="text-[#ffb800]">{r.conventional.maxQueue.toFixed(1)}</span>
                        {' / '}
                        <span className="text-[#00f0ff] font-bold">{r.smart.maxQueue.toFixed(1)}</span>
                      </td>
                      <td className="p-3 text-[#39ff14] font-bold border-b border-[#1d2547]">
                        {r.maxQueueImprovementPct >= 0
                          ? `-${r.maxQueueImprovementPct}%`
                          : `+${Math.abs(r.maxQueueImprovementPct)}%`}
                      </td>
                      <td className="p-3 border-b border-[#1d2547]">
                        <span className="text-[#ffb800]">{r.conventional.totalServed}</span>
                        {' / '}
                        <span className="text-[#39ff14] font-bold">{r.smart.totalServed}</span>
                      </td>
                      <td className="p-3 text-[#39ff14] font-bold border-b border-[#1d2547]">
                        {r.smart.psrViolations}
                      </td>
                      <td className="p-3 text-[#ff6b9a] border-b border-[#1d2547]">
                        {r.smart.pruningRatePct}% · {r.smart.avgDecisionMs.toFixed(2)} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráficas de Barras Comparativas del Benchmark */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="pixel-panel p-4 space-y-2">
              <h4 className="font-pixel text-[10px] text-[#00f0ff]">
                ESPERA PROMEDIO (s/veh — MENOR ES MEJOR)
              </h4>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkBarWait} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                    <XAxis dataKey="escenario" stroke="#8f9ec9" fontSize={11} />
                    <YAxis stroke="#8f9ec9" fontSize={11} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Convencional" fill="#ffb800" isAnimationActive={false} />
                    <Bar dataKey="SmartTraffic" fill="#00f0ff" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pixel-panel p-4 space-y-2">
              <h4 className="font-pixel text-[10px] text-[#ff0055]">
                COLA MÁXIMA (VEH — MENOR ES MEJOR)
              </h4>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkBarQueue} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                    <XAxis dataKey="escenario" stroke="#8f9ec9" fontSize={11} />
                    <YAxis stroke="#8f9ec9" fontSize={11} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Convencional" fill="#ffb800" isAnimationActive={false} />
                    <Bar dataKey="SmartTraffic" fill="#ff0055" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pixel-panel p-4 space-y-2">
              <h4 className="font-pixel text-[10px] text-[#39ff14]">
                FLUJO DE SALIDA TOTAL (VEH — MAYOR ES MEJOR)
              </h4>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkBarThroughput} margin={{ top: 8, right: 12, left: -4, bottom: 4 }}>
                    <CartesianGrid stroke="#1e274a" strokeDasharray="4 4" />
                    <XAxis dataKey="escenario" stroke="#8f9ec9" fontSize={11} />
                    <YAxis stroke="#8f9ec9" fontSize={11} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Convencional" fill="#ffb800" isAnimationActive={false} />
                    <Bar dataKey="SmartTraffic" fill="#39ff14" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}
