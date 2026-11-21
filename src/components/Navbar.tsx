import { Activity, BarChart3, Cpu, GitBranch, Layers } from 'lucide-react';
import type { ReactNode } from 'react';

export type ViewId = 1 | 2 | 3 | 4 | 5;

interface NavItem {
  id: ViewId;
  shortLabel: string;
  fullLabel: string;
  icon: ReactNode;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 1,
    shortLabel: '1. REAS y Entorno',
    fullLabel: 'Vista 1: REAS y Propiedades del Entorno',
    icon: <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 2,
    shortLabel: '2. Algoritmo',
    fullLabel: 'Vista 2: Formulación, PSR y Poda Alfa-Beta',
    icon: <Cpu className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 3,
    shortLabel: '3. Simulador',
    fullLabel: 'Vista 3: Simulador Vial en Vivo',
    icon: <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 4,
    shortLabel: '4. Inspector α-β',
    fullLabel: 'Vista 4: Inspector Paso a Paso de Poda Alfa-Beta',
    icon: <GitBranch className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 5,
    shortLabel: '5. Gráficas y Benchmark',
    fullLabel: 'Vista 5: Gráficas en Tiempo Real y Benchmarks',
    icon: <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
];

interface NavbarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
  cycle: number;
  isRunning: boolean;
}

export function Navbar({ activeView, onSelectView, cycle, isRunning }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#090a14]/95 border-b-4 border-[#00f0ff] shadow-[0_4px_0_#003d47]">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 py-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#111428] border-2 border-[#00f0ff] shadow-[3px_3px_0_#004e59] flex flex-col items-center justify-center gap-0.5 shrink-0">
              <span className="w-2.5 h-2.5 bg-[#ff0055] block" />
              <span className="w-2.5 h-2.5 bg-[#ffb800] block" />
              <span className="w-2.5 h-2.5 bg-[#39ff14] block" />
            </div>
            <div>
              <h1 className="font-pixel text-xs sm:text-sm text-[#00f0ff] tracking-wide leading-snug">
                SMARTTRAFFIC LA PAZ
              </h1>
              <p className="text-xs text-[#9aa8d1] mt-0.5">
                Corredor Pérez Velasco (I1) — Acceso Autopista / Av. Montes (I2)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 border-2 font-pixel text-[10px] ${
                isRunning
                  ? 'border-[#39ff14] text-[#39ff14] bg-[#39ff14]/10'
                  : 'border-[#ffb800] text-[#ffb800] bg-[#ffb800]/10'
              }`}
            >
              {isRunning ? '● SIM EN VIVO' : '■ EN PAUSA'}
            </span>
            <span className="px-2.5 py-1 border-2 border-[#2e3866] bg-[#111428] text-[#e6edf7] font-mono-code font-bold">
              CICLO: {cycle}
            </span>
          </div>
        </div>

        <nav
          aria-label="Vistas de presentación SmartTraffic La Paz"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                title={item.fullLabel}
                onClick={() => onSelectView(item.id)}
                className="nav-item-btn flex-none px-3 py-2 text-xs font-mono-code font-bold text-[#c7d2f2] flex items-center gap-2 cursor-pointer"
              >
                {isActive && (
                  <span className="text-[#39ff14] font-pixel text-[9px]" aria-hidden="true">
                    ▶
                  </span>
                )}
                {item.icon}
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
