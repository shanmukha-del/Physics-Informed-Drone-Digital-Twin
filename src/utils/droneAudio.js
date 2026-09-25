/**
 * Realistic Electronic Speed Controller (ESC) & Avionics Sound Generator
 * Uses Web Audio API directly in the browser - 100% offline, zero latency, no external mp3 files.
 */

export function playDroneBootChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Classic DJI / BLHeli ESC boot chime sequence:
    // 3 short rising tones (Low, Mid, High) + 2 confirmation chimes
    const tones = [
      { freq: 523.25, start: 0.05, duration: 0.08, gain: 0.18 }, // C5
      { freq: 659.25, start: 0.15, duration: 0.08, gain: 0.20 }, // E5
      { freq: 783.99, start: 0.25, duration: 0.08, gain: 0.22 }, // G5
      { freq: 1046.50, start: 0.40, duration: 0.16, gain: 0.26 }, // C6
      { freq: 1318.51, start: 0.58, duration: 0.24, gain: 0.28 }, // E6
    ];

    tones.forEach(({ freq, start, duration, gain: maxGain }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Rich electronic harmonic tone
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(maxGain, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });

    // Close audio context after chime sequence concludes
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch (err) {
    console.warn('Drone audio generation error:', err);
  }
}
