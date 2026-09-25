import React from 'react';
import { CircleHelp, Cpu, Zap, Activity, Info } from 'lucide-react';

/**
 * Explainable AI (XAI) Causal Feature Attribution & Decision Evidence Panel
 * Explains WHY the autonomous decision was made in plain, easy-to-understand terms.
 */
export default function ExplainableAiPanel({ state, metrics }) {
  if (!metrics) return null;
  const xai = metrics.xaiAttributions || {};

  const factorColors = {
    wind: '#3498db',
    turbulence: '#9b59b6',
    payload: '#e67e22',
    temperature: '#e74c3c',
    degradation: '#1abc9c',
    motorLoss: '#f39c12',
    altitude: '#2ecc71',
    airspeed: '#2980b9',
  };

  const factorLabels = {
    wind: 'Wind Speed & Side-Gusts',
    turbulence: 'Air Turbulence & Shaking',
    payload: 'Cargo / Payload Weight',
    temperature: 'Battery Core Heating',
    degradation: 'Motor Wear & Aging',
    motorLoss: 'Propeller Airfoil Drag',
    altitude: 'Thinner Air at Altitude',
    airspeed: 'Forward Flight Speed',
  };

  return (
    <div className="xai-panel">
      <div className="xai-head">
        <div className="xai-title">
          <CircleHelp size={13} />
          <b>WHY WAS THIS DECISION MADE? (AI Evidence)</b>
        </div>
        <span className="ai-chip" title="Time taken by AI to calculate safety state">
          <Cpu size={11} /> AI LATENCY: {metrics.pinnLatency || 0.8} ms
        </span>
      </div>

      <div className="xai-reason-card">
        <p className="xai-reason">{state.reason}</p>
      </div>

      {/* Physics + AI Power Breakdown with Plain-English Subtitles */}
      <div className="xai-equation">
        <div className="eq-label">
          <span>ELECTRIC POWER BREAKDOWN (Where battery energy goes)</span>
          <small>Hover + Wind Drag + AI Neural Correction = Total Watts</small>
        </div>
        <div className="eq-row">
          <div className="eq-col">
            <span>P<sub>hover</sub> <b>{metrics.hover?.toFixed(1) || 0}W</b></span>
            <small>Lift Power</small>
          </div>
          <i>+</i>
          <div className="eq-col">
            <span>P<sub>drag</sub> <b>{metrics.dragPower?.toFixed(1) || 0}W</b></span>
            <small>Air Drag</small>
          </div>
          <i>+</i>
          <div className="eq-col pinn-highlight">
            <span>ΔP<sub>AI</sub> <b>+{metrics.mlResidual?.toFixed(1) || 0}W</b></span>
            <small>Neural Correction</small>
          </div>
          <i>=</i>
          <div className="eq-col total-highlight">
            <span>P<sub>total</sub> <b>{metrics.power?.toFixed(1) || 0}W</b></span>
            <small>Total Battery Drain</small>
          </div>
        </div>
      </div>

      {/* Causal Risk Attribution Bars (Plain-English SHAP waterfall) */}
      <div className="xai-factors">
        <div className="xai-factors-label">
          <span>KEY FACTORS INFLUENCING SAFETY RISK</span>
          <small>Which conditions are pushing risk higher</small>
        </div>
        <div className="xai-bars">
          {Object.entries(xai)
            .filter(([_, val]) => val > 0)
            .slice(0, 6)
            .map(([key, val]) => (
              <div key={key} className="xai-bar-row">
                <span className="xai-key">{factorLabels[key] || key}</span>
                <div className="xai-bar-track">
                  <i
                    style={{
                      width: `${val}%`,
                      backgroundColor: factorColors[key] || '#3498db',
                    }}
                  />
                </div>
                <span className="xai-pct">{val}%</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
