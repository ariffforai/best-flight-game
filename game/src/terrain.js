// The valley itself: terrain height, the winding river, the runway strip and
// the trees. Everything here is a pure function of (x, z) and the fixed
// terrain phases, so the same valley renders identically every run.

import { WORLD } from './config.js';
import { mulberry32, smoothstep } from './random.js';

/** Centreline of the river as it winds down the valley. */
export function riverCentreX(z) {
  return 62 * Math.sin(z * 0.0038) + 34 * Math.sin(z * 0.0013 + 1.7);
}

/** Rolling valley floor: gentle undulation, never higher than a few units. */
function valleyFloor(x, z) {
  return (
    3.2 * Math.sin(x * 0.021 + z * 0.011) +
    2.1 * Math.sin(x * 0.047 - z * 0.017 + 2.0) +
    1.4 * Math.sin(z * 0.03 + 0.6)
  );
}

/** Mountain ridge height: flat in the valley, rising steeply past the ridge line. */
function ridgeHeight(x, z) {
  const side = smoothstep(WORLD.ridgeStart, WORLD.valleyHalfWidth, Math.abs(x));
  if (side <= 0) return 0;
  const crest =
    58 +
    42 * Math.sin(z * 0.004 + Math.abs(x) * 0.02) +
    24 * Math.sin(z * 0.008 - Math.abs(x) * 0.035 + 1.3) +
    8 * Math.sin(x * 0.05 + z * 0.002);
  return side * Math.max(8, crest);
}

/** Ground height at a world point. The runway strip is graded flat. */
export function terrainHeightAt(x, z) {
  let height = valleyFloor(x, z) + ridgeHeight(x, z);
  if (isRunwayGround(x, z)) height = 0;
  // The river cuts a shallow channel through the valley floor.
  const riverDistance = Math.abs(x - riverCentreX(z));
  if (riverDistance < 14 && Math.abs(x) < WORLD.ridgeStart) {
    height -= 2.2 * (1 - riverDistance / 14);
  }
  return height;
}

/** True when (x, z) lies on the graded runway strip near the start. */
export function isRunwayGround(x, z) {
  return z >= -40 && z <= 520 && Math.abs(x - (-40)) < 13;
}

/** True when (x, z) is water: inside the river channel. */
export function isRiverWater(x, z) {
  return Math.abs(x - riverCentreX(z)) < 9 && Math.abs(x) < WORLD.ridgeStart;
}

/**
 * A fixed stand of trees for one run: 520 trees scattered over the valley
 * floor ahead of the start, each placed by the seeded RNG so the stand is
 * identical on every run with the same seed.
 */
export function buildTreeStand(seed) {
  const random = mulberry32(seed);
  const trees = [];
  for (let index = 0; index < 520; index += 1) {
    const z = 60 + random() * 5200;
    const x = (random() * 2 - 1) * (WORLD.ridgeStart - 18);
    if (isRunwayGround(x, z) || isRiverWater(x, z)) continue;
    trees.push({ x, z, y: terrainHeightAt(x, z), size: 5 + random() * 7 });
  }
  return trees;
}
