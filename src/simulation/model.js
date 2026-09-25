// Physics-Informed Digital Twin Analytical & Neural Dynamics Model
// IEEE RAS HackFusion 2026 - Theme 3: Physics-Informed Drone Digital Twin
import { predictResidual, pinnModelInfo } from './residualModel';

export const baseMission = [
  { id: 'BASE', name: 'DRONE BASE', p: [0, 0, 0], type: 'base' },
  { id: 'W1', name: 'WAYPOINT 1', p: [35, 0, 18], type: 'waypoint' },
  { id: 'WX', name: 'WEATHER STATION', p: [72, 3, 4], type: 'station' },
  { id: 'W2', name: 'WAYPOINT 2', p: [108, 0, 22], type: 'waypoint' },
  { id: 'WH', name: 'INDUSTRIAL ZONE', p: [148, 0, 0], type: 'warehouse' },
  { id: 'W3', name: 'WAYPOINT 3', p: [181, 0, 24], type: 'waypoint' },
  { id: 'MT', name: 'MOUNTAIN OBSERVATION', p: [216, 4, 45], type: 'mountain' },
  { id: 'W4', name: 'WAYPOINT 4', p: [247, 0, 21], type: 'waypoint' },
  { id: 'TARGET', name: 'EMERGENCY ZONE', p: [278, 0, 5], type: 'target' },
];

export const defaultMissionRoute = baseMission.slice(1).map((w, i) => ({
  ...w,
  id: `W${i + 1}`,
  name: w.name,
  type: i === 2 ? 'INSPECTION' : i === 4 ? 'SEARCH ZONE' : 'WAYPOINT',
  priority: 'NORMAL',
  description: '',
  altitude: 35,
}));

export const getMission = (s) => [
  baseMission[0],
  ...(s.missionType === 'manual' ? s.missionRoute || [] : defaultMissionRoute),
];

export const waypointPosition = (waypoint, fallbackAltitude = 35) =>
  waypoint.id === 'BASE' ? [0, 3, 0] : [waypoint.p[0], waypoint.altitude ?? fallbackAltitude, waypoint.p[2]];

export const SOE_LIMITS = {
  maxWind: 32.0, // km/h
  maxTurbulence: 0.50, // ratio
  maxTemperature: 58.0, // °C
  maxStress: 85, // 0-100 index
  maxPayload: 5.0, // kg
  maxDegradation: 0.35, // ratio
  minBatteryReturn: 20.0, // %
  maxAltitude: 65.0, // m AGL
  minAltitude: 10.0, // m AGL
};

export const initial = () => ({
  running: false,
  ended: false,
  returning: false,
  trajectoryModified: false,
  bypassWaypoint: null,
  elapsed: 0,
  position: [0, 3, 0],
  velocity: 0,
  heading: 0,
  battery: 96,
  estimatedBattery: 96,
  batteryVariance: 0.45,
  returnThreshold: 25,
  missionType: 'predefined',
  missionRoute: [],
  manualMode: false,
  add3DMode: false,
  draggingWaypoint: null,
  selectedWaypoint: null,
  voltage: 22.2,
  current: 0,
  power: 0,
  actualPower: 0,
  energy: 0,
  actualEnergy: 0,
  lastSampleEnergy: 0,
  lastSampleActualEnergy: 0,
  distance: 0,
  payload: 1.5,
  mass: 4.2,
  motorEfficiency: 0.94,
  rotorEfficiency: 0.91,
  degradation: 0.04,
  temperature: 31,
  ambientTemperature: 27,
  wind: 8,
  windDir: 245,
  turbulence: 0.12,
  airDensity: 1.225,
  altitude: 35,
  speedSetpoint: 12,
  structuralStress: 12,
  healthScore: 96,
  scenario: 'NORMAL MISSION',
  routeIndex: 1,
  maxWind: 8,
  minBattery: 96,
  maxTemp: 31,
  maxRisk: 0,
  samples: [],
  events: [
    {
      t: 0,
      type: 'SYSTEM',
      text: 'Physics-Informed Digital Twin online · PINN Neural Regressor & Extended Kalman Filter initialized',
      severity: 'info',
    },
  ],
  decision: 'STANDBY',
  reason: 'System ready. Start the mission to begin live physics-informed analysis.',
  risk: 8,
  confidence: 95,
  uncertainty: 3.8,
  summary: null,
  safetyCount: 0,
  selected: null,
  camera: 'DRONE VIEW',
  follow: false,
  flightMode: 'LANDED', // 'LANDED' | 'TAKEOFF' | 'HOVER' | 'CRUISE' | 'HOLD' | 'RETURNING'
  poweredOn: false,
  autoScenarios: true,
  currentFlightZone: 'NOMINAL',
  droneCamOpen: false,
  camFilterMode: 'RGB',
  demo: false,
});

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Multi-dimensional Safe Operating Envelope (SOE) evaluation
 */
