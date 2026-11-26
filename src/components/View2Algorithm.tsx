import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  ListChecks,
  Scale,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { PSR_BOUNDS, validatePSR } from '../engine/psr';

interface PlainStep {
  num: number;
  title: string;
  description: string;
  tag: 'ordering' | 'calc' | 'beta' | 'prune';
}

const PLAIN_ALGORITHM_STEPS: readonly PlainStep[] = [
  {
    num: 1,
    title: 'Genera planes alternativos y filtra solo los seguros',
    description:
      'A partir de los segundos actuales de verde, propone mover 3 o 6 segundos entre la avenida principal y la calle transversal. Cualquier opción que viole los límites seguros se descarta de inmediato.',
    tag: 'ordering',
  },
  {
    num: 2,
    title: 'Ordena primero los planes más prometedores y el tráfico más difícil',
    description:
      'Coloca primero el plan actual y los planes mejor alineados con las filas reales. Además ordena los 8 escenarios de tráfico desde el más cargado (más vehículos por ciclo) hasta el más liviano.',
    tag: 'ordering',
  },
  {
    num: 3,
    title: 'Calcula el Puntaje de Congestión con variables reales del tráfico',
    description:
      'Para cada plan y cada escenario de 4 ciclos, simula cuántos vehículos esperan en fila, cuánto tiempo de espera acumulan y si se satura la cuadra central. Con esos tres datos suma el puntaje (50% espera + 30% fila más larga + 20% saturación).',
    tag: 'calc',
  },
  {
    num: 4,
    title: 'Registra el peor resultado de cada plan (Alfa) y corta si no puede ganar (Poda)',
    description:
      'El puntaje más alto que sufre un plan se guarda como su valor Alfa. Si ese valor Alfa ya es igual o mayor que el puntaje del mejor plan guardado (Beta), es imposible que este plan gane y se podan sin calcular sus escenarios restantes.',
    tag: 'prune',
  },
  {
    num: 5,
    title: 'Actualiza el mejor plan (Beta) y lo aplica al iniciar el ciclo',
    description:
      'Si un plan logra pasar todos los escenarios con un peor puntaje menor que Beta, se convierte en el nuevo mejor plan y Beta baja a ese nuevo puntaje. Al terminar, el ganador se envía a ambos semáforos.',
    tag: 'beta',
  },
];

type HighlightFilter = 'all' | 'ordering' | 'calc' | 'beta' | 'prune';

interface View2AlgorithmProps {
  onNextView: () => void;
}

