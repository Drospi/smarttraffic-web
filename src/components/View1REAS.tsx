import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckSquare,
  Compass,
  Eye,
  Gauge,
  Radio,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface ReasItem {
  code: 'R' | 'E' | 'A' | 'S';
  title: string;
  subtitle: string;
  accentClass: string;
  badgeColor: string;
  icon: ReactNode;
  bullets: readonly string[];
}

const REAS_ITEMS: readonly ReasItem[] = [
  {
    code: 'R',
    title: 'Rendimiento (R)',
    subtitle: 'Medida de desempeño del agente',
    accentClass: 'pixel-panel-green',
    badgeColor: '#39ff14',
    icon: <Gauge className="w-5 h-5 text-[#39ff14]" />,
    bullets: [
      'Minimizar la espera promedio por vehículo (s/veh).',
      'Reducir la cola promedio y cola máxima en los 4 accesos.',
      'Maximizar el flujo de salida atendido por ciclo.',
      'Evitar saturación en tramos conectores R12 y R21 (> 78%).',
      'Garantizar 0 violaciones PSR y latencia de decisión < 20 ms.',
    ],
  },
  {
    code: 'E',
    title: 'Entorno (E)',
    subtitle: 'Corredor vial urbano paceño',
    accentClass: 'pixel-panel-cyan',
    badgeColor: '#00f0ff',
    icon: <Compass className="w-5 h-5 text-[#00f0ff]" />,
    bullets: [
      'Corredor acoplado: Pérez Velasco (I1) – Acceso Autopista / Av. Montes (I2).',
      '4 accesos controlados (I1-F1, I1-F2, I2-F1, I2-F2).',
      '2 tramos conectores bidireccionales R12 y R21 (capacidad máx. 24 veh c/u).',
      'Llegadas estocásticas modeladas con distribución de Poisson.',
      'Ciclo semafórico fijo de 70 s (60 s verde efectivo + 10 s transición).',
    ],
  },
  {
    code: 'A',
    title: 'Actuadores (A)',
    subtitle: 'Acciones físicas sobre los cruces',
    accentClass: 'pixel-panel-amber',
    badgeColor: '#ffb800',
    icon: <Sliders className="w-5 h-5 text-[#ffb800]" />,
    bullets: [
      'Controladores semafóricos coordinados en I1 e I2.',
      'Aplican el plan óptimo g* = (g11, g12, g21, g22) al inicio de cada ciclo.',
      'Transición obligatoria segura: 3 s amarillo + 2 s todo rojo por fase.',
      'Exclusión mutua garantizada: fases conflictivas nunca en verde simultáneo.',
    ],
  },
  {
    code: 'S',
    title: 'Sensores (S)',
    subtitle: 'Percepción y telemetría por ciclo',
    accentClass: 'pixel-panel-pink',
    badgeColor: '#ff0055',
    icon: <Radio className="w-5 h-5 text-[#ff0055]" />,
    bullets: [
      'Detectores inductivos / cámaras de conteo vehicular por acceso.',
      'Vector de colas q_t = (q11, q12, q21, q22) al cierre del ciclo.',
      'Ocupación de tramos conectores o_t = (R12, R21).',
      'Fase activa f_t, tiempo transcurrido e_t y plan vigente g_t.',
    ],
  },
];

interface EnvProperty {
  id: string;
  dimension: string;
  classification: string;
  opposite: string;
  accent: string;
  justification: string;
  impact: string;
}

