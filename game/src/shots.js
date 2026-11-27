// The screenshot scenes behind ?shot=cover|low|valley|end|landed. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (aim at the next ring, hold a safe altitude, keep the
// throttle up), so the frame is what a short game really looks like and the
// same seed always gives the same frame.

import { STEP } from './config.js';
import { terrainHeightAt } from './terrain.js';
import {
  EVENT_OVER,
  nextRing,
  PHASE_FLYING,
  resetWorld,
  stepWorld,
} from './world.js';

const COVER_SECONDS = 24;
const LOW_SECONDS = 3.5;
const VALLEY_SECONDS = 46;
const END_GOOD_SECONDS = 22;
const END_DIVE_LIMIT_SECONDS = 30;
const LANDED_OUTBOUND_SECONDS = 14;
const LANDED_APPROACH_LIMIT_SECONDS = 75;

/** Runway touchdown point the landing approach aims for (mid-strip). */
const LANDING_TARGET = { x: -40, z: 220 };

/** How far ahead, in seconds, the autopilot plans its next move. */
const HORIZON_GOOD = 0.9;

/**
 * The autopilot's stick for one step: steer the plane toward the next ring
 * by aiming the heading at it (proportional bank, so it never overshoots
 * into the ridges), hold a safe altitude above the ground ahead, and keep
 * the throttle up. A short horizon makes a hurried pilot that reacts late
 * and cuts its safety margin — that is what the end scene uses.
 */
function autopilot(world, horizon) {
  const plane = world.plane;
  const ring = nextRing(world);
  const groundAhead = terrainHeightAt(plane.x, plane.z + plane.speed * horizon);
  const margin = horizon > 0.5 ? 26 : 8;
  const safeAltitude = groundAhead + margin;
  const desiredAltitude = Math.max(ring.y, safeAltitude);
  const pitch = Math.max(-1, Math.min(1, (desiredAltitude - plane.y) * 0.08 - plane.pitch * 1.2));
  const desiredHeading = Math.atan2(ring.x - plane.x, ring.z - plane.z);
  let headingError = desiredHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const gain = horizon > 0.5 ? 2.5 : 0.7;
  const roll = Math.max(-1, Math.min(1, headingError * gain - plane.roll * 2.0));
  return { pitch, roll, throttle: 1, boost: false };
}

/**
 * Step the world forward with the autopilot until the scene's time is up or
 * the run ends, then return the phase to draw over the frozen world.
 */
function flyForward(world, seconds, horizon) {
  world.phase = PHASE_FLYING;
  for (let index = 0; index < seconds / STEP; index += 1) {
    if (stepWorld(world, autopilot(world, horizon), STEP) & EVENT_OVER) break;
  }
  return world.phase;
}

/**
 * The landing approach stick: turn back toward the runway, slow down, and
 * descend on a shallow profile to the touchdown point — high and fast far
 * out, low and slow over the strip, nose level for the final few units so
 * the wheels meet the runway gently instead of striking the ground.
 */
function landingAutopilot(world) {
  const plane = world.plane;
  const dx = LANDING_TARGET.x - plane.x;
  const dz = LANDING_TARGET.z - plane.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  // Ground ahead along the direction of travel, not just down the valley:
  // the 180-degree turn swings the plane sideways, where the ridges rise.
  const groundAhead = terrainHeightAt(
    plane.x + Math.sin(plane.heading) * plane.speed * 1.2,
    plane.z + Math.cos(plane.heading) * plane.speed * 1.2,
  );
  // Climb high and slow for the turn, then a shallow stepped descent that
  // only reaches the ground once lined up over the strip.
  const profile = distance > 600 ? 75 : distance > 300 ? 45 : distance > 120 ? 18 : distance > 40 ? 6 : 0;
  const margin = distance > 300 ? 20 : distance > 120 ? 10 : distance > 40 ? 4 : 0;
  const desiredAltitude = Math.max(profile, groundAhead + margin);
  const pitch = Math.max(-1, Math.min(1, (desiredAltitude - plane.y) * 0.08 - plane.pitch * 1.2));
  const desiredHeading = Math.atan2(dx, dz);
  let headingError = desiredHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, headingError * 2.5 - plane.roll * 2.0));
  const desiredThrottle = distance > 600 ? 0.15 : distance > 150 ? 0.55 : 0.2;
  const throttle = Math.max(-1, Math.min(1, (desiredThrottle - plane.throttle) * 4));
  return { pitch, roll, throttle, boost: false };
}

/**
 * Set `world` to the named scene (cover, low, valley, end or landed; any
 * other name is cover) and return the view to render it with ('chase' or
 * 'cockpit').
 */
export function stageShot(name, world) {
  resetWorld(world);
  if (name === 'landed') {
    // Fly out past the airfield, turn around, and land back on the runway —
    // the run ends on the LANDED screen with the +500 bonus.
    flyForward(world, LANDED_OUTBOUND_SECONDS, HORIZON_GOOD);
    world.phase = PHASE_FLYING;
    for (let index = 0; index < LANDED_APPROACH_LIMIT_SECONDS / STEP; index += 1) {
      if (stepWorld(world, landingAutopilot(world), STEP) & EVENT_OVER) break;
    }
    return { view: 'chase', phase: world.phase };
  }
  if (name === 'low') {
    // Cockpit view just after takeoff: the runway still in sight ahead.
    flyForward(world, LOW_SECONDS, HORIZON_GOOD);
    return { view: 'cockpit', phase: world.phase };
  }
  if (name === 'valley') {
    // High over the valley, deep into the course, river and ridges below.
    flyForward(world, VALLEY_SECONDS, HORIZON_GOOD);
    return { view: 'chase', phase: world.phase };
  }
  if (name === 'end') {
    // A good start, then a panicked dive: throttle idle, nose down, straight
    // into the valley floor — the run ends on the game-over screen.
    flyForward(world, END_GOOD_SECONDS, HORIZON_GOOD);
    world.phase = PHASE_FLYING;
    for (let index = 0; index < END_DIVE_LIMIT_SECONDS / STEP; index += 1) {
      if (stepWorld(world, { pitch: -1, roll: 0, throttle: -1, boost: false }, STEP) & EVENT_OVER) break;
    }
    return { view: 'chase', phase: world.phase };
  }
  // Cover: peak gameplay — chase view, a glowing ring dead ahead, HUD lit.
  flyForward(world, COVER_SECONDS, HORIZON_GOOD);
  return { view: 'chase', phase: world.phase };
}