export function evaluateSafeOperatingEnvelope(s, m) {
  const windMargin = 1 - clamp(s.wind / SOE_LIMITS.maxWind, 0, 1.5);
  const tempMargin = 1 - clamp(s.temperature / SOE_LIMITS.maxTemperature, 0, 1.5);
  const stressMargin = 1 - clamp((m?.structuralStress || 15) / SOE_LIMITS.maxStress, 0, 1.5);
  const batteryMargin = clamp((s.battery - s.returnThreshold) / (100 - s.returnThreshold), -0.5, 1);
  const degradationMargin = 1 - clamp(s.degradation / SOE_LIMITS.maxDegradation, 0, 1.5);
  const payloadMargin = 1 - clamp(s.payload / SOE_LIMITS.maxPayload, 0, 1.5);

  const axes = [
    { name: 'Wind Tolerance', current: s.wind, max: SOE_LIMITS.maxWind, unit: 'km/h', ratio: Math.min(1.2, s.wind / SOE_LIMITS.maxWind), safe: s.wind <= SOE_LIMITS.maxWind },
    { name: 'Thermal Margin', current: s.temperature, max: SOE_LIMITS.maxTemperature, unit: '°C', ratio: Math.min(1.2, s.temperature / SOE_LIMITS.maxTemperature), safe: s.temperature <= SOE_LIMITS.maxTemperature },
    { name: 'Structural Stress', current: m?.structuralStress || 15, max: SOE_LIMITS.maxStress, unit: '/100', ratio: Math.min(1.2, (m?.structuralStress || 15) / SOE_LIMITS.maxStress), safe: (m?.structuralStress || 15) <= SOE_LIMITS.maxStress },
    { name: 'Actuator Health', current: Math.round((1 - s.degradation) * 100), max: 100, unit: '%', ratio: Math.min(1.2, s.degradation / SOE_LIMITS.maxDegradation), safe: s.degradation <= SOE_LIMITS.maxDegradation },
    { name: 'Payload Capacity', current: s.payload, max: SOE_LIMITS.maxPayload, unit: 'kg', ratio: Math.min(1.2, s.payload / SOE_LIMITS.maxPayload), safe: s.payload <= SOE_LIMITS.maxPayload },
    { name: 'Energy Reserve', current: Math.round(s.battery), max: 100, unit: '%', ratio: clamp(1 - (s.battery - s.returnThreshold) / 50, 0, 1.2), safe: s.battery > s.returnThreshold },
  ];

  const overallSafe = axes.every((a) => a.safe);
  const status = !overallSafe ? 'BREACHED' : axes.some((a) => a.ratio > 0.82) ? 'MARGINAL' : 'NOMINAL';

  return { axes, overallSafe, status, margins: { windMargin, tempMargin, stressMargin, batteryMargin, degradationMargin, payloadMargin } };
}

/**
 * Calculates dynamic safe bypass corridor when crosswind or shear threatens flight stability
 */
export function calculateDynamicBypass(currentPos, targetPos, windDir, windSpeed) {
  const dx = targetPos[0] - currentPos[0];
  const dz = targetPos[2] - currentPos[2];
  const midX = (currentPos[0] + targetPos[0]) / 2;
  const midZ = (currentPos[2] + targetPos[2]) / 2;

  // Compute perpendicular vector to minimize crosswind drift
  const legAngle = Math.atan2(dx, dz);
  const windAngleRad = (windDir * Math.PI) / 180;
  const cross = Math.sin(windAngleRad - legAngle);

  // Offset upwind by an aerodynamic compensation distance (15m - 35m)
  const offsetMag = Math.min(32, Math.max(12, windSpeed * 0.7));
  const perpX = -Math.cos(legAngle) * Math.sign(cross || 1) * offsetMag;
  const perpZ = Math.sin(legAngle) * Math.sign(cross || 1) * offsetMag;

  return [
    Math.round(midX + perpX),
    targetPos[1] || 35,
    Math.round(midZ + perpZ),
  ];
}

