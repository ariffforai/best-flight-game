// Keyboard and mouse input for Ring Runner Ridge.
// One clear job: turn raw key and pointer events into the { pitch, roll,
// throttle, boost } shape the flight model steps with, plus start/restart taps.

const KEY_PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const KEY_PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const KEY_ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_THROTTLE_UP = new Set(['KeyW']);
const KEY_THROTTLE_DOWN = new Set(['KeyS']);

/** A fresh input state: which keys are held, and whether a tap just happened. */
export function createInput() {
  return {
    heldKeys: new Set(),
    tapped: false,
    startPressed: false,
  };
}

/** Wire keyboard and mouse events on the page into an input state. */
export function attachInput(input, canvas) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.heldKeys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') input.startPressed = true;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    input.heldKeys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.heldKeys.clear();
  });
  canvas.addEventListener('pointerdown', () => {
    input.tapped = true;
    input.startPressed = true;
  });
}

/** Read the current stick position from the held keys. */
export function readFlightInput(input) {
  const held = (keys) => {
    for (const key of keys) if (input.heldKeys.has(key)) return true;
    return false;
  };
  // W/S pull double duty: W climbs and throttles up, S dives and throttles down.
  const pitch =
    (held(KEY_PITCH_UP) ? 1 : 0) - (held(KEY_PITCH_DOWN) ? 1 : 0);
  const roll =
    (held(KEY_ROLL_RIGHT) ? 1 : 0) - (held(KEY_ROLL_LEFT) ? 1 : 0);
  const throttle =
    (held(KEY_THROTTLE_UP) ? 1 : 0) - (held(KEY_THROTTLE_DOWN) ? 1 : 0);
  return {
    pitch,
    roll,
    throttle,
    boost: input.heldKeys.has('Space'),
  };
}

/** True once when the player taps to start or restart; consumes the tap. */
export function consumeStartPress(input) {
  const pressed = input.startPressed || input.tapped;
  input.startPressed = false;
  input.tapped = false;
  return pressed;
}
