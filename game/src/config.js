// Ring Runner Ridge — shared tuning numbers for the whole game.
// One clear job: every magic number lives here, so the flight feel can be
// tuned in one place and the other files only read named constants.
export const GAME_TITLE = 'RING RUNNER RIDGE';

export const STEP = 1 / 60;

export const PLANE = {
  maxSpeed: 95, // world units per second at full throttle
  minSpeed: 18, // stall-ish floor: the plane never hangs still in the air
  climbRate: 0.55, // how much of forward speed becomes climb at full pitch
  pitchSpeed: 1.5, // radians per second of pitch change
  rollSpeed: 3.0, // radians per second of bank change
  turnRate: 0.7, // heading change per second at full bank
  maxPitch: 0.6,
  maxRoll: 1.1,
  startX: -40, // over the runway centreline
  startY: 26,
  startZ: 0,
  ceiling: 260,
};

export const RUN = {
  startTime: 150, // seconds on the clock when a run begins
  ringTimeBonus: 8, // seconds added for each ring flown through
  ringScore: 100,
  nearMissScore: 25,
  landingBonus: 500, // scored for landing back on the runway strip
  maxLandingSpeed: 60, // above this, touching the runway is a crash, not a landing
  maxLandingSink: 10, // descending faster than this (units/s) is a crash, not a landing
  airfieldClearZ: 700, // must have flown past this z before a landing counts
  lowFuelThreshold: 20, // fuel percent below which the low-fuel warning fires
  fuelBurn: 0.55, // fuel percent per second at full throttle
  boostFuelBurn: 2.2, // extra fuel percent per second while boosting
  boostMultiplier: 1.5,
  ringSpacing: 300, // world units between rings
  firstRingZ: 320,
};

export const WORLD = {
  valleyHalfWidth: 210, // the flat-ish valley floor, |x| below this
  ridgeStart: 130, // mountains begin rising past this |x|
  ridgeHeight: 150,
  farDepth: 1500, // how far ahead the terrain renderer draws
  focal: 0.9, // projection focal length, as a fraction of screen height
  horizonFraction: 0.42, // horizon line height as a fraction of screen height
};

export const RING = {
  radius: 17,
  glow: 26,
};

export const COLORS = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#cfe4f2',
  sun: '#fff3c4',
  grassLow: '#4d8a3f',
  grassHigh: '#6da24e',
  rock: '#7d7468',
  snow: '#eef3f6',
  river: '#3f8fd2',
  riverDeep: '#2b6ea8',
  runway: '#3c3f45',
  runwayLine: '#f2f2e8',
  tree: '#2c5c2a',
  treeLight: '#3f7a33',
  ring: '#ffd23f',
  ringCore: '#fff6c9',
  hudPanel: 'rgba(8, 18, 30, 0.62)',
  hudText: '#eaf6ff',
  hudAmber: '#ffc93f',
  hudGreen: '#7dff9a',
  hudRed: '#ff6b5e',
};