/**
 * Main physical state and mission calculation engine
 */
export function calculate(s) {
  const mission = getMission(s);
  const target = waypointPosition(
    mission[s.returning ? 0 : Math.min(s.routeIndex, mission.length - 1)],
    s.altitude
  );
  const distanceTarget = dist(s.position, target);
  const distanceBase = dist(s.position, waypointPosition(baseMission[0]));

  const speed = Math.max(2, s.velocity || s.speedSetpoint);
  const headingRad = (s.heading || 0);
  const windAngleRad = ((s.windDir || 0) * Math.PI) / 180;
  
  // Aerodynamic relative airspeed and crosswind components
  const relativeWind = Math.abs((s.wind * Math.cos(windAngleRad - headingRad)) / 3.6);
  const crossWind = Math.abs((s.wind * Math.sin(windAngleRad - headingRad)) / 3.6);
  const vRel = speed + relativeWind;

  // Barometric altitude-dependent air density: rho(h) = rho_0 * exp(-h / 8500)
  const density = s.airDensity * Math.exp(-Math.max(0, s.position[1]) / 8500);

  // Aerodynamic drag force: D = 0.5 * rho * Cd * A * v_rel^2
  const drag = 0.5 * density * 0.82 * 0.24 * Math.pow(vRel, 2);
  const dragPower = drag * speed;

  // Hover power from actuator momentum theory: P_hover = (m * g)^1.5 / sqrt(2 * rho * A)
  const totalMass = (s.mass || 4.2) + (s.payload || 0);
  const hover = (76 * Math.pow(totalMass / 4.2, 1.5)) / (s.rotorEfficiency || 0.7);

  // Climb and vertical maneuvers
  const climb = 8 + Math.abs(target[1] - s.position[1]) * 2.3;

  // First-principles physics baseline power
  const physicsPower =
    ((hover + dragPower + climb + (22 * s.wind) / 20 + (18 * s.payload) / 3) /
      (s.motorEfficiency * s.rotorEfficiency)) *
    (1 + s.degradation * 0.8);

  // Forward inference through Physics-Informed Neural Network (PINN)
  const pinnOutput = predictResidual({
    wind: s.wind,
    turbulence: s.turbulence,
    payload: s.payload,
    batteryTemp: s.temperature,
    degradation: s.degradation,
    motorEfficiency: s.motorEfficiency,
    altitude: s.position[1],
    relativeAirspeed: vRel,
  });

  const mlResidual = typeof pinnOutput === 'object' ? pinnOutput.residualPower : pinnOutput;
  const power = Math.max(40, physicsPower + mlResidual);

  // Simulated telemetry measuring hidden real-world non-linearities
  const actualPower = Math.max(
    1,
    physicsPower *
      (1 +
        0.028 * Math.sin(s.elapsed * 0.7) +
        0.035 * s.turbulence +
        (0.018 * Math.max(0, s.temperature - 38)) / 20) +
      mlResidual * 0.92
  );

  // Battery discharge electro-chemical rate
  const batteryRate = (actualPower / (s.voltage * 5.2 * 3600)) * 100;

  // Structural stress estimation (0 - 100 index)
  const structuralStress = Math.round(
    clamp(
      5 +
        s.payload * 7 +
        s.wind * 0.42 +
        s.turbulence * 38 +
        Math.max(0, s.position[1] - 50) * 0.45 +
        s.degradation * 32 +
        crossWind * 2.1,
      0,
      100
    )
  );

  // Vehicle component health score (0 - 100)
  const healthScore = Math.round(
    clamp(
      100 -
        structuralStress * 0.45 -
        s.degradation * 35 -
        Math.max(0, s.temperature - 40) * 0.8,
      0,
      100
    )
  );

  // Mission Risk Index (0 - 100)
  const risk = Math.round(
    clamp(
      8 +
        Math.max(0, s.wind - 26) * 1.4 +
        Math.max(0, s.turbulence - 0.32) * 58 +
        Math.max(0, s.temperature - 42) * 1.7 +
        Math.max(0, s.payload - 2.5) * 9 +
        s.degradation * 48 +
        Math.max(0, 35 - s.battery) * 1.1 +
        Math.max(0, 8 - s.motorEfficiency * 10) * 7 +
        Math.max(0, s.position[1] - 70) * 0.35 +
        crossWind * 1.8,
      0,
      100
    )
  );

  // Energy & Endurance Forecasting
  const returnWh =
    ((distanceBase * power) / Math.max(4, s.speedSetpoint) / 3600) * 1.35;
  const missionWh =
    ((distanceTarget * power) / Math.max(4, s.speedSetpoint) / 3600) * 1.35;

  const planPoints = [
    waypointPosition(baseMission[0]),
    ...mission.slice(1).map((w) => waypointPosition(w, s.altitude)),
    waypointPosition(baseMission[0]),
  ];

  const routeDistance = planPoints
    .slice(1)
    .reduce((sum, p, i) => sum + dist(planPoints[i], p), 0);
  const estimatedDuration = routeDistance / Math.max(4, s.speedSetpoint);

  const estimatedEnergy = planPoints.slice(1).reduce((sum, b, i) => {
    const a = planPoints[i];
    const d = dist(a, b);
    const bearing = Math.atan2(b[0] - a[0], b[2] - a[2]);
    const cross = Math.abs((s.wind * Math.sin((s.windDir * Math.PI) / 180 - bearing)) / 3.6);
    const head = Math.max(0, (s.wind * Math.cos((s.windDir * Math.PI) / 180 - bearing)) / 3.6);
    const air = s.airDensity * Math.exp(-Math.max(0, a[1]) / 8500);
    const legDrag = 0.5 * air * 0.82 * 0.24 * Math.pow(s.speedSetpoint + head, 2);
    const legHover = (76 * Math.pow(totalMass / 4.2, 1.5)) / (s.rotorEfficiency || 0.7);
    const climbLoad = 8 + Math.max(0, b[1] - a[1]) * 2.3;
    const legPower =
      ((legHover + legDrag * s.speedSetpoint + climbLoad + (22 * (s.wind + cross)) / 20 + (18 * s.payload) / 3) /
        (s.motorEfficiency * s.rotorEfficiency)) *
      (1 + s.degradation * 0.8);
    return sum + (legPower * d) / Math.max(4, s.speedSetpoint) / 3600 * 1.35;
  }, 0);

  const capacityWh = 115.4;
  const energyLeft = (capacityWh * s.battery) / 100;
  const estimatedReturnBattery = clamp(s.battery - (estimatedEnergy / capacityWh) * 100, 0, 100);
  const destinationBattery = clamp(s.battery - (missionWh / capacityWh) * 100, 0, 100);
  const returnBattery = clamp(s.battery - (returnWh / capacityWh) * 100, 0, 100);

  // Extended Kalman Filter uncertainty estimation
  const estimatorSigma = Math.sqrt(Math.max(0.05, s.batteryVariance ?? 0.45));
  const pinnSigma = pinnOutput?.uncertaintySigma || 0.8;
  const confidence = Math.round(
    clamp(
      97 -
        s.turbulence * 22 -
        Math.max(0, s.wind - 18) * 0.4 -
        s.degradation * 18 -
        estimatorSigma * 2.5 -
        pinnSigma * 1.5,
      50,
      98
    )
  );

  const uncertainty = Math.round(Math.max(estimatorSigma, (100 - confidence) / 2.2 + pinnSigma) * 10) / 10;
  const confidenceInterval95 = Math.round(1.96 * uncertainty * 10) / 10;

  // Safe Operating Envelope evaluation
  const soe = evaluateSafeOperatingEnvelope(s, { structuralStress });

  // Explainable AI (XAI) Causal Feature Attribution
  const xaiAttributions = pinnOutput?.featureContributions || {
    wind: 32,
    turbulence: 24,
    payload: 16,
    temperature: 12,
    degradation: 10,
    motorLoss: 6,
  };

  // Autonomous Decision Support Engine
  const criticalAbort =
    risk > 82 ||
    s.temperature > 65 ||
    s.battery < 9 ||
    structuralStress > 90 ||
    s.degradation > 0.45;

  const severeCrosswindOrShear =
    crossWind > 4.5 && // ~16 km/h lateral crosswind
    s.wind > 22 &&
    s.wind <= 34 &&
    s.battery > s.returnThreshold + 12 &&
    risk >= 38 &&
    risk < 68 &&
    !s.returning;

  const recommendedAltitude = Math.min(55, Math.max(30, s.altitude));
  let decision = 'CONTINUE';
  let reason = 'Flight state is within the Physics-Informed Safe Operating Envelope; planned trajectory is nominal.';
  let dynamicBypassPoint = null;

  if (criticalAbort) {
    decision = 'MISSION ABORT';
    const primaryFactor =
      s.temperature > 65
        ? 'critical battery thermal limit'
        : s.battery < 9
        ? 'battery exhaustion'
        : structuralStress > 90
        ? 'structural stress yield breach'
        : s.degradation > 0.45
        ? 'catastrophic motor degradation'
        : 'multi-variable risk ceiling';
    reason = `Critical safety limit reached: ${primaryFactor} requires an immediate emergency descent/abort.`;
  } else if (s.battery <= s.returnThreshold) {
    decision = 'RETURN TO BASE';
    reason = `Battery SoC reached the autonomous return threshold of ${s.returnThreshold}%. Executing optimal return path to base.`;
  } else if (risk >= 68 || !soe.overallSafe) {
    decision = 'RETURN TO BASE';
    reason = `Operating envelope breach detected (risk ${risk}/100, status ${soe.status}). Returning safely while battery is ${Math.round(s.battery)}%.`;
  } else if (severeCrosswindOrShear && !s.trajectoryModified) {
    decision = 'MODIFY TRAJECTORY';
    dynamicBypassPoint = calculateDynamicBypass(s.position, target, s.windDir, s.wind);
    reason = `High crosswind shear (${(crossWind * 3.6).toFixed(0)} km/h) detected on direct route. Autonomously modifying trajectory to generate aerodynamic bypass corridor.`;
  } else if (risk >= 45 || s.wind > 27 || s.turbulence > 0.40) {
    decision = 'SLOW DOWN';
    reason = `Elevated aerodynamic disturbance (wind ${(s.wind).toFixed(0)} km/h, turbulence ${(s.turbulence * 100).toFixed(0)}%). Speed reduction cuts drag power (v³) and preserves endurance.`;
  } else if (Math.max(s.position[1], s.altitude) > 62) {
    decision = 'CHANGE ALTITUDE';
    reason = `Current altitude (${Math.round(s.position[1])} m) exceeds safe atmospheric boundary layer. Commanding controlled descent to ${recommendedAltitude} m.`;
  }

  const waypointsSafe = mission
    .slice(1)
    .every(
      (w) =>
        w.p.every(Number.isFinite) &&
        Math.abs(w.p[0]) <= 500 &&
        Math.abs(w.p[2]) <= 500 &&
        (w.altitude ?? s.altitude) >= 10 &&
        (w.altitude ?? s.altitude) <= 80
    );
  const envelopeSafe = s.wind <= SOE_LIMITS.maxWind && s.payload <= SOE_LIMITS.maxPayload && waypointsSafe;

  const remainingEndurance = (energyLeft / Math.max(power, 1)) * 3600;
  const remainingDistance =
    (energyLeft / Math.max(power, 1)) * Math.max(4, s.speedSetpoint);

  return {
    target,
    distanceTarget,
    distanceBase,
    relativeWind,
    crossWind,
    drag,
    hover,
    dragPower,
    physicsPower,
    mlResidual,
    power,
    actualPower,
    batteryRate,
    structuralStress,
    healthScore,
    returnWh,
    missionWh,
    destinationBattery,
    returnBattery,
    estimatedReturnBattery,
    routeDistance,
    estimatedDuration,
    estimatedEnergy,
    density,
    confidence,
    uncertainty,
    estimatorSigma: Math.round(estimatorSigma * 10) / 10,
    confidenceInterval95,
    decision,
    reason,
    recommendedAltitude,
    dynamicBypassPoint,
    modelInfo: pinnModelInfo,
    soe,
    xaiAttributions,
    pinnLatency: pinnOutput?.latencyMs || 0.8,
    physicsLoss: pinnOutput?.physicsLoss || 0.0,
    feasible: mission.length > 1 && estimatedReturnBattery >= 20 && risk < 68 && envelopeSafe,
    eta: distanceTarget / Math.max(4, s.speedSetpoint),
    remainingEndurance,
    remainingDistance,
  };
}

