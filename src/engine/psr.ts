import type { SignalPlan } from './types';

export const PSR_BOUNDS = {
  EFFECTIVE_GREEN_SUM: 60,
  G1_MIN: 20,
  G1_MAX: 44,
  G2_MIN: 16,
  G2_MAX: 40,
  CYCLE_LENGTH: 70,
  YELLOW_TIME: 2,
  ALL_RED_TIME: 3,
} as const;

export interface PSRValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validador del Problema de Satisfacción de Restricciones PSR = (X, D, C)
 * Variables: X = {g11, g12, g21, g22}
 * Dominios:  g_{k,1} ∈ [20, 44] s, g_{k,2} ∈ [16, 40] s
 * Restricciones fuertes: g11 + g12 = 60, g21 + g22 = 60, enteros no negativos, fases exclusivas.
 */
export function validatePSR(plan: SignalPlan): PSRValidationResult {
  const violations: string[] = [];

  if (!Number.isInteger(plan.g11) || !Number.isInteger(plan.g12)) {
    violations.push('Cruce Av. 20 de Octubre y Pedro Salazar (I1) debe tener segundos enteros.');
  }
  if (!Number.isInteger(plan.g21) || !Number.isInteger(plan.g22)) {
    violations.push('Cruce Av. 6 de Agosto y Pedro Salazar (I2) debe tener segundos enteros.');
  }

  if (plan.g11 < PSR_BOUNDS.G1_MIN || plan.g11 > PSR_BOUNDS.G1_MAX) {
    violations.push(
      `C. Pedro Salazar en I1 (${plan.g11} s) debe estar entre ${PSR_BOUNDS.G1_MIN} y ${PSR_BOUNDS.G1_MAX} segundos.`
    );
  }
  if (plan.g12 < PSR_BOUNDS.G2_MIN || plan.g12 > PSR_BOUNDS.G2_MAX) {
    violations.push(
      `Av. 20 de Octubre en I1 (${plan.g12} s) debe estar entre ${PSR_BOUNDS.G2_MIN} y ${PSR_BOUNDS.G2_MAX} segundos.`
    );
  }
  if (plan.g21 < PSR_BOUNDS.G1_MIN || plan.g21 > PSR_BOUNDS.G1_MAX) {
    violations.push(
      `C. Pedro Salazar / Belisario Salinas en I2 (${plan.g21} s) debe estar entre ${PSR_BOUNDS.G1_MIN} y ${PSR_BOUNDS.G1_MAX} segundos.`
    );
  }
  if (plan.g22 < PSR_BOUNDS.G2_MIN || plan.g22 > PSR_BOUNDS.G2_MAX) {
    violations.push(
      `Av. 6 de Agosto en I2 (${plan.g22} s) debe estar entre ${PSR_BOUNDS.G2_MIN} y ${PSR_BOUNDS.G2_MAX} segundos.`
    );
  }

  if (plan.g11 + plan.g12 !== PSR_BOUNDS.EFFECTIVE_GREEN_SUM) {
    violations.push(
      `En Av. 20 de Octubre / Pedro Salazar los verdes suman ${plan.g11 + plan.g12} s, pero deben sumar exactamente ${PSR_BOUNDS.EFFECTIVE_GREEN_SUM} segundos.`
    );
  }
  if (plan.g21 + plan.g22 !== PSR_BOUNDS.EFFECTIVE_GREEN_SUM) {
    violations.push(
      `En Av. 6 de Agosto / Pedro Salazar los verdes suman ${plan.g21 + plan.g22} s, pero deben sumar exactamente ${PSR_BOUNDS.EFFECTIVE_GREEN_SUM} segundos.`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Ajusta cualquier par (g11, g21) al dominio válido PSR garantizando suma = 60s.
 */
export function clampPlanToPSR(g11Raw: number, g21Raw: number): SignalPlan {
  const g11 = Math.max(PSR_BOUNDS.G1_MIN, Math.min(PSR_BOUNDS.G1_MAX, Math.round(g11Raw)));
  const g21 = Math.max(PSR_BOUNDS.G1_MIN, Math.min(PSR_BOUNDS.G1_MAX, Math.round(g21Raw)));
  return {
    g11,
    g12: PSR_BOUNDS.EFFECTIVE_GREEN_SUM - g11,
    g21,
    g22: PSR_BOUNDS.EFFECTIVE_GREEN_SUM - g21,
  };
}

/**
 * Permite configurar el semáforo convencional en segundos exactos (respetando suma = 60s y mínimo 5s por fase).
 */
export function clampConventionalPlan(g11Raw: number, g21Raw: number): SignalPlan {
  const g11 = Math.max(10, Math.min(50, Math.round(g11Raw)));
  const g21 = Math.max(10, Math.min(50, Math.round(g21Raw)));
  return {
    g11,
    g12: PSR_BOUNDS.EFFECTIVE_GREEN_SUM - g11,
    g21,
    g22: PSR_BOUNDS.EFFECTIVE_GREEN_SUM - g21,
  };
}

export function planKey(plan: SignalPlan): string {
  return `${plan.g11}-${plan.g12}-${plan.g21}-${plan.g22}`;
}

export function formatPlanShort(plan: SignalPlan): string {
  return `(${plan.g11},${plan.g12} | ${plan.g21},${plan.g22})`;
}
