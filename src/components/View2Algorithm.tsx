import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  GitBranch,
  Scale,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { PSR_BOUNDS, validatePSR } from '../engine/psr';

interface PseudocodeLine {
  num: number;
  code: string;
  tag?: 'ordering' | 'beta' | 'prune';
}

const PSEUDOCODE_LINES: readonly PseudocodeLine[] = [
  { num: 1, code: 'función DECIDIR_PODA_ALFA_BETA(estado_t, plan_vigente, tasas_λ):' },
  { num: 2, code: '  candidatos ← GENERAR_VECINOS_PSR(plan_vigente, Δg ∈ {-6,-3,0,+3,+6})' },
  { num: 3, code: '  candidatos ← ORDENAR_HEURISTICAMENTE(candidatos, colas_t, R12, R21)', tag: 'ordering' },
  { num: 4, code: '  muestras   ← GENERAR_POISSON(tasas_λ, M=8, H=4) ordenadas MAYOR→MENOR', tag: 'ordering' },
  { num: 5, code: '  β ← +∞ ; mejor_plan ← plan_vigente' },
  { num: 6, code: '  para cada plan p en candidatos:               // Nivel 0: Nodo MIN (Agente)' },
  { num: 7, code: '    α ← -∞                                      // Nivel 1: Nodo MAX (Entorno)' },
  { num: 8, code: '    para cada muestra m en muestras:' },
  { num: 9, code: '      costo ← EVALUAR_HORIZONTE_H4(estado_t, p, m)' },
  { num: 10, code: '      α ← max(α, costo)' },
  { num: 11, code: '      si α ≥ β entonces:                        // Regla de corte Alfa-Beta', tag: 'prune' },
  { num: 12, code: '        PODAR muestras restantes de p ; romper', tag: 'prune' },
  { num: 13, code: '    si α < β entonces:                          // Mejora del mejor plan MIN', tag: 'beta' },
  { num: 14, code: '      β ← α ; mejor_plan ← p', tag: 'beta' },
  { num: 15, code: '  retornar mejor_plan, β                        // Garantizado 0 violaciones PSR' },
];

type HighlightFilter = 'all' | 'ordering' | 'beta' | 'prune';

interface View2AlgorithmProps {
  onNextView: () => void;
}

