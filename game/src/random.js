// Seeded randomness for Ring Runner Ridge. The world layout (rings, trees,
// terrain phases) is a pure function of a fixed seed, so the same seed always
// builds the same valley and the screenshot poses are reproducible.

/** Mulberry32: a small deterministic PRNG from an integer seed. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 hash of one integer — used to place ring i without any RNG state. */
export function hash01(index, salt) {
  let value = (index * 374761393 + salt * 668265263) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

/** Smooth interpolation helper for the terrain's rolling hills. */
export function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
