/**
 * Generador PRNG determinista (Mulberry32) y muestreador de Poisson
 * para garantizar comparaciones 100% pareadas y reproducibles.
 */
export interface SeededRng {
  next(): number;
  nextInt(min: number, max: number): number;
  poisson(lambda: number): number;
  clone(): SeededRng;
}

export function createSeededRng(initialSeed: number): SeededRng {
  let state = initialSeed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const nextInt = (min: number, max: number): number => {
    return min + Math.floor(next() * (max - min + 1));
  };

  const poisson = (lambda: number): number => {
    if (lambda <= 0) return 0;
    // Algoritmo de Knuth para lambdas pequeños/medios; aproximación normal-Poisson para lambdas muy grandes
    if (lambda > 30) {
      const u1 = Math.max(1e-10, next());
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
    }
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= next();
    } while (p > L);
    return k - 1;
  };

  const clone = (): SeededRng => createSeededRng(state);

  return { next, nextInt, poisson, clone };
}
