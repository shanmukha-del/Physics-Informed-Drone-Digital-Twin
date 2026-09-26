/**
 * Physics-Informed Drone Digital Twin - AI Voice Co-Pilot Assistant
 * 
 * Features:
 * - Natural Indian Female Voice selection (Microsoft Neerja / Heera / Aditi / en-IN female)
 *   with graceful fallback to high-quality system female/English voices (Zira, Jenny, etc.)
 * - Zero-lag, 100% offline browser speech synthesis (NO external API keys required)
 * - Anti-Chromium bug guards:
 *   1. Utterance Keep-Alive reference (prevents V8 garbage collection mid-speech)
 *   2. Synth resume heartbeat (prevents Chromium 14-second pause bug)
 *   3. Asynchronous cancel buffer (prevents cancel/speak race conditions)
 *   4. First user gesture auto-unlock (bypasses browser autoplay restrictions)
 *   5. Web Audio cockpit avionics chirp cue
 * - Dedicated flight phase announcements (Power on, Takeoff, Hover ceiling, Route forward, Hold, RTB, Touchdown)
 * - Autonomous decision support voice guidance for all 6 problem statement conditions
 */

import { playAvionicsChirp } from './droneAudio';

class VoiceAssistant {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.selectedVoice = null;
    this.availableVoices = [];
    this.isMuted = false;
    this.speakingText = '';
    this.listeners = new Set();
    this.lastDecisionSpoken = '';
    this.lastDecisionTime = 0;
    this.lastEnvSpoken = '';
    this.lastEnvTime = 0;
    this.hasAnnouncedHoverForCurrentTakeoff = false;
    this.hasAnnouncedTouchdown = false;
    
    // Prevent Chromium garbage collection
    this.activeUtterances = new Set();
    if (typeof window !== 'undefined') {
      window.__activeUtterances = this.activeUtterances;
    }