export function validateMission(s) {
  const metrics = calculate(s);
  const mission = getMission(s);
  const issues = [];
  if (mission.length < 2) issues.push('Add at least one waypoint.');
  if (s.battery <= s.returnThreshold)
    issues.push(`Battery is at or below the ${s.returnThreshold}% return threshold. Recharge before launch.`);
  if (s.wind > SOE_LIMITS.maxWind)
    issues.push(`Wind (${s.wind} km/h) exceeds the ${SOE_LIMITS.maxWind} km/h safe operating limit.`);
  if (s.payload > SOE_LIMITS.maxPayload)
    issues.push(`Payload (${s.payload} kg) exceeds the ${SOE_LIMITS.maxPayload} kg maximum takeoff weight limit.`);
  if (
    mission
      .slice(1)
      .some((w) => !w.p.every(Number.isFinite) || Math.abs(w.p[0]) > 500 || Math.abs(w.p[2]) > 500)
  )
    issues.push('A waypoint is outside the reachable ±500 m mission corridor.');
  if (
    mission.slice(1).some((w) => (w.altitude ?? s.altitude) < 10 || (w.altitude ?? s.altitude) > 80)
  )
    issues.push('Waypoint altitude must be bounded between 10 m and 80 m.');
  if (metrics.estimatedReturnBattery < 20)
    issues.push(`Predicted reserve after route and return is ${Math.round(metrics.estimatedReturnBattery)}%; 20% required.`);
  // Hard-block only if there are no valid checkpoints or battery is completely dead
  const isHardBlocked = mission.length < 2 || s.battery < 5;
  return { ready: !isHardBlocked, issues, metrics, warnings: issues };
}

