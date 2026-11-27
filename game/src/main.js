// Ring Runner Ridge — entry point. Runs the game loop, switches between the
// title, flying and game-over phases, and freezes a deterministic screenshot
// scene when the page is opened with ?shot=cover|low|valley|end&seed=1.

import { GAME_TITLE, RUN, STEP } from './config.js';
import { attachInput, consumeStartPress, createInput, readFlightInput } from './input.js';
import { renderGame } from './render.js';
import { stageShot } from './shots.js';
import { createSound, playCrashThud, playLandingFanfare, playLowFuelWarning, playNearMissTick, playRingChime, unlockSound } from './audio.js';
import {
  createWorld,
  EVENT_CRASH,
  EVENT_LANDED,
  EVENT_NEAR_MISS,
  EVENT_OUT_OF_FUEL,
  EVENT_OUT_OF_TIME,
  EVENT_RING,
  PHASE_FLYING,
  PHASE_OVER,
  PHASE_TITLE,
  resetWorld,
  stepWorld,
} from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shotName = params.get('shot');

const world = createWorld(seed);
const input = createInput();
const sound = createSound();
attachInput(input, canvas);

let view = 'chase';
let lastTime = performance.now();
let accumulator = 0;
let lastFuelBeepAt = -10; // run time of the last low-fuel beep, in seconds

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function announceStatus() {
  const plane = world.plane;
  statusLine.textContent =
    `${GAME_TITLE}: score ${world.score}, rings ${world.ringsFlown}, ` +
    `altitude ${Math.round(plane.y * 32)} feet, speed ${Math.round(plane.speed * 2.1)} knots, ` +
    `fuel ${Math.round(world.fuel)} percent, ${Math.ceil(world.timeLeft)} seconds left.`;
}

function handleEvents(events) {
  if (events & EVENT_RING) playRingChime(sound);
  if (events & EVENT_NEAR_MISS) playNearMissTick(sound);
  if (events & EVENT_LANDED) {
    playLandingFanfare(sound);
    world.best = Math.max(world.best, world.score);
  }
  if (events & (EVENT_CRASH | EVENT_OUT_OF_FUEL | EVENT_OUT_OF_TIME)) {
    playCrashThud(sound);
    world.best = Math.max(world.best, world.score);
  }
}

function startRun() {
  unlockSound(sound);
  resetWorld(world);
  view = 'chase';
}

function gameFrame(now) {
  const frameTime = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameTime;
  if (consumeStartPress(input)) {
    if (world.phase === PHASE_TITLE || world.phase === PHASE_OVER) startRun();
    else view = view === 'chase' ? 'cockpit' : 'chase';
  }
  if (world.phase === PHASE_FLYING) {
    while (accumulator >= STEP) {
      handleEvents(stepWorld(world, readFlightInput(input), STEP));
      accumulator -= STEP;
    }
    // Low-fuel alarm: a beep every few seconds while the tank is in the red.
    if (world.fuel < RUN.lowFuelThreshold && world.elapsed - lastFuelBeepAt >= 2.5) {
      playLowFuelWarning(sound);
      lastFuelBeepAt = world.elapsed;
    }
  } else {
    accumulator = 0;
  }
  renderGame(ctx, world, view, canvas.width, canvas.height);
  announceStatus();
  requestAnimationFrame(gameFrame);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

if (shotName !== null) {
  // Screenshot mode: freeze the staged scene and draw it once, no loop.
  const staged = stageShot(shotName, world);
  view = staged.view;
  world.best = world.score;
  renderGame(ctx, world, view, canvas.width, canvas.height);
  announceStatus();
} else {
  world.phase = PHASE_TITLE;
  requestAnimationFrame(gameFrame);
}
