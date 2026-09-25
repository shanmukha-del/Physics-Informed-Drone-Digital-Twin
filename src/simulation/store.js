import { create } from 'zustand';
import {
  initial,
  calculate,
  scenarios,
  baseMission,
  getMission,
  waypointPosition,
  validateMission,
  clampValue,
} from './model';
import { voiceAssistant } from '../utils/voiceAssistant';
import { playDroneBootChime } from '../utils/droneAudio';

const event = (s, text, severity = 'info', type = 'SIMULATION') => [
  { t: Math.round(s.elapsed * 10) / 10, type, text, severity },
  ...s.events,
].slice(0, 80);

const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

export const useTwin = create((set, get) => ({
  ...initial(),
  metrics: calculate(initial()),

  // Flight Actions
  powerOn: () => {
    const s = get();
    // 1. Play authentic electronic ESC boot chime sound
    playDroneBootChime();

    const mission = getMission(s);
    const m = calculate({ ...s, poweredOn: true });

    // 2. Pre-flight energy feasibility calculation
    const capacityWh = 115.4;
    const estimatedRequiredWh = m.estimatedEnergy || ((mission.length * 60 * 180) / 3600);
    const requiredBatteryPercent = Math.round((estimatedRequiredWh / capacityWh) * 100);
    const remainingReserve = Math.round(s.battery - requiredBatteryPercent);
    const canCover = remainingReserve >= (s.returnThreshold || 25);
    const checkpointCount = Math.max(1, mission.length - 1);

    set({
      poweredOn: true,
      events: event(
        s,
        `DRONE POWER ON · ESC chime OK · Pre-flight check: ${canCover ? 'PASSED' : 'ADVISORY'} (${Math.round(s.battery)}% SoC, ${checkpointCount} waypoints)`,
        'success',
        'SYSTEM'
      ),
    });

    // 3. Indian Female Voice Announcement after chime completes
    setTimeout(() => {
      voiceAssistant.announcePowerOn(s.battery, canCover, remainingReserve, checkpointCount);
    }, 650);
  },

  takeoff: () => {
    const s = get();
    if (!s.poweredOn) {
      get().powerOn();
      setTimeout(() => {
        get().takeoff();
      }, 3500);
      return;
    }
    voiceAssistant.announceTakeoff();
    const mission = getMission(s);
    set({
      running: true,
      ended: false,
      returning: false,
      flightMode: 'TAKEOFF',
      routeIndex: s.routeIndex >= mission.length ? 1 : Math.max(1, s.routeIndex),
      velocity: 4.5,
      events: event(s, 'TAKEOFF INITIATED · Vertical ascent to hover ceiling', 'info', 'FLIGHT'),
    });
  },

  moveForward: () => {
    const s = get();
    voiceAssistant.announceMoveForward();
    set({
      running: true,
      ended: false,
      flightMode: 'CRUISE',
      events: event(s, 'MOVE FORWARD ENGAGED · Drone navigating along waypoint corridor', 'info', 'FLIGHT'),
    });
  },

  stopFlight: () => {
    const s = get();
    voiceAssistant.announceStop();
    set({
      flightMode: 'HOLD',
      velocity: 0,
      events: event(s, 'STOP / POSITION HOLD ENGAGED · Drone hovering at current coordinates', 'warning', 'FLIGHT'),
    });
  },

  returnToBase: () => {
    const s = get();
    if (s.flightMode === 'LANDED' && s.position[1] <= 3.1) {
      set({
        events: event(s, 'Drone is already docked on helipad base', 'info', 'FLIGHT'),
      });
      return;
    }
    voiceAssistant.announceReturnToBase();
    set({
      running: true,
      ended: false,
      returning: true,
      flightMode: 'RETURNING',
      routeIndex: 0,
      trajectoryModified: false,
      bypassWaypoint: null,
      events: event(s, 'RETURN TO BASE ENGAGED · Returning to helipad for vertical descent & landing', 'critical', 'FLIGHT'),
    });
  },

  toggleDroneCam: () => set((s) => ({ droneCamOpen: !s.droneCamOpen })),
  setCamFilterMode: (camFilterMode) => set({ camFilterMode }),

  start: () => {
    const s = get();
    if (s.flightMode === 'LANDED' || !s.running) {
      get().takeoff();
    } else if (s.flightMode === 'HOVER' || s.flightMode === 'HOLD') {
      get().moveForward();
    } else if (s.flightMode === 'CRUISE') {
      get().stopFlight();
    }
  },

  setAutoScenarios: (autoScenarios) => set({ autoScenarios }),

  setScenario: (name) => {
    const v = scenarios[name];
    if (!v) return;
    set((s) => {
      const next = { ...s, ...v, scenario: name, autoScenarios: false };
      const m = calculate(next);
      return {
        ...next,
        metrics: m,
        events: event(
          s,
          `Manual Scenario: ${name} · PINN state recalculated`,
          name.includes('FAILURE') || name === 'LOW BATTERY' ? 'warning' : 'info',
          'SCENARIO'
        ),
      };
    });
  },

  control: (key, value) =>
    set((s) => {
      const next = { ...s, [key]: value };
      return { ...next, metrics: calculate(next) };
    }),

  createMission: () =>
    set((s) => {
      if (s.running && s.flightMode === 'CRUISE') return s;
      const next = {
        ...s,
        missionType: 'manual',
        missionRoute: [],
        manualMode: true,
        add3DMode: false,
        selectedWaypoint: null,
        routeIndex: 1,
        returning: false,
        ended: false,
        running: false,
        flightMode: 'LANDED',
        trajectoryModified: false,
        bypassWaypoint: null,
        position: [0, 3, 0],
        velocity: 0,
        elapsed: 0,
        distance: 0,
        energy: 0,
        summary: null,
      };
      return {
        ...next,
        metrics: calculate(next),
        decision: 'STANDBY',
        reason: 'Custom mission mode active. Click anywhere on the Leaflet map to drop checkpoints.',
        events: event(s, 'Custom mission route editor opened', 'info', 'MISSION'),
      };
    }),

  setMissionType: (missionType) =>
    set((s) => {
      if (s.running && s.flightMode === 'CRUISE') return s;
      const next = {
        ...s,
        missionType,
        manualMode: missionType === 'manual',
        add3DMode: false,
        routeIndex: 1,
        returning: false,
      };
      return { ...next, metrics: calculate(next) };
    }),

  setManualMode: (manualMode) => set({ manualMode }),
  setAdd3DMode: (add3DMode) =>
    set((s) => ({
      add3DMode,
      manualMode: add3DMode || s.manualMode,
      missionType: add3DMode ? 'manual' : s.missionType,
    })),

  addWaypoint: (p) =>
    set((s) => {
      if (s.running && s.flightMode === 'CRUISE') return s;
      let n = 1;
      while (s.missionRoute.some((w) => w.id === `W${n}`)) n++;
      const id = `W${n}`;
      const point = {
        id,
        name: id,
        type: 'WAYPOINT',
        priority: 'NORMAL',
        description: '',
        p: [Number(p[0]), 0, Number(p[2])],
        altitude: Number.isFinite(p[1]) ? p[1] : s.altitude,
      };
      const points = [...s.missionRoute, point];
      const next = {
        ...s,
        missionType: 'manual',
        manualMode: true,
        missionRoute: points,
        selectedWaypoint: id,
      };
      return {
        ...next,
        metrics: calculate(next),
        events: event(s, `${id} placed at (${Math.round(p[0])}, ${Math.round(p[2])})`, 'info', 'MISSION'),
      };
    }),

  setMissionRoute: (points) =>
    set((s) => {
      if (s.running && s.flightMode === 'CRUISE') return s;
      const next = {
        ...s,
        missionType: 'manual',
        missionRoute: points,
        routeIndex: 1,
        returning: false,
        selectedWaypoint: points.at(-1)?.id || null,
      };
      return {
        ...next,
        metrics: calculate(next),
        events: event(s, `Mission updated with ${points.length} waypoints`, 'info', 'MISSION'),
      };
    }),

  updateWaypoint: (id, patch) =>
    set((s) => {
      const points = s.missionRoute.map((w) =>
        w.id === id ? { ...w, ...patch, p: patch.p || w.p } : w
      );
      const next = { ...s, missionRoute: points };
      return { ...next, metrics: calculate(next) };
    }),

  removeWaypoint: (id) =>
    set((s) => {
      const points = s.missionRoute.filter((w) => w.id !== id);
      const next = {
        ...s,
        missionRoute: points,
        selectedWaypoint: null,
        routeIndex: 1,
      };
      return {
        ...next,
        metrics: calculate(next),
        events: event(s, `${id} removed from plan`, 'info', 'MISSION'),
      };
    }),

  reorderWaypoint: (id, delta) =>
    set((s) => {
      const points = [...s.missionRoute];
      const from = points.findIndex((w) => w.id === id);
      const to = Math.max(0, Math.min(points.length - 1, from + delta));
      if (from < 0 || from === to) return s;
      const [point] = points.splice(from, 1);
      points.splice(to, 0, point);
      const next = { ...s, missionRoute: points, selectedWaypoint: id };
      return { ...next, metrics: calculate(next) };
    }),

  moveWaypoint: (id, targetId) =>
    set((s) => {
      const points = [...s.missionRoute];
      const from = points.findIndex((w) => w.id === id);
      const to = points.findIndex((w) => w.id === targetId);
      if (from < 0 || to < 0 || from === to) return s;
      const [point] = points.splice(from, 1);
      points.splice(to, 0, point);
      const next = { ...s, missionRoute: points, selectedWaypoint: id };
      return { ...next, metrics: calculate(next) };
    }),

  clearMission: () =>
    set((s) => {
      const next = {
        ...s,
        missionType: 'manual',
        manualMode: true,
        missionRoute: [],
        selectedWaypoint: null,
        routeIndex: 1,
        returning: false,
        ended: false,
        running: false,
        flightMode: 'LANDED',
        position: [0, 3, 0],
      };
      return {
        ...next,
        metrics: calculate(next),
        events: event(s, 'Route cleared · Click anywhere on the map to add checkpoints', 'info', 'MISSION'),
      };
    }),

  setCamera: (camera) => set({ camera }),
  toggleFollow: () => set((s) => ({ follow: !s.follow })),
  select: (id) => set({ selected: id }),
  selectWaypoint: (id) => set({ selectedWaypoint: id }),
  setDraggingWaypoint: (id) => set({ draggingWaypoint: id }),

  // High-performance simulation clock tick
  tick: (dt) =>
    set((s) => {
      if (!s.running || s.ended) return s;
      dt = Math.min(dt, 0.08); // cap frame delta for stability

      const mission = getMission(s);
      let p = [...s.position];
      let routeIndex = s.routeIndex;
      let returning = s.returning;
      let trajectoryModified = s.trajectoryModified;
      let bypassWaypoint = s.bypassWaypoint;
      let flightMode = s.flightMode || 'CRUISE';
      let waypointReached = null;

      let wind = s.wind;
      let windDir = s.windDir;
      let turbulence = s.turbulence;
      let temperature = s.temperature;
      let scenario = s.scenario;
      let currentFlightZone = s.currentFlightZone || 'NOMINAL';

      // Dynamic Auto Flight Challenges along waypoints during Cruise
      if (s.autoScenarios && flightMode === 'CRUISE' && !returning) {
        if (routeIndex === 1 && currentFlightZone !== 'NOMINAL') {
          currentFlightZone = 'NOMINAL';
          scenario = 'NORMAL MISSION';
          wind = 12;
          windDir = 35;
          turbulence = 0.08;
        } else if (routeIndex === 2 && currentFlightZone !== 'CROSSWIND') {
          currentFlightZone = 'CROSSWIND';
          scenario = 'CROSSWIND SHEAR';
          wind = 32;
          windDir = 160;
          turbulence = 0.28;
        } else if (routeIndex === 3 && currentFlightZone !== 'TURBULENCE_HEAT') {
          currentFlightZone = 'TURBULENCE_HEAT';
          scenario = 'HEAVY TURBULENCE';
          wind = 35;
          turbulence = 0.65;
          temperature = 48;
        } else if (routeIndex >= Math.max(3, mission.length - 1) && currentFlightZone !== 'RTB_LIMIT') {
          currentFlightZone = 'RTB_LIMIT';
          scenario = 'LOW BATTERY';
        }
      }

      let m = calculate({
        ...s,
        wind,
        windDir,
        turbulence,
        temperature,
        scenario,
      });

      // Handle autonomous decision directives
      if (m.decision === 'RETURN TO BASE' && !returning) {
        returning = true;
        flightMode = 'RETURNING';
        routeIndex = 0;
        trajectoryModified = false;
        bypassWaypoint = null;
      }

      if (m.decision === 'MISSION ABORT') {
        const n = { ...s, returning: true, routeIndex: 0 };
        m = calculate(n);
        returning = true;
        flightMode = 'RETURNING';
        routeIndex = 0;
      }

      if (m.decision === 'MODIFY TRAJECTORY' && m.dynamicBypassPoint && !trajectoryModified) {
        trajectoryModified = true;
        bypassWaypoint = m.dynamicBypassPoint;
      }

      // Handle TAKEOFF phase
      if (flightMode === 'TAKEOFF') {
        const climbRate = 5.0; // m/s
        p[1] = Math.min(s.altitude, p[1] + climbRate * dt);
        const actualBattery = clampValue(s.battery - m.batteryRate * dt, 0, 100);
        if (p[1] >= s.altitude - 0.5) {
          flightMode = 'HOVER';
          voiceAssistant.announceHoverReady();
        }
        return {
          ...s,
          position: p,
          velocity: climbRate,
          heading: 0,
          flightMode,
          battery: actualBattery,
          elapsed: s.elapsed + dt,
          metrics: m,
          events:
            flightMode === 'HOVER' && s.flightMode !== 'HOVER'
              ? event(s, `TAKEOFF COMPLETE · Hovering at ${s.altitude}m AGL. Click MOVE FORWARD to fly route.`, 'success', 'FLIGHT')
              : s.events,
        };
      }

      // Handle HOLD / HOVER phase
      if (flightMode === 'HOLD' || flightMode === 'HOVER') {
        const actualBattery = clampValue(s.battery - m.batteryRate * dt * 0.75, 0, 100);
        return {
          ...s,
          position: p,
          velocity: 0,
          battery: actualBattery,
          elapsed: s.elapsed + dt,
          metrics: m,
        };
      }

      // Handle CRUISE / RETURNING navigation & HELICOPTER HELIPAD TOUCHDOWN
      let heading = s.heading;
      let velocity = s.velocity;
      let step = 0;

      if (returning || flightMode === 'RETURNING') {
        const dx = 0 - p[0];
        const dz = 0 - p[2];
        const dPad = Math.hypot(dx, dz); // horizontal distance to helipad center [0, 0]

        if (dPad > 1.4) {
          // Phase 1: High-altitude ingress cruise back directly to helipad
          const cruise = Math.min(
            s.speedSetpoint,
            m.decision === 'SLOW DOWN' ? 6.5 : s.speedSetpoint
          );
          step = Math.min(dPad, cruise * dt);
          p[0] += (dx / dPad) * step;
          p[2] += (dz / dPad) * step;
          p[1] += clampValue(s.altitude - p[1], -4 * dt, 4 * dt);
          heading = Math.atan2(dx, dz);
          velocity = cruise;
        } else {
          // Phase 2: Over helipad -> Controlled vertical helicopter descent
          // Lock drone horizontally right over helipad center [0, 0]
          p[0] = damp(p[0], 0, 4.5, dt);
          p[2] = damp(p[2], 0, 4.5, dt);
          heading = damp(s.heading, 0, 3.0, dt);

          const heightAbovePad = p[1] - 3.0; // Landing pad top is at Y = 3.0
          // Smooth flare deceleration before touchdown
          const descentRate = heightAbovePad > 5.0 ? 3.6 : Math.max(0.75, heightAbovePad * 0.75 + 0.35);
          p[1] = Math.max(3.0, p[1] - descentRate * dt);
          velocity = descentRate;

          // Touchdown confirmation
          if (p[1] <= 3.05) {
            p[0] = 0;
            p[1] = 3.0;
            p[2] = 0;
            velocity = 0;
            voiceAssistant.announceTouchdown();
            const elapsed = s.elapsed + dt;
            const energy = s.energy + (m.power * dt) / 3600;
            const summary = {
              distance: s.distance,
              elapsed,
              energy,
              minBattery: s.minBattery,
              maxWind: s.maxWind,
              maxTemp: s.maxTemp,
              maxRisk: s.maxRisk,
              result: m.decision === 'MISSION ABORT' ? 'MISSION ABORTED · SAFELY DOCKED ON HELIPAD' : 'MISSION COMPLETE · SAFELY DOCKED ON HELIPAD',
              decisions: s.safetyCount,
            };
            return {
              ...s,
              position: [0, 3.0, 0],
              velocity: 0,
              heading: 0,
              running: false,
              ended: true,
              returning: false,
              flightMode: 'LANDED',
              elapsed,
              energy,
              routeIndex: 0,
              summary,
              metrics: m,
              events: event(s, 'HELIPAD TOUCHDOWN CONFIRMED · Drone seated safely on base pad (Engines off)', 'success', 'FLIGHT'),
            };
          }
        }
      } else {
        // Nominal waypoint cruise navigation
        let targetBase;
        if (trajectoryModified && bypassWaypoint) {
          targetBase = bypassWaypoint;
        } else {
          targetBase = waypointPosition(
            mission[Math.min(routeIndex, mission.length - 1)],
            s.altitude
          );
        }

        const target = [
          targetBase[0],
          Math.min(targetBase[1], m.decision === 'CHANGE ALTITUDE' ? m.recommendedAltitude : Infinity),
          targetBase[2],
        ];

        const dx = target[0] - p[0];
        const dz = target[2] - p[2];
        const d = Math.hypot(dx, dz);

        const cruise = Math.min(
          s.speedSetpoint,
          m.decision === 'SLOW DOWN' ? 6.5 : s.speedSetpoint
        );
        step = Math.min(d, cruise * dt);

        if (d < Math.max(cruise * dt, 1.4) && Math.abs(target[1] - p[1]) < 1.4) {
          if (trajectoryModified && bypassWaypoint) {
            trajectoryModified = false;
            bypassWaypoint = null;
          } else {
            waypointReached = mission[routeIndex]?.id;
            routeIndex++;
            if (routeIndex >= mission.length) {
              returning = true;
              flightMode = 'RETURNING';
              routeIndex = 0;
            }
          }
        } else {
          if (d > 0) {
            p[0] += (dx / d) * step;
            p[2] += (dz / d) * step;
          }
          p[1] += clampValue(target[1] - p[1], -4 * dt, 4 * dt);
        }

        heading = Math.atan2(dx, dz);
        velocity = step / dt;
      }

      // Extended Kalman Filter State Update
      const actualBattery = clampValue(s.battery - m.batteryRate * dt, 0, 100);
      const predictedVariance = (s.batteryVariance ?? 0.45) + 0.015;
      const measurement = actualBattery + 0.25 * Math.sin((s.elapsed + dt) * 1.73);
      const kalmanGain = predictedVariance / (predictedVariance + 0.45);
      const estimatedBattery = clampValue(
        (s.estimatedBattery ?? s.battery) + kalmanGain * (measurement - (s.estimatedBattery ?? s.battery)),
        0,
        100
      );
      const batteryVariance = (1 - kalmanGain) * predictedVariance;

      // Thermal & Degradation Dynamics
      const thermalInput = Math.max(0, m.actualPower - 105) * 0.00095;
      const thermalCooling = (temperature - s.ambientTemperature) * 0.018;
      temperature = clampValue(temperature + (thermalInput - thermalCooling) * dt, 15, 75);
      const degradation = clampValue(s.degradation + m.structuralStress * 0.0000018 * dt, 0, 0.8);
      const rotorEfficiency = clampValue(s.rotorEfficiency - m.structuralStress * 0.0000007 * dt, 0.55, 1.0);
      const actualEnergy = s.actualEnergy + (m.actualPower * dt) / 3600;

      const updated = {
        ...s,
        wind,
        windDir,
        turbulence,
        scenario,
        currentFlightZone,
        position: p,
        velocity,
        heading,
        routeIndex,
        returning,
        flightMode,
        trajectoryModified,
        bypassWaypoint,
        elapsed: s.elapsed + dt,
        distance: s.distance + step,
        energy: s.energy + (m.power * dt) / 3600,
        actualEnergy,
        battery: actualBattery,
        estimatedBattery,
        batteryVariance,
        temperature,
        degradation,
        rotorEfficiency,
        structuralStress: m.structuralStress,
        healthScore: m.healthScore,
        current: m.actualPower / Math.max(1, s.voltage),
        maxWind: Math.max(s.maxWind, wind),
        minBattery: Math.min(s.minBattery, actualBattery),
        maxTemp: Math.max(s.maxTemp, temperature),
        maxRisk: Math.max(s.maxRisk, m.risk),
        metrics: m,
      };

      let events = updated.events;
      let decision = s.decision;
      let reason = s.reason;
      let safetyCount = s.safetyCount;

      if (waypointReached) {
        events = event(updated, `Checkpoint ${waypointReached} reached`, 'success', 'MISSION');
      }

      if (returning && !s.returning) {
        events = event(updated, 'Autonomous RTB engaged · Navigating to landing pad', 'critical', 'AUTONOMY');
        decision = 'RETURN TO BASE';
        reason = m.reason;
        safetyCount++;
        voiceAssistant.announceDecision('RETURN TO BASE', m.reason);
      } else if (trajectoryModified && !s.trajectoryModified) {
        events = event(updated, 'TRAJECTORY MODIFIED · Aerodynamic bypass corridor active', 'warning', 'AUTONOMY');
        decision = 'MODIFY TRAJECTORY';
        reason = m.reason;
        safetyCount++;
        voiceAssistant.announceDecision('MODIFY TRAJECTORY', m.reason);
      } else if (m.decision !== s.decision) {
        events = event(updated, `Decision Directive: ${m.decision} · ${m.reason}`, m.risk > 65 ? 'warning' : 'info', 'AUTONOMY');
        decision = m.decision;
        reason = m.reason;
        if (m.decision === 'CHANGE ALTITUDE') {
          updated.altitude = m.recommendedAltitude;
        }
        if (m.decision !== 'CONTINUE') safetyCount++;
        voiceAssistant.announceDecision(m.decision, m.reason);
      }

      // Sample Telemetry at 1.5s interval to keep charts super fast and lightweight
      if (Math.floor(updated.elapsed / 2) > Math.floor(s.elapsed / 2)) {
        const predicted = updated.energy - (s.lastSampleEnergy ?? 0);
        const actual = updated.actualEnergy - (s.lastSampleActualEnergy ?? 0);
        const uncertaintyRange = m.confidenceInterval95 || 1.8;
        const sample = {
          time: Math.round(updated.elapsed),
          battery: Math.round(updated.battery * 10) / 10,
          estimatedBattery: Math.round(updated.estimatedBattery * 10) / 10,
          upperBattery: Math.min(100, Math.round((updated.battery + uncertaintyRange) * 10) / 10),
          lowerBattery: Math.max(0, Math.round((updated.battery - uncertaintyRange) * 10) / 10),
          power: Math.round(m.power),
          actualPower: Math.round(m.actualPower),
          wind: Math.round(s.wind),
          altitude: Math.round(p[1]),
          risk: m.risk,
          predicted: Math.round(predicted * 1000) / 1000,
          actual: Math.round(actual * 1000) / 1000,
          stress: m.structuralStress,
        };
        updated.samples = [...s.samples, sample].slice(-50); // limit to 50 points for 60fps rendering
        updated.lastSampleEnergy = updated.energy;
        updated.lastSampleActualEnergy = updated.actualEnergy;
      }

      return { ...updated, decision, reason, events, safetyCount };
    }),

  windGust: () => {
    voiceAssistant.announceEnvironmentDisturbance('WIND_GUST', 42);
    return set((s) => {
      const n = {
        ...s,
        wind: Math.min(55, s.wind + 17),
        windDir: (s.windDir + 45) % 360,
        turbulence: Math.min(0.9, s.turbulence + 0.22),
      };
      return {
        ...n,
        metrics: calculate(n),
        events: event(s, 'Wind microburst detected · Aerodynamic drag surge', 'warning', 'ENVIRONMENT'),
      };
    });
  },

  demo: () => {
    const before = get();
    const savedRoute = before.missionType === 'manual' ? [...before.missionRoute] : null;
    get().reset();
    if (savedRoute?.length) get().setMissionRoute(savedRoute);

    set((s) => ({
      ...s,
      demo: true,
      events: event(s, 'HACKFUSION DEMO SEQUENCE INITIATED', 'info', 'DEMO'),
    }));

    setTimeout(() => get().takeoff(), 350);
    setTimeout(() => get().moveForward(), 2500);

    // Demonstration Timeline:
    // 1. At t = 5s: Inject severe crosswind shear -> triggers "MODIFY TRAJECTORY"
    setTimeout(() => {
      set((s) => {
        const n = {
          ...s,
          wind: 30,
          windDir: 160,
          turbulence: 0.42,
          scenario: 'CROSSWIND SHEAR DEMO',
        };
        return {
          ...n,
          metrics: calculate(n),
          events: event(
            s,
            'DEMO STAGE 1: Severe crosswind shear (30 km/h @ 160°) injected · Evaluating trajectory alternatives',
            'warning',
            'DEMO'
          ),
        };
      });
    }, 5500);

    // 2. At t = 12s: Increase turbulence & wind -> triggers "SLOW DOWN"
    setTimeout(() => {
      set((s) => {
        const n = {
          ...s,
          wind: 36,
          turbulence: 0.65,
          temperature: 44,
          scenario: 'ELEVATED DRAG DEMO',
        };
        return {
          ...n,
          metrics: calculate(n),
          events: event(
            s,
            'DEMO STAGE 2: Heavy turbulence & thermal rise · Speed reduction engaged to conserve reserve',
            'warning',
            'DEMO'
          ),
        };
      });
    }, 12000);

    // 3. At t = 19s: Deplete battery near return threshold -> triggers "RETURN TO BASE"
    setTimeout(() => {
      set((s) => {
        const n = {
          ...s,
          battery: 24,
          scenario: 'RETURN-TO-BASE DEMO',
        };
        return {
          ...n,
          metrics: calculate(n),
          events: event(
            s,
            'DEMO STAGE 3: Battery reached 24% return limit · Autonomous Return to Base initiated',
            'critical',
            'DEMO'
          ),
        };
      });
    }, 19000);
  },

  reset: () => {
    voiceAssistant.hasAnnouncedHoverForCurrentTakeoff = false;
    voiceAssistant.hasAnnouncedTouchdown = false;
    set({
      ...initial(),
      flightMode: 'LANDED',
      position: [0, 3, 0],
      velocity: 0,
      running: false,
      ended: false,
      returning: false,
      metrics: calculate(initial()),
    });
  },
}));