const ENV_PROPERTIES: readonly EnvProperty[] = [
  {
    id: 'obs',
    dimension: 'Observabilidad',
    classification: 'Parcialmente observable',
    opposite: 'Totalmente observable',
    accent: '#ffb800',
    justification:
      'Los sensores reportan colas y ocupación por ciclo, pero pueden existir ruidos o fallos de telemetría (respaldo seguro) y no se conoce la llegada futura exacta.',
    impact: 'Exige estimación robusta y plan de respaldo válido PSR ante pérdida de lectura.',
  },
  {
    id: 'det',
    dimension: 'Determinismo',
    classification: 'Estocástico',
    opposite: 'Determinista',
    accent: '#ff0055',
    justification:
      'Las llegadas vehiculares a_i(t) siguen procesos aleatorios de Poisson con variaciones bruscas en hora pico y ráfagas.',
    impact: 'Motiva evaluar M = 8 escenarios de demanda en el nodo MAX (peor caso).',
  },
  {
    id: 'epi',
    dimension: 'Estructura Temporal',
    classification: 'Secuencial',
    opposite: 'Episódico',
    accent: '#00f0ff',
    justification:
      'El reparto de verde elegido en el ciclo t altera las colas remanentes y la ocupación de R12/R21 que condicionan los ciclos t+1, ..., t+H.',
    impact: 'Se proyecta un horizonte de H = 4 ciclos para evitar desbordamiento (spillback).',
  },
  {
    id: 'dyn',
    dimension: 'Evolución',
    classification: 'Dinámico',
    opposite: 'Estático',
    accent: '#39ff14',
    justification:
      'Los vehículos continúan arribando y desplazándose por el corredor mientras el agente calcula el siguiente plan.',
    impact: 'La poda Alfa-Beta reduce el cómputo a < 20 ms para decidir antes del cambio de ciclo.',
  },
  {
    id: 'dis',
    dimension: 'Acciones y Tiempo',
    classification: 'Discreto',
    opposite: 'Continuo',
    accent: '#00f0ff',
    justification:
      'Las decisiones se toman en instantes discretos (límite seguro de ciclo cada 70 s) con transferencias enteras Δg ∈ {-6, -3, 0, +3, +6} s.',
    impact: 'Permite búsqueda en espacio finito y verificación exacta de restricciones PSR.',
  },
  {
    id: 'agt',
    dimension: 'Número de Agentes',
    classification: 'Agente Individual (Coordinador Centralizado)',
    opposite: 'Multiagente competitivo',
    accent: '#39ff14',
    justification:
      'Un único agente inteligente coordina simultáneamente las intersecciones acopladas I1 e I2 como un solo sistema.',
    impact: 'Evita que I1 descargue tráfico sin considerar la capacidad disponible hacia I2 (R12).',
  },
];

interface UtilityStep {
  id: number;
  label: string;
  question: string;
  detail: string;
  color: string;
}

const UTILITY_FLOW: readonly UtilityStep[] = [
  {
    id: 0,
    label: '1. SENSORES',
    question: '¿Qué percibe?',
    detail: 'Lee telemetría del corredor: colas q_t, tramos R12/R21, fase f_t, tiempo e_t y plan vigente g_t.',
    color: '#ff0055',
  },
  {
    id: 1,
    label: '2. ESTADO ACTUAL',
    question: '¿Cómo es el mundo ahora?',
    detail: 'Integra el estado interno del corredor acoplado I1–I2 y detecta presión de colas o cercanía al 78% en R12/R21.',
    color: '#00f0ff',
  },
  {
    id: 2,
    label: '3. MODELO DE TRANSICIÓN',
    question: '¿Qué pasará si aplico el plan g?',
    detail: 'Simula q_i(t+1) = max(0, q_i + a_i + 0.70·link - d_i) durante H = 4 ciclos ante M = 8 muestras Poisson.',
    color: '#ffb800',
  },
  {
    id: 3,
    label: '4. FUNCIÓN DE UTILIDAD / COSTO',
    question: '¿Qué tan bajo es el peor costo?',
    detail: 'Evalúa C(p, m) combinando 50% Espera, 30% Cola Máxima y 20% Saturación; busca minimizar el peor caso W(p).',
    color: '#39ff14',
  },
  {
    id: 4,
    label: '5. PODA ALFA-BETA + PSR',
    question: '¿Qué acción segura elijo?',
    detail: 'Filtra candidatos con PSR (0 violaciones) y aplica corte α ≥ β para descartar planes subóptimos en < 20 ms.',
    color: '#00f0ff',
  },
  {
    id: 5,
    label: '6. ACTUADORES',
    question: '¿Cómo actúa en La Paz?',
    detail: 'Envía g* = (g11, g12, g21, g22) a los semáforos de Pérez Velasco (I1) y Av. Montes (I2) respetando amarillo 3 s y todo rojo 2 s.',
    color: '#39ff14',
  },
];

