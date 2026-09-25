/**
 * Physics-Informed Drone Digital Twin - AI Voice Co-Pilot Assistant
 * 
 * Features:
 * - Natural Indian Female Voice selection (Microsoft Neerja / Heera / Aditi / en-IN female)
 * - Zero-lag, 100% offline browser speech synthesis (NO API keys or external services required)
 * - Dedicated flight phase announcements (Takeoff, Hover ceiling, Route forward, Hold, RTB, Touchdown)
 * - Autonomous decision support voice guidance for all 6 problem statement conditions:
 *   1. CONTINUE SAFELY
 *   2. MODIFY TRAJECTORY
 *   3. REDUCE SPEED (SLOW DOWN)
 *   4. ALTER ALTITUDE (CHANGE ALTITUDE)
 *   5. RETURN TO BASE
 *   6. MISSION ABORT
 * - Smart anti-repetition cooldown & debounce to prevent audio overlap
 * - UI subscription for live soundwave visualizer & mute controls
 */

class VoiceAssistant {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.selectedVoice = null;
    this.isMuted = false;
    this.speakingText = '';
    this.listeners = new Set();
    this.lastDecisionSpoken = '';
    this.lastDecisionTime = 0;
    this.lastEnvSpoken = '';
    this.lastEnvTime = 0;
    this.hasAnnouncedHoverForCurrentTakeoff = false;
    this.hasAnnouncedTouchdown = false;

    if (this.synth) {
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  initVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return;

    // 1. Highest priority: Indian English Female voice (Neerja, Heera, Aditi, Raveena, etc.)
    const indianFemale = voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      const isIndian = lang.includes('en-in') || lang.includes('hi-in') || name.includes('india');
      const isFemale = name.includes('neerja') || name.includes('heera') || name.includes('aditi') || 
                       name.includes('raveena') || name.includes('female') || name.includes('natural');
      return isIndian && isFemale;
    });

    // 2. Second priority: Any Indian English voice
    const anyIndian = voices.find(v => {
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      return lang.includes('en-in') || name.includes('india') || name.includes('neerja') || name.includes('heera');
    });

    // 3. Third priority: High-quality natural English female voice
    const naturalFemale = voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      return lang.startsWith('en') && (
        name.includes('natural') || name.includes('zira') || name.includes('jenny') || 
        name.includes('aria') || name.includes('samantha') || name.includes('female')
      );
    });

    // 4. Fallback: Any English voice
    const anyEnglish = voices.find(v => v.lang.toLowerCase().startsWith('en'));

    this.selectedVoice = indianFemale || anyIndian || naturalFemale || anyEnglish || voices[0];
  }

  notify(speaking, text = '') {
    this.speakingText = speaking ? text : '';
    this.listeners.forEach(fn => fn({ speaking, text: this.speakingText, isMuted: this.isMuted }));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Initial emit
    listener({ speaking: !!this.speakingText, text: this.speakingText, isMuted: this.isMuted });
    return () => this.listeners.delete(listener);
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted && this.synth) {
      this.synth.cancel();
      this.notify(false, '');
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Core speech function with zero latency
   */
  speak(text, { priority = false, rate = 1.0, pitch = 1.06 } = {}) {
    if (this.isMuted || !this.synth || !text) return;

    if (!this.selectedVoice) {
      this.initVoices();
    }

    // Cancel existing utterance if this is a priority command (e.g. user clicked a flight button)
    if (priority) {
      this.synth.cancel();
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang || 'en-IN';
      } else {
        utterance.lang = 'en-IN';
      }

      utterance.rate = rate;
      utterance.pitch = pitch;

      utterance.onstart = () => {
        this.notify(true, text);
      };

      utterance.onend = () => {
        this.notify(false, '');
      };

      utterance.onerror = () => {
        this.notify(false, '');
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
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
        // Only announce CONTINUE periodically (every 22 seconds)
        if (now - this.lastDecisionTime > 22000) {
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