export function View2Algorithm({ onNextView }: View2AlgorithmProps) {
  // Probador interactivo PSR
  const [testG11, setTestG11] = useState<number>(36);
  const [testG12, setTestG12] = useState<number>(24);
  const [testG21, setTestG21] = useState<number>(33);
  const [testG22, setTestG22] = useState<number>(27);

  // Calculadora interactiva de función de costo C(p,m)
  const [demoWait, setDemoWait] = useState<number>(6200);
  const [demoMaxQ, setDemoMaxQ] = useState<number>(14);
  const [demoSatCycles, setDemoSatCycles] = useState<number>(1);

  // Resaltado de pseudocódigo
  const [highlightMode, setHighlightMode] = useState<HighlightFilter>('all');

  const psrCheck = validatePSR({
    g11: testG11,
    g12: testG12,
    g21: testG21,
    g22: testG22,
  });

  const H = 4;
  const waitTerm = 100 * 0.5 * (demoWait / (H * 3800));
  const queueTerm = 100 * 0.3 * (demoMaxQ / 30);
  const satTerm = 100 * 0.2 * (demoSatCycles / H);
  const totalCost = waitTerm + queueTerm + satTerm;

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
            DIAPOSITIVA 02 / 05 — MOTOR DE DECISIÓN
          </span>
          <h2 className="font-pixel text-sm sm:text-base text-white leading-relaxed">
            FUNCIÓN DEL ALGORITMO: FORMULACIÓN, PSR Y PODA ALFA-BETA
          </h2>
          <p className="text-xs sm:text-sm text-[#a6b4db] mt-1">
            Cómo el agente formula el problema de búsqueda, garantiza seguridad vial (PSR) y recorta ramas dominadas con Alfa-Beta.
          </p>
        </div>
        <button type="button" onClick={onNextView} className="arcade-btn arcade-btn-green">
          IR AL SIMULADOR EN VIVO
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* BLOQUE 1: 4 PILARES DE FORMULACIÓN */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#00f0ff]" />
          <h3 className="font-pixel text-xs sm:text-sm text-[#00f0ff]">
            1. FORMULACIÓN DEL PROBLEMA DE BÚSQUEDA (4 PILARES)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="pixel-panel-cyan p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#00f0ff]">PILAR 01</span>
            <h4 className="font-pixel text-xs text-white">Estado Inicial</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Plan base equilibrado{' '}
              <code className="text-[#00f0ff] bg-[#090a14] px-1.5 py-0.5">g₀ = (30, 30, 30, 30) s</code>,
              vector de colas iniciales <code className="text-[#39ff14]">q(0)</code> y ocupación inicial de
              tramos conectores <code className="text-[#ffb800]">R12, R21</code>.
            </p>
          </div>

          <div className="pixel-panel-amber p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#ffb800]">PILAR 02</span>
            <h4 className="font-pixel text-xs text-white">Función Sucesor / Acciones</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Búsqueda local (hasta 2 iteraciones) mediante transferencias de tiempo de verde{' '}
              <code className="text-[#ffb800] bg-[#090a14] px-1.5 py-0.5">Δg ∈ &#123;-6, -3, 0, +3, +6&#125; s</code>{' '}
              en I1 e I2, filtradas estrictamente por el validador PSR.
            </p>
          </div>

          <div className="pixel-panel-green p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#39ff14]">PILAR 03</span>
            <h4 className="font-pixel text-xs text-white">Test Objetivo</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Mantener régimen operativo estable durante el horizonte <code className="text-[#39ff14]">H = 4 ciclos</code>{' '}
              sin desbordamiento (<em>spillback</em>) en R12/R21 (≤ 78%) y con mínimo peor costo.
            </p>
          </div>

          <div className="pixel-panel-pink p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#ff0055]">PILAR 04</span>
            <h4 className="font-pixel text-xs text-white">Función de Costo / Utilidad</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Combina linealmente 3 criterios normalizados: <strong>50% Espera</strong>,{' '}
              <strong>30% Cola Máxima</strong> y <strong>20% Saturación</strong>. El agente busca minimizar{' '}
              <code className="text-[#ff0055]">W(p) = max_m C(p, m)</code>.
            </p>
          </div>
        </div>

        {/* Desglose interactivo de pesos de la Función de Costo */}
        <div className="pixel-panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#ffb800]" />
              <h4 className="font-pixel text-[11px] text-[#ffb800]">
                DESGLOSE INTERACTIVO DE C(p, m) SOBRE HORIZONTE H = 4
              </h4>
            </div>
            <div className="text-xs font-mono-code bg-[#090a14] border-2 border-[#00f0ff] px-3 py-1.5 text-[#00f0ff]">
              C(p,m) = 100 · [ 0.50·(Espera/(H·3800)) + 0.30·(Colaₘₐₓ/30) + 0.20·(Sat/H) ]
            </div>
          </div>

          {/* Barra proporcional 50% / 30% / 20% */}
          <div className="w-full h-7 flex border-2 border-[#2a3461] overflow-hidden text-[11px] font-bold">
            <div className="w-1/2 bg-[#00f0ff]/25 border-r-2 border-[#00f0ff] flex items-center justify-center text-[#00f0ff]">
              50% ESPERA ACUMULADA
            </div>
            <div className="w-[30%] bg-[#ffb800]/25 border-r-2 border-[#ffb800] flex items-center justify-center text-[#ffb800]">
              30% COLA MÁX
            </div>
            <div className="w-[20%] bg-[#ff0055]/25 flex items-center justify-center text-[#ff0055]">
              20% SAT.
            </div>
          </div>

          {/* Sliders de prueba en vivo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#00f0ff] font-bold">Espera acum. (veh·s)</span>
                <span className="font-mono-code text-white">{demoWait}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={16000}
                step={200}
                value={demoWait}
                onChange={(e) => setDemoWait(Number(e.target.value))}
                className="w-full retro-range"
              />
              <div className="text-[11px] text-[#8d9cc7]">Aporte: +{waitTerm.toFixed(1)} pts</div>
            </label>

            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#ffb800] font-bold">Cola máxima (veh)</span>
                <span className="font-mono-code text-white">{demoMaxQ}</span>
              </div>
              <input
                type="range"
                min={0}
                max={35}
                step={1}
                value={demoMaxQ}
                onChange={(e) => setDemoMaxQ(Number(e.target.value))}
                className="w-full retro-range amber"
              />
              <div className="text-[11px] text-[#8d9cc7]">Aporte: +{queueTerm.toFixed(1)} pts</div>
            </label>

            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#ff0055] font-bold">Ciclos saturados (0–4)</span>
                <span className="font-mono-code text-white">{demoSatCycles} / 4</span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={demoSatCycles}
                onChange={(e) => setDemoSatCycles(Number(e.target.value))}
                className="w-full retro-range pink"
              />
              <div className="text-[11px] text-[#8d9cc7]">Aporte: +{satTerm.toFixed(1)} pts</div>
            </label>

            <div className="bg-[#090a14] border-2 border-[#39ff14] p-3 text-center">
              <div className="text-[10px] font-pixel text-[#9aa8d1]">COSTO TOTAL C(p, m)</div>
              <div className="font-pixel text-lg text-[#39ff14] mt-1">{totalCost.toFixed(2)}</div>
              <div className="text-[10px] text-[#8d9cc7] mt-1">Menor costo = mayor utilidad</div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: MODELO PSR (X, D, C) */}
      <div className="pixel-panel-green p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-[#213d29] pb-3">
          <CheckCircle2 className="w-5 h-5 text-[#39ff14]" />
          <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
            2. MODELO PSR (X, D, C) — SEGURIDAD VIAL GARANTIZADA (0 VIOLACIONES)
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#090a14] border-2 border-[#00f0ff] p-3.5 space-y-2">
              <div className="font-pixel text-xs text-[#00f0ff]">X — VARIABLES</div>
              <p className="text-xs text-[#d6e0fa] font-mono-code">
                X = &#123; g₁₁, g₁₂, g₂₁, g₂₂ &#125;
              </p>
              <p className="text-[11px] text-[#98a6cf]">
                Segundos de verde efectivo asignados a las fases F1 (corredor) y F2 (transversal) de I1 e I2.
              </p>
            </div>

            <div className="bg-[#090a14] border-2 border-[#ffb800] p-3.5 space-y-2">
              <div className="font-pixel text-xs text-[#ffb800]">D — DOMINIOS</div>
              <p className="text-xs text-[#d6e0fa] font-mono-code">
                gₖ,₁ ∈ [{PSR_BOUNDS.G1_MIN}, {PSR_BOUNDS.G1_MAX}] s
                <br />
                gₖ,₂ ∈ [{PSR_BOUNDS.G2_MIN}, {PSR_BOUNDS.G2_MAX}] s
              </p>
              <p className="text-[11px] text-[#98a6cf]">
                Garantiza mínimos peatonales/vehiculares y evita bloqueos prolongados en cualquier fase.
              </p>
            </div>

            <div className="bg-[#090a14] border-2 border-[#39ff14] p-3.5 space-y-2">
              <div className="font-pixel text-xs text-[#39ff14]">C — RESTRICCIONES</div>
              <p className="text-xs text-[#d6e0fa] font-mono-code">
                g₁₁ + g₁₂ = 60 s
                <br />
                g₂₁ + g₂₂ = 60 s
              </p>
              <p className="text-[11px] text-[#98a6cf]">
                + 10 s de seguridad (3 s amarillo + 2 s todo rojo × 2) = ciclo exacto de 70 s. Fases exclusivas.
              </p>
            </div>
          </div>

          {/* Validador interactivo PSR */}
          <div className="lg:col-span-5 bg-[#090a14] border-2 border-[#2c3866] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] text-white">PROBADOR EN VIVO DEL VALIDADOR PSR</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-pixel ${
                  psrCheck.valid
                    ? 'bg-[#39ff14] text-[#090a14]'
                    : 'bg-[#ff0055] text-white'
                }`}
              >
                {psrCheck.valid ? '✓ VÁLIDO PSR' : '✗ RECHAZADO'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: 'g11 (I1-F1)', val: testG11, set: setTestG11 },
                { label: 'g12 (I1-F2)', val: testG12, set: setTestG12 },
                { label: 'g21 (I2-F1)', val: testG21, set: setTestG21 },
                { label: 'g22 (I2-F2)', val: testG22, set: setTestG22 },
              ].map((field) => (
                <label key={field.label} className="space-y-1">
                  <span className="block text-[10px] text-[#9aa8d1]">{field.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={field.val}
                    onChange={(e) => field.set(Number(e.target.value))}
                    className="w-full bg-[#111428] border-2 border-[#303d70] px-2 py-1 text-white font-mono-code font-bold focus:border-[#00f0ff]"
                  />
                </label>
              ))}
            </div>

            {psrCheck.valid ? (
              <div className="text-xs text-[#39ff14] flex items-center gap-2 bg-[#39ff14]/10 border border-[#39ff14]/40 p-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Cumple dominios y sumas exactas (I1: {testG11 + testG12}s, I2: {testG21 + testG22}s). 0 violaciones.
                </span>
              </div>
            ) : (
              <div className="text-xs text-[#ff6b9a] space-y-1 bg-[#ff0055]/10 border border-[#ff0055]/50 p-2">
                <div className="flex items-center gap-1.5 font-bold text-[#ff0055]">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Plan descartado antes de entrar al árbol Alfa-Beta:</span>
                </div>
                {psrCheck.violations.map((v, i) => (
                  <div key={i}>• {v}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BLOQUE 3: FUNCIONAMIENTO DE LA PODA ALFA-BETA + PSEUDOCÓDIGO */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Conceptos MIN, MAX, α, β, corte */}
        <div className="xl:col-span-5 pixel-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-[#252f59] pb-2.5">
            <GitBranch className="w-5 h-5 text-[#ff0055]" />
            <h3 className="font-pixel text-xs text-white">3. PODA ALFA-BETA (MIN–MAX)</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="bg-[#090a14] border-l-4 border-[#00f0ff] p-3">
              <div className="font-pixel text-[10px] text-[#00f0ff] mb-1">NODO MIN (RAÍZ) — AGENTE SEMAFÓRICO</div>
              <p className="text-[#d4def8]">
                Elige el plan candidato <code className="text-[#00f0ff]">p*</code> que{' '}
                <strong>minimiza el peor costo</strong> entre todas las muestras estocásticas. Mantiene la cota superior{' '}
                <strong className="text-[#00f0ff]">β</strong> (mejor peor-costo hallado hasta el momento).
              </p>
            </div>

            <div className="bg-[#090a14] border-l-4 border-[#ffb800] p-3">
              <div className="font-pixel text-[10px] text-[#ffb800] mb-1">NODO MAX (NIVEL 1) — ENTORNO ADVERSARIO</div>
              <p className="text-[#d4def8]">
                Para cada plan candidato, evalúa <strong>M = 8 muestras Poisson</strong> ordenadas de mayor a menor demanda,
                buscando maximizar el costo. Mantiene la cota inferior{' '}
                <strong className="text-[#ffb800]">α</strong> (peor costo ya observado para ese plan).
              </p>
            </div>

            <div className="bg-[#090a14] border-l-4 border-[#ff0055] p-3">
              <div className="font-pixel text-[10px] text-[#ff0055] mb-1">REGLA DE CORTE: α ≥ β</div>
              <p className="text-[#d4def8]">
                Si una muestra hace que <strong className="text-[#ff0055]">α ≥ β</strong>, el peor caso de ese candidato ya
                es igual o peor que un plan conocido. El nodo MIN jamás lo elegirá, por lo que se{' '}
                <strong>podan de inmediato las muestras restantes</strong> sin perder optimalidad exacta.
              </p>
            </div>

            <div className="bg-[#090a14] border-l-4 border-[#39ff14] p-3">
              <div className="font-pixel text-[10px] text-[#39ff14] mb-1">ORDENAMIENTO HEURÍSTICO (MOVE ORDERING)</div>
              <p className="text-[#d4def8]">
                Evaluar primero el <strong>plan vigente</strong> fija rápido un β ajustado, y ordenar muestras de mayor a menor
                demanda dispara cortes tempranos ya en M1 o M2.
              </p>
            </div>
          </div>
        </div>

        {/* Pseudocódigo oficial coloreado */}
        <div className="xl:col-span-7 pixel-panel-cyan p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#233554] pb-2.5">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#00f0ff]" />
              <h3 className="font-pixel text-xs text-[#00f0ff]">
                PSEUDOCÓDIGO OFICIAL: DECIDIR_PODA_ALFA_BETA
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono-code">
              {[
                { id: 'all' as const, label: 'Todo', color: '#e6edf7' },
                { id: 'ordering' as const, label: 'Ordenamiento', color: '#ffb800' },
                { id: 'beta' as const, label: 'Act. β', color: '#39ff14' },
                { id: 'prune' as const, label: 'Poda α≥β', color: '#ff0055' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setHighlightMode(btn.id)}
                  className={`px-2 py-1 border font-bold cursor-pointer ${
                    highlightMode === btn.id ? 'bg-[#1b2447]' : 'bg-[#090a14] opacity-70 hover:opacity-100'
                  }`}
                  style={{ borderColor: btn.color, color: btn.color }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <pre className="bg-[#090a14] border-2 border-[#1f2950] p-3 overflow-x-auto text-xs sm:text-[13px] leading-6 font-mono-code">
            {PSEUDOCODE_LINES.map((line) => {
              const isHighlighted =
                highlightMode === 'all'
                  ? Boolean(line.tag)
                  : line.tag === highlightMode;

              let rowClass = 'text-[#cdd8f6]';
              if (line.tag === 'ordering' && (highlightMode === 'all' || highlightMode === 'ordering')) {
                rowClass = 'bg-[#ffb800]/12 text-[#ffd466] border-l-2 border-[#ffb800]';
              } else if (line.tag === 'prune' && (highlightMode === 'all' || highlightMode === 'prune')) {
                rowClass = 'bg-[#ff0055]/15 text-[#ff6b9a] border-l-2 border-[#ff0055] font-bold';
              } else if (line.tag === 'beta' && (highlightMode === 'all' || highlightMode === 'beta')) {
                rowClass = 'bg-[#39ff14]/12 text-[#80ff66] border-l-2 border-[#39ff14] font-bold';
              } else if (highlightMode !== 'all' && !isHighlighted) {
                rowClass = 'text-[#5b6994]';
              }

              return (
                <div key={line.num} className={`px-2 flex gap-3 ${rowClass}`}>
                  <span className="w-5 text-right select-none text-[#5a6894] shrink-0">
                    {line.num}
                  </span>
                  <span className="whitespace-pre">{line.code}</span>
                </div>
              );
            })}
          </pre>

          <div className="flex flex-wrap gap-3 text-[11px] text-[#9aa8d1]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ffb800] inline-block" /> Ordenamiento heurístico
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#39ff14] inline-block" /> Actualización de β (MIN)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ff0055] inline-block" /> Corte / Poda α ≥ β
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