interface View1REASProps {
  onNextView: () => void;
}

export function View1REAS({ onNextView }: View1REASProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(ENV_PROPERTIES[0].id);
  const [activeFlowStep, setActiveFlowStep] = useState<number>(0);

  const selectedProperty =
    ENV_PROPERTIES.find((p) => p.id === selectedPropertyId) ?? ENV_PROPERTIES[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Encabezado de Diapositiva */}
      <div className="pixel-panel-cyan p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2 py-1 text-[10px] font-pixel bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff] mb-2">
            DIAPOSITIVA 01 / 05 — FUNDAMENTACIÓN DEL AGENTE
          </span>
          <h2 className="font-pixel text-sm sm:text-base text-white leading-relaxed">
            REAS, PROPIEDADES DEL ENTORNO Y AGENTE BASADO EN UTILIDAD
          </h2>
          <p className="text-xs sm:text-sm text-[#a6b4db] mt-1">
            Especificación formal del entorno de trabajo para el agente coordinador del corredor Pérez Velasco (I1) – Av. Montes (I2).
          </p>
        </div>
        <button type="button" onClick={onNextView} className="arcade-btn arcade-btn-cyan">
          SIGUIENTE: ALGORITMO
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* BLOQUE 1: TABLA / TARJETAS REAS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#39ff14]" />
          <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
            1. MODELO REAS DE SMARTTRAFFIC LA PAZ
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {REAS_ITEMS.map((item) => (
            <article key={item.code} className={`${item.accentClass} p-4 flex flex-col gap-3`}>
              <div className="flex items-center justify-between border-b-2 border-[#232c52] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 flex items-center justify-center font-pixel text-sm text-[#090a14] font-bold shrink-0"
                    style={{ backgroundColor: item.badgeColor }}
                  >
                    {item.code}
                  </span>
                  <div>
                    <h4 className="font-pixel text-[11px] text-white leading-snug">{item.title}</h4>
                    <p className="text-[11px] text-[#9aa8d1]">{item.subtitle}</p>
                  </div>
                </div>
                {item.icon}
              </div>
              <ul className="space-y-2 text-xs text-[#d7e0f7] leading-relaxed">
                {item.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 w-1.5 h-1.5 shrink-0"
                      style={{ backgroundColor: item.badgeColor }}
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      {/* BLOQUE 2: MATRIZ INTERACTIVA DE PROPIEDADES DEL ENTORNO */}
      <div className="pixel-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#242d54] pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#00f0ff]" />
            <h3 className="font-pixel text-xs sm:text-sm text-[#00f0ff]">
              2. PROPIEDADES DEL ENTORNO DE TRABAJO (FICHA INTERACTIVA)
            </h3>
          </div>
          <span className="text-[11px] text-[#9aa8d1]">
            Haz clic en cada dimensión para inspeccionar su impacto en el diseño del agente
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENV_PROPERTIES.map((prop) => {
              const active = prop.id === selectedProperty.id;
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(prop.id)}
                  className={`text-left p-3 border-2 transition-all cursor-pointer ${
                    active
                      ? 'bg-[#171d3d] shadow-[4px_4px_0_#04050a]'
                      : 'bg-[#0c0f20] border-[#263059] hover:border-[#4c5ea3]'
                  }`}
                  style={active ? { borderColor: prop.accent } : undefined}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-[#95a4cf] font-bold">
                      {prop.dimension}
                    </span>
                    <CheckSquare className="w-4 h-4 shrink-0" style={{ color: prop.accent }} />
                  </div>
                  <div className="font-pixel text-[11px] leading-snug" style={{ color: prop.accent }}>
                    {prop.classification}
                  </div>
                  <div className="text-[11px] text-[#707da6] mt-1 line-through">
                    {prop.opposite}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="lg:col-span-5 bg-[#0b0e1d] border-2 p-4 flex flex-col justify-between gap-4"
            style={{ borderColor: selectedProperty.accent }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase font-bold text-[#95a4cf]">
                  Dimensión: {selectedProperty.dimension}
                </span>
                <span
                  className="px-2 py-0.5 text-[10px] font-pixel text-[#090a14]"
                  style={{ backgroundColor: selectedProperty.accent }}
                >
                  ACTIVA
                </span>
              </div>
              <h4
                className="font-pixel text-xs sm:text-sm leading-relaxed"
                style={{ color: selectedProperty.accent }}
              >
                {selectedProperty.classification}
              </h4>
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-[#00f0ff]">
                  Justificación en SmartTraffic La Paz:
                </div>
                <p className="text-xs sm:text-sm text-[#dde6fc] leading-relaxed">
                  {selectedProperty.justification}
                </p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-[#222b52]">
                <div className="text-[11px] font-bold uppercase text-[#39ff14]">
                  Decisión arquitectónica derivada:
                </div>
                <p className="text-xs sm:text-sm text-[#c7d3f5] leading-relaxed">
                  {selectedProperty.impact}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-[#8f9ec9] bg-[#111428] border border-[#28325e] px-3 py-2">
              Clasificación Russell &amp; Norvig: Entorno <strong>parcialmente observable</strong>,{' '}
              <strong>estocástico</strong>, <strong>secuencial</strong>, <strong>dinámico</strong>,{' '}
              <strong>discreto</strong> y de <strong>agente individual centralizado</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 3: DIAGRAMA DEL AGENTE BASADO EN UTILIDAD */}
      <div className="pixel-panel-green p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#233a2a] pb-3">
          <h3 className="font-pixel text-xs sm:text-sm text-[#39ff14]">
            3. ARQUITECTURA DEL AGENTE BASADO EN UTILIDAD (FLUJO INTERACTIVO)
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFlowStep((prev) => (prev + UTILITY_FLOW.length - 1) % UTILITY_FLOW.length)}
              className="arcade-btn arcade-btn-green !py-1.5 !px-2.5 !text-[10px]"
            >
              ◀ ANT
            </button>
            <button
              type="button"
              onClick={() => setActiveFlowStep((prev) => (prev + 1) % UTILITY_FLOW.length)}
              className="arcade-btn arcade-btn-green !py-1.5 !px-2.5 !text-[10px]"
            >
              SIG ▶
            </button>
          </div>
        </div>

        {/* Flujo visual en bloques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-stretch">
          {UTILITY_FLOW.map((step, idx) => {
            const isActive = idx === activeFlowStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveFlowStep(idx)}
                className={`p-3 border-2 text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                  isActive ? 'bg-[#182140] -translate-y-0.5' : 'bg-[#0b0e1d] border-[#263059] hover:border-[#4b5ca1]'
                }`}
                style={
                  isActive
                    ? {
                        borderColor: step.color,
                        boxShadow: `4px 4px 0 #04050a, 0 0 12px ${step.color}55`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-pixel text-[9px]" style={{ color: step.color }}>
                    {step.label}
                  </span>
                  {idx < UTILITY_FLOW.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-[#5b6a9c] hidden lg:block shrink-0" />
                  )}
                </div>
                <p className="text-[11px] font-bold text-white leading-snug">{step.question}</p>
              </button>
            );
          })}
        </div>

        {/* Detalle del bloque seleccionado */}
        <div
          className="bg-[#090a14] border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderColor: UTILITY_FLOW[activeFlowStep].color }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="font-pixel text-[10px] px-2 py-0.5 text-[#090a14]"
                style={{ backgroundColor: UTILITY_FLOW[activeFlowStep].color }}
              >
                {UTILITY_FLOW[activeFlowStep].label}
              </span>
              <span className="text-xs font-bold text-white">
                {UTILITY_FLOW[activeFlowStep].question}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#d4def8] leading-relaxed">
              {UTILITY_FLOW[activeFlowStep].detail}
            </p>
          </div>
          <div className="text-[11px] font-mono-code text-[#8e9dc9] shrink-0 border-l-2 border-[#232c52] pl-3">
            Ciclo cerrado cada <strong>70 s</strong>
            <br />
            Realimentación continua del corredor
          </div>
        </div>
      </div>
    </motion.section>
  );
}