export function View2Algorithm({ onNextView }: View2AlgorithmProps) {
  // Probador interactivo de Reglas de Seguridad Vial (PSR)
  const [testG11, setTestG11] = useState<number>(36);
  const [testG12, setTestG12] = useState<number>(24);
  const [testG21, setTestG21] = useState<number>(33);
  const [testG22, setTestG22] = useState<number>(27);

  // Calculadora interactiva en palabras claras (usando variables reales del tráfico)
  const [demoWait, setDemoWait] = useState<number>(6200);
  const [demoMaxQ, setDemoMaxQ] = useState<number>(14);
  const [demoSatCycles, setDemoSatCycles] = useState<number>(1);

  // Filtro visual de pasos del algoritmo
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
            DIAPOSITIVA 02 / 05 — CÓMO DECIDE EL AGENTE
          </span>
          <h2 className="font-pixel text-sm sm:text-base text-white leading-relaxed">
            FUNCIÓN DEL ALGORITMO: REGLAS DE SEGURIDAD Y PODA ALFA-BETA
          </h2>
          <p className="text-xs sm:text-sm text-[#a6b4db] mt-1">
            Explicación clara y sin código de cómo el agente evalúa vehículos, tiempo de espera y filas para elegir el mejor reparto de luz verde.
          </p>
        </div>
        <button type="button" onClick={onNextView} className="arcade-btn arcade-btn-green">
          IR AL SIMULADOR EN VIVO
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* BLOQUE 1: 4 PILARES EN LENGUAJE CLARO */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#00f0ff]" />
          <h3 className="font-pixel text-xs sm:text-sm text-[#00f0ff]">
            1. CÓMO SE PLANTEA EL PROBLEMA (4 PILARES)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="pixel-panel-cyan p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#00f0ff]">PILAR 01</span>
            <h4 className="font-pixel text-xs text-white">Punto de Partida</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Inicia con un reparto equilibrado de <strong>30 segundos</strong> para la avenida principal y{' '}
              <strong>30 segundos</strong> para la calle transversal en ambos cruces, leyendo las filas actuales y cuántos vehículos hay en las cuadras centrales.
            </p>
          </div>

          <div className="pixel-panel-amber p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#ffb800]">PILAR 02</span>
            <h4 className="font-pixel text-xs text-white">Ajustes Permitidos</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Prueba planes cercanos sumando o restando <strong>3 o 6 segundos</strong> de luz verde entre la avenida principal y la transversal, aceptando solo planes que cumplan todas las reglas de seguridad vial.
            </p>
          </div>

          <div className="pixel-panel-green p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#39ff14]">PILAR 03</span>
            <h4 className="font-pixel text-xs text-white">Objetivo Operativo</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Mantener el corredor fluido durante los <strong>próximos 4 ciclos</strong> sin que ninguna cuadra central supere el <strong>78% de llenado</strong> (más de 18 de 24 vehículos).
            </p>
          </div>

          <div className="pixel-panel-pink p-4 space-y-2">
            <span className="text-[10px] font-pixel text-[#ff0055]">PILAR 04</span>
            <h4 className="font-pixel text-xs text-white">Criterio de Evaluación</h4>
            <p className="text-xs text-[#d1dcf7] leading-relaxed">
              Cada plan recibe un <strong>Puntaje de Congestión</strong> usando datos reales: <strong>50%</strong> Tiempo de espera,{' '}
              <strong>30%</strong> Fila más larga de vehículos y <strong>20%</strong> Ciclos saturados. Gana el puntaje más bajo en su peor escenario.
            </p>
          </div>
        </div>

        {/* Desglose interactivo con variables reales en palabras */}
        <div className="pixel-panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#ffb800]" />
              <h4 className="font-pixel text-[11px] text-[#ffb800]">
                CÓMO SE CALCULA EL PUNTAJE DE CONGESTIÓN (PRUÉBALO EN VIVO)
              </h4>
            </div>
            <div className="text-xs bg-[#090a14] border-2 border-[#00f0ff] px-3 py-1.5 text-[#00f0ff] font-bold">
              Puntaje Total = Tiempo de espera (50%) + Fila más larga (30%) + Ciclos saturados (20%)
            </div>
          </div>

          {/* Barra proporcional 50% / 30% / 20% */}
          <div className="w-full h-7 flex border-2 border-[#2a3461] overflow-hidden text-[11px] font-bold">
            <div className="w-1/2 bg-[#00f0ff]/25 border-r-2 border-[#00f0ff] flex items-center justify-center text-[#00f0ff]">
              50% TIEMPO DE ESPERA
            </div>
            <div className="w-[30%] bg-[#ffb800]/25 border-r-2 border-[#ffb800] flex items-center justify-center text-[#ffb800]">
              30% FILA MÁS LARGA
            </div>
            <div className="w-[20%] bg-[#ff0055]/25 flex items-center justify-center text-[#ff0055]">
              20% SATURACIÓN
            </div>
          </div>

          {/* Sliders interactivos con nombres claros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#00f0ff] font-bold">Tiempo total de espera (4 ciclos)</span>
                <span className="font-mono-code text-white">{demoWait.toLocaleString('es-BO')} s</span>
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
              <div className="text-[11px] text-[#8d9cc7]">
                Aporta <strong>+{waitTerm.toFixed(1)} puntos</strong> (pesa 50%)
              </div>
            </label>

            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#ffb800] font-bold">Vehículos en la fila más larga</span>
                <span className="font-mono-code text-white">{demoMaxQ} vehículos</span>
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
              <div className="text-[11px] text-[#8d9cc7]">
                Aporta <strong>+{queueTerm.toFixed(1)} puntos</strong> (pesa 30%)
              </div>
            </label>

            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#ff0055] font-bold">Ciclos con cuadra saturada</span>
                <span className="font-mono-code text-white">{demoSatCycles} de 4 ciclos</span>
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
              <div className="text-[11px] text-[#8d9cc7]">
                Aporta <strong>+{satTerm.toFixed(1)} puntos</strong> (pesa 20%)
              </div>
            </label>

            <div className="bg-[#090a14] border-2 border-[#39ff14] p-3 text-center">
              <div className="text-[10px] font-pixel text-[#9aa8d1]">PUNTAJE DE CONGESTIÓN</div>
              <div className="font-pixel text-lg text-[#39ff14] mt-1">{totalCost.toFixed(1)} pts</div>
              <div className="text-[10px] text-[#8d9cc7] mt-1">
                {waitTerm.toFixed(1)} + {queueTerm.toFixed(1)} + {satTerm.toFixed(1)} · Menor es mejor
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: REGLAS DE SEGURIDAD VIAL (PSR) EN TEXTO CLARO */}
      <div className="pixel-panel-green p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-[#213d29] pb-3">
          <CheckCircle2 className="w-5 h-5 text-[#39ff14]" />
          <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
            2. REGLAS DE SEGURIDAD VIAL (MODELO PSR — CERO VIOLACIONES)
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#090a14] border-2 border-[#00f0ff] p-3.5 space-y-2">
              <div className="font-pixel text-[10px] text-[#00f0ff]">QUÉ AJUSTA (VARIABLES)</div>
              <p className="text-xs text-[#d6e0fa] font-bold">
                Los 4 tiempos de luz verde:
              </p>
              <p className="text-[11px] text-[#98a6cf] leading-relaxed">
                Segundos de verde para C. Pedro Salazar (eje horizontal hacia Belisario Salinas) y las avenidas verticales Av. 20 de Octubre (Plaza Avaroa) y Av. 6 de Agosto.
              </p>
            </div>

            <div className="bg-[#090a14] border-2 border-[#ffb800] p-3.5 space-y-2">
              <div className="font-pixel text-[10px] text-[#ffb800]">LÍMITES SEGUROS (DOMINIOS)</div>
              <p className="text-xs text-[#d6e0fa] font-bold">
                Principal: {PSR_BOUNDS.G1_MIN} a {PSR_BOUNDS.G1_MAX} segundos
                <br />
                Transversal: {PSR_BOUNDS.G2_MIN} a {PSR_BOUNDS.G2_MAX} segundos
              </p>
              <p className="text-[11px] text-[#98a6cf] leading-relaxed">
                Evita luces demasiado cortas para cruzar o esperas eternas en cualquier calle.
              </p>
            </div>

            <div className="bg-[#090a14] border-2 border-[#39ff14] p-3.5 space-y-2">
              <div className="font-pixel text-[10px] text-[#39ff14]">REGLAS OBLIGATORIAS</div>
              <p className="text-xs text-[#d6e0fa] font-bold">
                Suma exacta = 60 s de verde por cruce
              </p>
              <p className="text-[11px] text-[#98a6cf] leading-relaxed">
                Más 10 s de seguridad (amarillo 2 s + todo rojo 3 s por fase) = ciclo exacto de 70 s. Nunca dos vías cruzadas en verde a la vez.
              </p>
            </div>
          </div>

          {/* Probador interactivo de seguridad vial */}
          <div className="lg:col-span-5 bg-[#090a14] border-2 border-[#2c3866] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] text-white">PROBADOR EN VIVO DE SEGURIDAD VIAL</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-pixel ${
                  psrCheck.valid
                    ? 'bg-[#39ff14] text-[#090a14]'
                    : 'bg-[#ff0055] text-white'
                }`}
              >
                {psrCheck.valid ? '✓ PLAN SEGURO' : '✗ RECHAZADO'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'I1 · C. Pedro Salazar (s)', val: testG11, set: setTestG11 },
                { label: 'I1 · Av. 20 de Octubre (s)', val: testG12, set: setTestG12 },
                { label: 'I2 · P. Salazar / Belisario (s)', val: testG21, set: setTestG21 },
                { label: 'I2 · Av. 6 de Agosto (s)', val: testG22, set: setTestG22 },
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
                  Cumple los límites seguros y ambos cruces suman exactamente 60 s de verde efectivo.
                </span>
              </div>
            ) : (
              <div className="text-xs text-[#ff6b9a] space-y-1 bg-[#ff0055]/10 border border-[#ff0055]/50 p-2">
                <div className="flex items-center gap-1.5 font-bold text-[#ff0055]">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Plan bloqueado antes de evaluarse:</span>
                </div>
                {psrCheck.violations.map((v, i) => (
                  <div key={i}>• {v}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BLOQUE 3: FUNCIONAMIENTO DE LA PODA ALFA-BETA (EN LENGUAJE CLARO, SIN CÓDIGO) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Conceptos clave en palabras simples */}
        <div className="xl:col-span-5 pixel-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-[#252f59] pb-2.5">
            <GitBranch className="w-5 h-5 text-[#ff0055]" />
            <h3 className="font-pixel text-xs text-white">3. QUÉ SON ALFA, BETA Y LA PODA</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="bg-[#090a14] border-l-4 border-[#00f0ff] p-3">
              <div className="font-pixel text-[10px] text-[#00f0ff] mb-1">
                EL AGENTE (BUSCA EL MENOR PUNTAJE — BETA)
              </div>
              <p className="text-[#d4def8] leading-relaxed">
                Nuestro semáforo inteligente busca el plan que produzca la <strong>menor congestión posible</strong>. El puntaje del mejor plan encontrado hasta el momento se guarda como su referencia <strong>Beta</strong>.
              </p>
            </div>

            <div className="bg-[#090a14] border-l-4 border-[#ffb800] p-3">
              <div className="font-pixel text-[10px] text-[#ffb800] mb-1">
                EL TRÁFICO ADVERSARIO (PEOR ESCENARIO — ALFA)
              </div>
              <p className="text-[#d4def8] leading-relaxed">
                Cada plan candidato se pone a prueba contra <strong>8 escenarios distintos de llegada de vehículos</strong> (del más congestionado al más suave). El puntaje más alto que sufre ese plan hasta el momento se guarda como <strong>Alfa</strong>.
              </p>
            </div>

            <div className="bg-[#090a14] border-l-4 border-[#ff0055] p-3">
              <div className="font-pixel text-[10px] text-[#ff0055] mb-1">
                REGLA DE PODA (CUÁNDO DEJA DE CALCULAR)
              </div>
              <p className="text-[#d4def8] leading-relaxed">
                Si un plan ya llegó a un puntaje <strong>Alfa igual o mayor que Beta</strong>, ya sabemos con seguridad que es peor que un plan que ya tenemos guardado. Entonces el agente <strong>poda (descarta) los escenarios que faltaban</strong> sin perder precisión.
              </p>
            </div>

            <div className="bg-[#090a14] border-l-4 border-[#39ff14] p-3">
              <div className="font-pixel text-[10px] text-[#39ff14] mb-1">
                POR QUÉ ES TAN RÁPIDO
              </div>
              <p className="text-[#d4def8] leading-relaxed">
                Al probar primero el plan vigente (que ya da una buena referencia Beta) y empezar cada plan por el escenario con más vehículos por ciclo, los planes malos fallan al primer intento y se ahorra más del 60% de los cálculos.
              </p>
            </div>
          </div>
        </div>

        {/* Guía paso a paso en español claro (en lugar de bloque de código) */}
        <div className="xl:col-span-7 pixel-panel-cyan p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#233554] pb-2.5">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-[#00f0ff]" />
              <h3 className="font-pixel text-xs text-[#00f0ff]">
                PASO A PASO EN PALABRAS SIMPLES (SIN CÓDIGO)
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {[
                { id: 'all' as const, label: 'Todos', color: '#e6edf7' },
                { id: 'ordering' as const, label: 'Ordenar', color: '#ffb800' },
                { id: 'calc' as const, label: 'Calcular datos', color: '#00f0ff' },
                { id: 'prune' as const, label: 'Podar', color: '#ff0055' },
                { id: 'beta' as const, label: 'Elegir mejor', color: '#39ff14' },
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

          <div className="space-y-2.5">
            {PLAIN_ALGORITHM_STEPS.map((step) => {
              const isHighlighted = highlightMode === 'all' || highlightMode === step.tag;
              const accent =
                step.tag === 'ordering'
                  ? '#ffb800'
                  : step.tag === 'calc'
                  ? '#00f0ff'
                  : step.tag === 'prune'
                  ? '#ff0055'
                  : '#39ff14';

              return (
                <div
                  key={step.num}
                  className={`bg-[#090a14] border-2 p-3 flex items-start gap-3 transition-opacity ${
                    isHighlighted ? 'opacity-100' : 'opacity-35'
                  }`}
                  style={{ borderColor: isHighlighted ? accent : '#222b52' }}
                >
                  <span
                    className="w-7 h-7 flex items-center justify-center font-pixel text-[11px] text-[#090a14] shrink-0 mt-0.5"
                    style={{ backgroundColor: accent }}
                  >
                    {step.num}
                  </span>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white">{step.title}</h4>
                    <p className="text-xs text-[#cfd9f7] leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