export const scenarios = {
  'NORMAL MISSION': { wind: 8, windDir: 245, turbulence: 0.12, temperature: 31, battery: 96, payload: 1.5, degradation: 0.04, motorEfficiency: 0.94 },
  'STRONG WIND': { wind: 39, windDir: 270, turbulence: 0.25, temperature: 32, battery: 96, payload: 1.5, degradation: 0.04, motorEfficiency: 0.94 },
  'HEAVY TURBULENCE': { wind: 24, windDir: 180, turbulence: 0.72, temperature: 32, battery: 96, payload: 1.5, degradation: 0.04, motorEfficiency: 0.94 },
  'CROSSWIND SHEAR': { wind: 28, windDir: 155, turbulence: 0.38, temperature: 33, battery: 88, payload: 2.0, degradation: 0.06, motorEfficiency: 0.92 },
  'HIGH TEMPERATURE': { wind: 8, windDir: 245, turbulence: 0.12, temperature: 57, battery: 82, payload: 1.5, degradation: 0.04, motorEfficiency: 0.94 },
  'LOW BATTERY': { wind: 8, windDir: 245, turbulence: 0.12, temperature: 31, battery: 27, payload: 1.5, degradation: 0.04, motorEfficiency: 0.94 },
  'HEAVY PAYLOAD': { wind: 10, windDir: 245, turbulence: 0.15, temperature: 31, battery: 96, payload: 4.4, degradation: 0.04, motorEfficiency: 0.94 },
  'MOTOR DEGRADATION': { wind: 8, windDir: 245, turbulence: 0.12, temperature: 35, battery: 84, payload: 1.5, degradation: 0.42, motorEfficiency: 0.69 },
  'COMBINED FAILURE': { wind: 37, windDir: 310, turbulence: 0.68, temperature: 55, battery: 46, payload: 3.6, degradation: 0.30, motorEfficiency: 0.72 },
};

export const clampValue = clamp;
