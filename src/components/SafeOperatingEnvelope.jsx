import React from 'react';
import { Shield, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

/**
 * 6-Axis Polar Safe Operating Envelope (SOE) Visualizer
 * IEEE RAS HackFusion 2026 - Theme 3
 * Explains multi-dimensional safety boundaries in clear, intuitive terms.
 */
export default function SafeOperatingEnvelope({ soe, risk }) {
  if (!soe || !soe.axes) return null;

  const cx = 130;
  const cy = 105;
  const radius = 72;
  const axes = soe.axes; // 6 axes
  const n = axes.length;

  const axisFriendlyLabels = {
    'WIND': 'Wind (<32km/h)',
    'TURB': 'Turbulence',
    'TEMP': 'Temp (<58°C)',
    'STRESS': 'Frame Stress',
    'DEGRAD': 'Motor Wear',
    'BATT': 'Battery (>20%)',
  };

  // Calculate polygon vertices
  const getCoords = (index, valueRatio) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = radius * Math.min(1.25, Math.max(0.08, valueRatio));
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  // Boundary polygon at ratio = 1.0 (Safe Limit)
  const boundaryPoints = axes
    .map((_, i) => getCoords(i, 1.0).join(','))
    .join(' ');

  // Live state polygon
  const livePoints = axes
    .map((a, i) => getCoords(i, a.ratio).join(','))
    .join(' ');

  const statusTone =
    soe.status === 'BREACHED' ? 'red' : soe.status === 'MARGINAL' ? 'amber' : 'green';

  const statusExplanation =
    soe.status === 'BREACHED'
      ? 'CRITICAL LIMIT BREACHED · Immediate Action Required'
      : soe.status === 'MARGINAL'
      ? 'CAUTION · Approaching Safety Envelope Boundary'
      : 'ALL SYSTEMS NOMINAL · Safe Operating Envelope';

  return (
    <div className="soe-widget">
      <div className="soe-header">
        <div>
          <div className="soe-title">
            <Shield size={13} />
            <b>FLIGHT SAFETY ENVELOPE (SOE)</b>
          </div>
          <small className="soe-subtext">Green = Safe zone. Red dashed line = Danger limit</small>
        </div>
        <span className={`pill ${statusTone}`} title={statusExplanation}>
          {soe.status === 'BREACHED' ? (
            <AlertTriangle size={10} />
          ) : (
            <CheckCircle2 size={10} />
          )}
          {soe.status}
        </span>
      </div>

      <div className="soe-body">
        <svg viewBox="0 0 260 210" className="soe-radar" role="img" aria-label="Safe operating envelope polar chart">
          <defs>
            <radialGradient id="soeGlow">
              <stop offset="0%" stopColor="#1e90ff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#1e90ff" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Web grid lines */}
          {[0.25, 0.5, 0.75, 1.0].map((ring) => (
            <polygon
              key={ring}
              points={axes.map((_, i) => getCoords(i, ring).join(',')).join(' ')}
              fill="none"
              stroke={ring === 1.0 ? '#ef5757' : '#d2dee6'}
              strokeWidth={ring === 1.0 ? 1.5 : 1}
              strokeDasharray={ring === 1.0 ? '4 3' : undefined}
            />
          ))}

          {/* Radial Spokes */}
          {axes.map((_, i) => {
            const [x, y] = getCoords(i, 1.15);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2ebf0" strokeWidth="1" />;
          })}

          {/* Boundary Fill */}
          <polygon points={boundaryPoints} fill="url(#soeGlow)" />

          {/* Current Live Operating State Polygon */}
          <polygon
            points={livePoints}
            fill={soe.status === 'BREACHED' ? 'rgba(235, 87, 87, 0.28)' : 'rgba(38, 166, 154, 0.28)'}
            stroke={soe.status === 'BREACHED' ? '#e74c3c' : '#26a69a'}
            strokeWidth={2}
          />

          {/* Live Node Points and Labels */}
          {axes.map((axis, i) => {
            const [lx, ly] = getCoords(i, axis.ratio);
            const [tx, ty] = getCoords(i, 1.28);
            const isBreached = axis.ratio > 1.0;
            const shortName = axis.name.split(' ')[0].toUpperCase();
            const friendlyName = axisFriendlyLabels[shortName] || shortName;

            return (
              <g key={axis.name}>
                <circle
                  cx={lx}
                  cy={ly}
                  r={isBreached ? 4.5 : 3.5}
                  fill={isBreached ? '#e74c3c' : '#26a69a'}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="7.5"
                  fontFamily="'DM Mono', monospace"
                  fontWeight="600"
                  fill={isBreached ? '#d32f2f' : '#476375'}
                >
                  {friendlyName}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Marginal Limits Breakdown List */}
        <div className="soe-metric-list">
          {axes.map((a) => (
            <div key={a.name} className="soe-item">
              <span className="soe-item-name">{a.name}</span>
              <div className="soe-item-bar">
                <i
                  style={{ width: `${Math.min(100, Math.round(a.ratio * 100))}%` }}
                  className={a.ratio > 1.0 ? 'red' : a.ratio > 0.8 ? 'amber' : 'green'}
                />
              </div>
              <span className="soe-item-val">
                {typeof a.current === 'number' ? a.current.toFixed(0) : a.current} {a.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