    if (this.synth) {
      this.initVoices();

      // Listen via both event listener and property
      if (typeof this.synth.addEventListener === 'function') {
        this.synth.addEventListener('voiceschanged', () => this.initVoices());
      }
      this.synth.onvoiceschanged = () => this.initVoices();

      // Poll periodically for first 4 seconds in case voices load asynchronously without event
      let attempts = 0;
      const pollTimer = setInterval(() => {
        attempts++;
        if (this.selectedVoice || attempts > 16) {
          clearInterval(pollTimer);
        } else {
          this.initVoices();
        }
      }, 250);

      // Auto-unlock speech synthesis on first user interaction anywhere
      this.setupUserUnlock();
    }
  }

  setupUserUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      try {
        if (this.synth) {
          if (this.synth.paused) {
            this.synth.resume();
          }
          // Warm up speech synthesis engine with an empty utterance
          const dummy = new SpeechSynthesisUtterance('');
          dummy.volume = 0;
          this.synth.speak(dummy);
        }
      } catch (_) {}

      ['click', 'touchstart', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, unlock);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  initVoices() {
    if (!this.synth) return;
    try {
      const voices = this.synth.getVoices() || [];
      if (voices.length === 0) return;
      this.availableVoices = voices;

      // 1. Highest priority: Indian English Female voice (Neerja, Heera, Aditi, Raveena, Kavya, etc.)
      const indianFemale = voices.find(v => {
        const name = (v.name || '').toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        const isIndian = lang.includes('en-in') || lang.includes('hi-in') || name.includes('india');
        const isFemale = name.includes('neerja') || name.includes('heera') || name.includes('aditi') ||
                         name.includes('raveena') || name.includes('kavya') || name.includes('swara') ||
                         name.includes('female') || name.includes('natural');
        return isIndian && isFemale;
      });

      // 2. Second priority: Any Indian English voice
      const anyIndian = voices.find(v => {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return lang.includes('en-in') || lang.includes('hi-in') || name.includes('india') ||
               name.includes('neerja') || name.includes('heera') || name.includes('aditi') || name.includes('prabhat');
      });

      // 3. Third priority: High-quality natural English female voice (Zira, Jenny, Aria, Samantha, etc.)
      const naturalFemale = voices.find(v => {
        const name = (v.name || '').toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        const isEnglish = lang.startsWith('en');
        const isFemale = name.includes('natural') || name.includes('zira') || name.includes('jenny') ||
                         name.includes('aria') || name.includes('samantha') || name.includes('victoria') ||
                         name.includes('karen') || name.includes('female');
        return isEnglish && isFemale;
      });

      // 4. Fourth priority: Any English voice
      const anyEnglish = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));

      // 5. Fallback: System default or first available
      const defaultVoice = voices.find(v => v.default) || voices[0];

      this.selectedVoice = indianFemale || anyIndian || naturalFemale || anyEnglish || defaultVoice;
      this.notify(!!this.speakingText, this.speakingText);
    } catch (err) {
      console.warn('[VoiceAssistant] Voice initialization error:', err);
    }
  }

  getVoiceDisplayName() {
    if (!this.selectedVoice) return 'Detecting voices...';
    const name = this.selectedVoice.name || '';
    if (name.toLowerCase().includes('neerja')) return 'Neerja (Indian Female)';
    if (name.toLowerCase().includes('heera')) return 'Heera (Indian Female)';
    if (name.toLowerCase().includes('aditi')) return 'Aditi (Indian Female)';
    if (this.selectedVoice.lang?.toLowerCase().includes('en-in')) return `${name} (en-IN)`;
    return `${name} (${this.selectedVoice.lang || 'en'})`;
  }

  notify(speaking, text = '') {
    this.speakingText = speaking ? text : '';
    const payload = {
      speaking,
      text: this.speakingText,
      isMuted: this.isMuted,
      voiceName: this.getVoiceDisplayName(),
      hasVoices: (this.availableVoices && this.availableVoices.length > 0)
    };
    this.listeners.forEach(fn => {
      try { fn(payload); } catch (_) {}
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Initial emit
    listener({
      speaking: !!this.speakingText,
      text: this.speakingText,
      isMuted: this.isMuted,
      voiceName: this.getVoiceDisplayName(),
      hasVoices: (this.availableVoices && this.availableVoices.length > 0)
    });
    return () => this.listeners.delete(listener);
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted && this.synth) {
      try { this.synth.cancel(); } catch (_) {}
      this.notify(false, '');
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Core speech function with Chromium anti-bug guards
   */
  speak(text, { priority = false, rate = 1.0, pitch = 1.05 } = {}) {
    if (this.isMuted || !this.synth || !text) return;

    // Play subtle avionics cockpit chirp for instant audible cue
    playAvionicsChirp();

    if (!this.selectedVoice || this.availableVoices.length === 0) {
      this.initVoices();
    }

    // Always unpause if Chromium paused the synthesizer
    if (this.synth.paused) {
      try { this.synth.resume(); } catch (_) {}
    }

    // Handle priority by canceling previous speech with a 50ms buffer to prevent race conditions
    if (priority) {
      try { this.synth.cancel(); } catch (_) {}
      setTimeout(() => this._executeSpeak(text, rate, pitch), 50);
    } else {
      this._executeSpeak(text, rate, pitch);
    }
  }

  _executeSpeak(text, rate, pitch) {
    try {
      if (this.synth.paused) {
        this.synth.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang || 'en-US';
      } else {
        utterance.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';
      }

      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1.0;

      // Keep utterance in memory to avoid garbage collection
      this.activeUtterances.add(utterance);

      utterance.onstart = () => {
        this.notify(true, text);

        // Chromium heartbeat: periodic resume to prevent 14s auto-pause bug
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (!this.synth || !this.synth.speaking) {
            clearInterval(this.heartbeat);
          } else if (this.synth.paused) {
            this.synth.resume();
          }
        }, 3000);
      };

      utterance.onend = () => {
        this.activeUtterances.delete(utterance);
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.notify(false, '');
      };

      utterance.onerror = (e) => {
        this.activeUtterances.delete(utterance);
        if (this.heartbeat) clearInterval(this.heartbeat);
        if (e.error !== 'canceled') {
          console.warn('[VoiceAssistant] Speech error:', e.error);
        }
        this.notify(false, '');
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('[VoiceAssistant] Speech synthesis failed:', err);
      this.notify(false, '');
    }
  }

  /* ---------------- User Command Announcements ---------------- */

  /** 0. Power On Drone clicked */
  announcePowerOn(battery = 100, canCover = true, margin = 28, checkpointCount = 4) {
    this.hasAnnouncedHoverForCurrentTakeoff = false;
    this.hasAnnouncedTouchdown = false;

    let message = 'Drone powered on successfully. Avionics and telemetry online. ';
    if (canCover) {
      message += `Pre-flight feasibility check passed. Current battery is at ${Math.round(battery)} percent. The planned ${checkpointCount} checkpoints can be covered with an estimated ${Math.max(15, Math.round(margin))} percent return reserve. Systems armed and ready for takeoff.`;
    } else {
      message += `Pre-flight advisory: Current battery is at ${Math.round(battery)} percent. Route energy exceeds standard reserve thresholds. Consider charging or optimizing waypoint distance.`;
    }

    this.speak(message, { priority: true });
  }

  /** 1. Takeoff button clicked */
  announceTakeoff() {
    this.hasAnnouncedHoverForCurrentTakeoff = false;
    this.hasAnnouncedTouchdown = false;
    this.speak('Drone started and taking off from the base.', { priority: true });
  }

  /** 2. Reached hover ceiling */
  announceHoverReady() {
    if (this.hasAnnouncedHoverForCurrentTakeoff) return;
    this.hasAnnouncedHoverForCurrentTakeoff = true;
    this.speak('Cruise altitude reached. Ready to move forward.', { priority: true });
  }

  /** 3. Move forward clicked */
  announceMoveForward() {
    this.speak('Moving towards user-defined route.', { priority: true });
  }

  /** 4. Stop / Hold clicked */
  announceStop() {
    this.speak('Flight paused. Drone holding position.', { priority: true });
  }

  /** 5. Return to base clicked */
  announceReturnToBase() {
    this.hasAnnouncedTouchdown = false;
    this.speak('Returning to base. Preparing for precision helipad landing.', { priority: true });
  }

  /** 6. Touchdown on helipad confirmed */
  announceTouchdown() {
    if (this.hasAnnouncedTouchdown) return;
    this.hasAnnouncedTouchdown = true;
    this.speak('Drone has safely landed on the base pad. Engines powered down.', { priority: true });
  }

  /* ---------------- Problem Statement 6 Autonomous Decisions ---------------- */

  announceDecision(decision, reason) {
    if (this.isMuted) return;
    const now = Date.now();

    // Prevent spamming identical decision within 10 seconds
    if (this.lastDecisionSpoken === decision && now - this.lastDecisionTime < 10000) {
      return;
    }

    this.lastDecisionSpoken = decision;
    this.lastDecisionTime = now;

    switch (decision) {
      case 'CONTINUE':
        // Only announce CONTINUE periodically (every 25 seconds)
        if (now - this.lastDecisionTime > 25000) {
          this.speak('Flight parameters nominal. Continuing route safely.');
        }
        break;

      case 'MODIFY TRAJECTORY':
        this.speak('High crosswind shear detected. Modifying flight trajectory to avoid turbulence.', { priority: true });
        break;

      case 'SLOW DOWN':
        this.speak('Elevated aerodynamic drag and battery heating. Reducing speed to conserve energy.', { priority: true });
        break;

      case 'CHANGE ALTITUDE':
        this.speak('Atmospheric density gradient detected. Altering altitude for optimal safety.', { priority: true });
        break;

      case 'RETURN TO BASE':
        this.speak('Safety limit reached. Autonomous Return to Base initiated.', { priority: true });
        break;

      case 'MISSION ABORT':
        this.speak('Critical safety warning. Mission aborted. Initiating immediate emergency landing.', { priority: true });
        break;

      default:
        break;
    }
  }

  /* ---------------- Environmental State Announcements ---------------- */

  announceEnvironmentDisturbance(type, detail) {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastEnvTime < 8000) return; // 8s cooldown

    this.lastEnvTime = now;
    if (type === 'WIND_GUST') {
      this.speak(`Advisory: Wind gust detected at ${detail} kilometers per hour. Stabilizing flight.`);
    } else if (type === 'BATTERY_HEAT') {
      this.speak(`Caution: Battery core temperature rising to ${detail} degrees celsius.`);
    } else if (type === 'MOTOR_WEAR') {
      this.speak('Notice: Motor efficiency degradation observed. Compensating rotor throttle.');
    }
  }
}

export const voiceAssistant = new VoiceAssistant();
