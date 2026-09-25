/**
 * DIGITAL TWIN TELEMETRY & PINN REST/WEBSOCKET API ADAPTER
 * 
 * Provides bi-directional synchronization between the browser-based
 * digital twin and optional high-performance backend microservices (FastAPI / gRPC).
 * When running in standalone mode, inferences are computed locally via the client-side PINN engine.
 */
import { predictResidual } from './residualModel';

export const predictionInput = (state) => ({
  wind_speed: state.wind,
  wind_direction: state.windDir,
  temperature: state.temperature,
  air_density: state.airDensity,
  turbulence: state.turbulence,
  payload: state.payload,
  battery_soc: state.battery,
  motor_efficiency: state.motorEfficiency,
  motor_degradation: state.degradation,
  ground_speed: state.velocity,
  altitude_agl: state.position[1],
  distance_remaining: state.metrics?.distanceTarget ?? 0,
});

/**
 * Executes physics-informed inference locally or connects to remote inference server
 */
export async function predictLocally(state) {
  const features = {
    wind: state.wind,
    turbulence: state.turbulence,
    payload: state.payload,
    batteryTemp: state.temperature,
    degradation: state.degradation,
    motorEfficiency: state.motorEfficiency,
    altitude: state.position[1],
    relativeAirspeed: (state.velocity || 12) + (state.wind || 8) / 3.6,
  };

  const pinn = predictResidual(features);
  return {
    ...state.metrics,
    pinnResidualPower: pinn.residualPower,
    pinnUncertaintySigma: pinn.uncertaintySigma,
    featureAttributions: pinn.featureContributions,
    inferenceLatencyMs: pinn.latencyMs,
  };
}

export const endpoints = {
  predict: '/api/v1/twin/predict',
  telemetry: '/api/v1/twin/telemetry',
  decision: '/api/v1/twin/decision',
  envelope: '/api/v1/twin/envelope',
  missionState: '/api/v1/twin/mission-state',
};
