// Tiny WebAudio sound effects for Ring Runner Ridge — beeps only, no files.
// One clear job: ring chimes, near-miss ticks and the crash thud, all
// synthesized at play time and silent until the player first interacts.

/** A fresh sound state: the audio context is built lazily on first use. */
export function createSound() {
  return { context: null, enabled: true };
}

/** Build the audio context (must happen inside a user gesture to be audible). */
export function unlockSound(sound) {
  if (sound.context !== null) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) sound.context = new AudioContext();
  } catch {
    sound.context = null;
  }
}

function playTone(sound, frequency, duration, type, volume) {
  if (!sound.enabled || sound.context === null) return;
  try {
    const oscillator = sound.context.createOscillator();
    const gain = sound.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, sound.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, sound.context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(sound.context.destination);
    oscillator.start();
    oscillator.stop(sound.context.currentTime + duration);
  } catch {
    // Sound is decoration: a failure here never stops the game.
  }
}

/** Two-note chime when the plane threads a ring. */
export function playRingChime(sound) {
  playTone(sound, 660, 0.14, 'sine', 0.12);
  setTimeout(() => playTone(sound, 990, 0.22, 'sine', 0.12), 90);
}

/** A short tick for a near miss. */
export function playNearMissTick(sound) {
  playTone(sound, 440, 0.08, 'triangle', 0.08);
}

/** A low thud when the run ends on terrain, fuel or time. */
export function playCrashThud(sound) {
  playTone(sound, 110, 0.4, 'sawtooth', 0.16);
  setTimeout(() => playTone(sound, 70, 0.5, 'sawtooth', 0.14), 120);
}

/** Two descending beeps while the fuel gauge is in the red. */
export function playLowFuelWarning(sound) {
  playTone(sound, 880, 0.1, 'square', 0.07);
  setTimeout(() => playTone(sound, 620, 0.14, 'square', 0.07), 130);
}

/** A rising three-note chime for a runway landing. */
export function playLandingFanfare(sound) {
  playTone(sound, 523, 0.16, 'sine', 0.12);
  setTimeout(() => playTone(sound, 659, 0.16, 'sine', 0.12), 140);
  setTimeout(() => playTone(sound, 784, 0.3, 'sine', 0.12), 280);
}
