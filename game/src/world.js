// The flight model: plane state, rings, scoring, fuel, time and crashes.
// One clear job: advance the run one fixed step from player input, and say
// what happened (ring flown, near miss, terrain crash, fuel out, time out).

import { PLANE, RING, RUN, STEP } from './config.js';
import { hash01 } from './random.js';
import { buildTreeStand, isRunwayGround, terrainHeightAt } from './terrain.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_NEAR_MISS = 2;
export const EVENT_CRASH = 4;
export const EVENT_OUT_OF_FUEL = 8;
export const EVENT_OUT_OF_TIME = 16;
export const EVENT_LANDED = 32;
export const EVENT_OVER = EVENT_CRASH | EVENT_OUT_OF_FUEL | EVENT_OUT_OF_TIME | EVENT_LANDED;

export const PHASE_TITLE = 'title';
export const PHASE_FLYING = 'flying';
export const PHASE_OVER = 'over';

/** Ring i: a glowing target the pilot flies through. Pure function of its index. */
export function ringAt(index) {
  const z = RUN.firstRingZ + index * RUN.ringSpacing;
  const x = 55 * Math.sin(index * 1.05 + 0.4) + 15 * Math.sin(index * 0.44);
  const y = 70 + 35 * Math.sin(index * 0.91 + 1.2) + 12 * Math.sin(index * 0.37);
  const scored = hash01(index, 7) > 0.72;
  return { index, x, y, z, radius: RING.radius, passed: false, bonus: scored };
}

/** A fresh run: plane on the runway, clock and fuel full, first rings ahead. */
export function createWorld(seed) {
  return {
    seed,
    phase: PHASE_TITLE,
    trees: buildTreeStand(seed),
    plane: {
      x: PLANE.startX,
      y: PLANE.startY,
      z: PLANE.startZ,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      throttle: 0.55,
    },
    timeLeft: RUN.startTime,
    fuel: 100,
    score: 0,
    ringsFlown: 0,
    ringsSeen: 0,
    best: 0,
    crashReason: '',
    message: '',
    messageTime: 0,
    nextRingIndex: 0,
    elapsed: 0,
    flewAway: false, // true once the plane has left the airfield behind
  };
}

/** Reset a world to a fresh run without rebuilding its trees. */
export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  fresh.best = world.best;
  Object.assign(world, fresh);
  world.phase = PHASE_FLYING;
}

/** The next ring the pilot is aiming for. */
export function nextRing(world) {
  return ringAt(world.nextRingIndex);
}

/** Rings close enough ahead to draw (the next few, plus the one just passed). */
export function visibleRings(world, count) {
  const rings = [];
  const start = Math.max(0, world.nextRingIndex - 1);
  for (let index = start; index < start + count; index += 1) rings.push(ringAt(index));
  return rings;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/**
 * Advance the flight one fixed step.
 * `input` is { pitch: -1..1, roll: -1..1, throttle: -1..1, boost: boolean }.
 * Returns an event bitmask (see EVENT_* above).
 */
export function stepWorld(world, input, dt = STEP) {
  if (world.phase !== PHASE_FLYING) return EVENT_NONE;
  const plane = world.plane;
  let events = EVENT_NONE;

  // Throttle: W/S nudge it up and down; it stays where the pilot leaves it.
  plane.throttle = clamp(plane.throttle + input.throttle * 0.55 * dt, 0, 1);
  const boosting = input.boost && world.fuel > 0;
  const targetSpeed =
    PLANE.minSpeed + (PLANE.maxSpeed - PLANE.minSpeed) * plane.throttle;
  const wantedSpeed = boosting ? targetSpeed * RUN.boostMultiplier : targetSpeed;
  plane.speed += clamp(wantedSpeed - plane.speed, -26 * dt, 34 * dt);

  // Pitch and roll answer the stick at every speed; bank turns the heading.
  plane.pitch = clamp(plane.pitch + input.pitch * PLANE.pitchSpeed * dt, -PLANE.maxPitch, PLANE.maxPitch);
  plane.roll = clamp(plane.roll + input.roll * PLANE.rollSpeed * dt, -PLANE.maxRoll, PLANE.maxRoll);
  plane.heading += plane.roll * PLANE.turnRate * dt;

  // Move: forward along the heading, up and down with pitch, sinking a little
  // when the throttle is idle so a sortie always costs decisions.
  const forward = plane.speed * dt;
  plane.z += Math.cos(plane.heading) * forward;
  plane.x += Math.sin(plane.heading) * forward;
  const sink = plane.throttle < 0.12 ? 4 : 0;
  plane.y += plane.speed * Math.sin(plane.pitch) * PLANE.climbRate * dt - sink * dt;
  plane.y = clamp(plane.y, 1, PLANE.ceiling);
  if (plane.z > RUN.airfieldClearZ) world.flewAway = true;

  // Fuel burns with throttle (faster on boost) and the clock always runs.
  world.fuel -= (RUN.fuelBurn * plane.throttle + (boosting ? RUN.boostFuelBurn : 0)) * dt;
  world.timeLeft -= dt;
  world.elapsed += dt;
  if (world.messageTime > 0) world.messageTime -= dt;

  // Rings: crossing a ring's plane scores it when the plane is inside the
  // hoop, and a close pass still pays a little.
  const ring = nextRing(world);
  if (plane.z >= ring.z) {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    world.ringsSeen += 1;
    if (distance <= ring.radius) {
      world.ringsFlown += 1;
      world.score += RUN.ringScore + (ring.bonus ? 50 : 0);
      world.timeLeft += RUN.ringTimeBonus;
      world.message = ring.bonus ? 'GOLDEN RING! +150' : 'RING! +100  +8s';
      world.messageTime = 1.6;
      events |= EVENT_RING;
    } else if (distance <= ring.radius + 14) {
      world.score += RUN.nearMissScore;
      world.message = 'NEAR MISS +25';
      world.messageTime = 1.2;
      events |= EVENT_NEAR_MISS;
    }
    world.nextRingIndex += 1;
  }

  // The run ends on terrain, on empty fuel, or on an empty clock — unless
  // the plane touches down gently on the runway after leaving the airfield,
  // which lands the run instead and pays the landing bonus.
  const ground = terrainHeightAt(plane.x, plane.z);
  if (plane.y <= ground + 1.5) {
    const sinkSpeed = plane.speed * Math.sin(plane.pitch) * PLANE.climbRate - sink;
    const gentleTouchdown =
      isRunwayGround(plane.x, plane.z) &&
      world.flewAway &&
      plane.speed <= RUN.maxLandingSpeed &&
      sinkSpeed >= -RUN.maxLandingSink;
    if (gentleTouchdown) {
      world.phase = PHASE_OVER;
      world.crashReason = 'LANDED';
      world.score += RUN.landingBonus;
      world.message = `LANDED! +${RUN.landingBonus}`;
      world.messageTime = 2.5;
      return events | EVENT_LANDED;
    }
    world.phase = PHASE_OVER;
    world.crashReason = 'TERRAIN STRIKE';
    world.message = '';
    return events | EVENT_CRASH;
  }
  if (world.fuel <= 0) {
    world.fuel = 0;
    world.phase = PHASE_OVER;
    world.crashReason = 'OUT OF FUEL';
    return events | EVENT_OUT_OF_FUEL;
  }
  if (world.timeLeft <= 0) {
    world.timeLeft = 0;
    world.phase = PHASE_OVER;
    world.crashReason = 'OUT OF TIME';
    return events | EVENT_OUT_OF_TIME;
  }
  return events;
}
