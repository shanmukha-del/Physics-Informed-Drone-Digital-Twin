/**
 * Realistic Electronic Speed Controller (ESC) & Avionics Sound Generator
 * Uses Web Audio API directly in the browser - 100% offline, zero latency, no external mp3 files.
 */

// Global single audio context to prevent multiple context creations
let sharedAudioCtx = null;

function getSharedAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Automatically resume/unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudioCtx = () => {
    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (_) {}
    ['click', 'touchstart', 'keydown'].forEach(e => window.removeEventListener(e, unlockAudioCtx));
  };
  ['click', 'touchstart', 'keydown'].forEach(e => window.addEventListener(e, unlockAudioCtx, { once: true, passive: true }));
}

/**
 * Play authentic DJI / BLHeli electronic ESC boot chime sequence
 */
export function playDroneBootChime() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const tones = [
      { freq: 523.25, start: 0.05, duration: 0.08, gain: 0.22 }, // C5
      { freq: 659.25, start: 0.15, duration: 0.08, gain: 0.24 }, // E5
      { freq: 783.99, start: 0.25, duration: 0.08, gain: 0.26 }, // G5
      { freq: 1046.50, start: 0.40, duration: 0.16, gain: 0.28 }, // C6
      { freq: 1318.51, start: 0.58, duration: 0.26, gain: 0.30 }, // E6
    ];

    tones.forEach(({ freq, start, duration, gain: maxGain }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(maxGain, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.warn('Drone audio generation error:', err);
  }
}

/**
 * Play subtle avionics cockpit radio transmission chirp/click
 */
export function playAvionicsChirp() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (_) {}
}
