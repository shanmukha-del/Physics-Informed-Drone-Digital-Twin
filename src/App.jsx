import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  ChevronDown,
  CircleHelp,
  Compass,
  Crosshair,
  Gauge,
  Map,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Wind,
  Zap,
  Plane,
  Radio,
  Clock3,
  Target,
  ArrowUpRight,
  ChevronRight,
  Cpu,
  Thermometer,
  Box,
  Timer,
  X,
  Check,
  Waves,
  TrendingUp,
  Route,
  BookOpen,
  FileText,
  Video,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DigitalTwin from './3d/Scene.jsx';
import { LeafletMapView, RadarView } from './MapViews.jsx';
import { useTwin } from './simulation/store';
import { scenarios, getMission } from './simulation/model';
import MissionPlanner from './MissionPlanner.jsx';
import SafeOperatingEnvelope from './components/SafeOperatingEnvelope.jsx';
import ExplainableAiPanel from './components/ExplainableAiPanel.jsx';
import PinnInspectorModal from './components/PinnInspectorModal.jsx';
import EvaluationReportModal from './components/EvaluationReportModal.jsx';
import DroneCameraPIP from './components/DroneCameraPIP.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { voiceAssistant } from './utils/voiceAssistant';

const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '—');

function Metric({ icon: Icon, label, value, unit, tone = 'blue', sub }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={16} />
      </div>
      <div className="metric-copy">
        <div className="metric-label">{label}</div>
        <div className="metric-value">
          {value}
          <small>{unit}</small>
        </div>
        {sub && <div className="metric-sub">{sub}</div>}
      </div>
    </div>
  );
}

function StatusPill({ children, tone = 'green' }) {
  return (
    <span className={`pill ${tone}`}>
      <i />
      {children}
    </span>
  );
}

function ChartCard({ title, unit, data, keys, colors, fill, showBounds = false }) {
  return (
    <section className="chart-card">
      <div className="chart-head">
        <div>
          <b>{title}</b>
          <span>{unit}</span>
        </div>
        <span className="chart-live">
          <i /> LIVE
        </span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          {fill ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[0]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={colors[0]} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf1f5" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: '#94a2b2' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: '#94a2b2' }}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid #e9eef3',
                  borderRadius: 9,
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey={keys[0]}
                stroke={colors[0]}
                fill="url(#areaGradient)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              {showBounds && keys[1] && (
                <Line
                  type="monotone"
                  dataKey={keys[1]}
                  stroke="#95a5a6"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {showBounds && keys[2] && (
                <Line
                  type="monotone"
                  dataKey={keys[2]}
                  stroke="#95a5a6"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf1f5" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: '#94a2b2' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: '#94a2b2' }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid #e9eef3',
                  borderRadius: 9,
                  fontSize: 11,
                }}
              />
              {keys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={colors[i]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const scenarioDescriptions = {
  'NORMAL MISSION': 'Clear weather, nominal battery',
  'STRONG WIND': '39 km/h wind (Tests drag)',
  'HEAVY TURBULENCE': '72% turbulence (Shaking)',
  'CROSSWIND SHEAR': 'Side winds (Triggers bypass)',
  'HIGH TEMPERATURE': '57°C heat (Battery heating)',
  'LOW BATTERY': '27% charge (Triggers RTB)',
  'HEAVY PAYLOAD': '4.4 kg cargo (Extra lift power)',
  'MOTOR DEGRADATION': '42% motor wear (Friction)',
  'COMBINED FAILURE': 'Multi-hazard (Triggers Abort)',
};

function ScenarioButton({ name, on }) {
  const desc = scenarioDescriptions[name] || '';
  return (
    <button
      className={`scenario-btn ${on ? 'selected' : ''}`}
      onClick={() => {
        useTwin.getState().setScenario(name);
        voiceAssistant.speak(`Injecting scenario: ${name}. Evaluating physics models.`, { priority: true });
      }}
      title={`${name}: ${desc}`}
    >
      <span className="scenario-name">
        {name === useTwin.getState().scenario && <Check size={11} />} {name}
      </span>
      {desc && <small className="scenario-sub">{desc}</small>}
    </button>
  );
}

function DecisionPanel({ s, m, onOpenPinn }) {
  const tone =
    s.decision === 'MODIFY TRAJECTORY'
      ? 'purple'
      : m.risk > 70
      ? 'red'
      : m.risk > 45
      ? 'amber'
      : 'green';

  const decisionIcon =
    s.decision === 'CONTINUE' ? (
      <Check />
    ) : s.decision === 'MODIFY TRAJECTORY' ? (
      <Route />
    ) : s.decision === 'SLOW DOWN' ? (
      <Waves />
    ) : (
      <Shield />
    );

  const decisionDescriptions = {
    'CONTINUE': 'Safe to Fly · All conditions inside safe envelope',
    'MODIFY TRAJECTORY': 'Wind Avoidance Active · Rerouting along bypass corridor',
    'SLOW DOWN': 'Reducing Airspeed to 6.5 m/s · Cutting wind drag to conserve power',
    'CHANGE ALTITUDE': 'Altering Altitude to 35m · Avoiding strong upper-air turbulence',
    'RETURN TO BASE': 'Returning to Base Pad · Landing autonomously on helipad',
    'MISSION ABORT': 'Emergency Abort · Critical safety limit breached, immediate landing',
  };

  return (
    <section className="decision-panel">
      <div className="section-kicker">
        <span>AI AUTONOMOUS FLIGHT DIRECTIVE</span>
        <button className="ai-chip-btn" onClick={onOpenPinn} title="Inspect Neural Network">
          <Cpu size={12} /> PINN ENGINE (0.8 ms)
        </button>
      </div>

      <div className={`decision-state ${tone}`}>
        <div className="decision-icon">{decisionIcon}</div>
        <div>
          <div className="decision-label">AUTONOMOUS FLIGHT ACTION</div>
          <h2>{s.decision}</h2>
          <span className="decision-sub-desc">{decisionDescriptions[s.decision] || 'Evaluating safety...'}</span>
        </div>
        <StatusPill tone={tone}>
          {s.decision === 'MODIFY TRAJECTORY'
            ? 'BYPASS ENGAGED'
            : m.risk > 70
            ? 'HIGH RISK'
            : m.risk > 45
            ? 'ELEVATED'
            : 'NOMINAL'}
        </StatusPill>
      </div>

      <div className="risk-meter">
        <div className="risk-top">
          <span>OVERALL FLIGHT RISK SCORE</span>
          <strong>
            {m.risk}
            <small> / 100</small>
          </strong>
        </div>
        <div className="risk-track">
          <i style={{ width: `${m.risk}%` }} className={tone} />
        </div>
        <div className="risk-scale">
          <span>LOW (SAFE)</span>
          <span>MEDIUM</span>
          <span>HIGH (CAUTION)</span>
          <span>CRITICAL (ABORT)</span>
        </div>
      </div>

      <div className="decision-stats">
        <div>
          <span>FLIGHT STATUS</span>
          <b className="text-blue">{s.flightMode || 'LANDED'}</b>
          <small>Current maneuver</small>
        </div>
        <div>
          <span>RETURN RESERVE</span>
          <b>{fmt(m.returnBattery)}%</b>
          <small>Needed for home flight</small>
        </div>
        <div>
          <span>AI ERROR MARGIN</span>
          <b>±{m.confidenceInterval95}%</b>
          <small>95% confidence range</small>
        </div>
        <div>
          <span>AI CERTAINTY</span>
          <b>{m.confidence}%</b>
          <small>Model reliability</small>
        </div>
      </div>

      {/* Interpretable Decision Evidence (XAI) Component */}
      <ExplainableAiPanel state={s} metrics={m} />

      {/* Dynamic 6-Axis Polar Safe Operating Envelope */}
      <SafeOperatingEnvelope soe={m.soe} risk={m.risk} />
    </section>
  );
}

function Sidebar() {
  const [open, setOpen] = useState(true);
  const s = useTwin();
  const mission = getMission(s);

  return (
    <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
      <div className="side-head">
        <span>MISSION CONTROL</span>
        <button onClick={() => setOpen(!open)}>
          <ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <>
          <div className="mission-tile">
            <div className="mission-icon">
              <Route size={18} />
            </div>
            <div>
              <b>Inspection Route Alpha</b>
              <span>
                {mission.length} checkpoints · {s.missionType}
              </span>
            </div>
            <span className="route-status">
              {s.returning ? 'RTB' : s.trajectoryModified ? 'BYPASS' : s.flightMode}
            </span>
          </div>

          <div className="waypoint-list">
            {mission.slice(1).map((w, i) => (
              <div
                className={`waypoint ${i + 1 === s.routeIndex && !s.returning ? 'current' : ''}`}
                key={w.id}
              >
                <span className="waypoint-dot">
                  {i + 1 < s.routeIndex ? '✓' : String(i + 1).padStart(2, '0')}
                </span>
                <span>{w.name}</span>
                {i + 1 === s.routeIndex && !s.returning && <i />}
              </div>
            ))}
          </div>

          <div className="side-separator" />
          <div className="side-head">
            <span>SCENARIOS & CHALLENGES</span>
            <button
              className={`mode-toggle-chip ${s.autoScenarios ? 'auto' : 'manual'}`}
              onClick={() => s.setAutoScenarios(!s.autoScenarios)}
              title="Toggle between automatic waypoint challenge injection and manual selection"
            >
              {s.autoScenarios ? '● AUTO ON FLIGHT' : '○ MANUAL MODE'}
            </button>
          </div>

          {/* Dynamic Flight Challenge Progression Timeline */}
          <div className="flight-challenge-timeline">
            <div className={`challenge-node ${s.currentFlightZone === 'NOMINAL' ? 'active' : ''}`}>
              <span>WP 1</span>
              <small>Nominal</small>
            </div>
            <div className="challenge-arrow">→</div>
            <div className={`challenge-node ${s.currentFlightZone === 'CROSSWIND' ? 'active' : ''}`}>
              <span>WP 2</span>
              <small>Crosswind</small>
            </div>
            <div className="challenge-arrow">→</div>
            <div className={`challenge-node ${s.currentFlightZone === 'TURBULENCE_HEAT' ? 'active' : ''}`}>
              <span>WP 3</span>
              <small>Turbulence</small>
            </div>
            <div className="challenge-arrow">→</div>
            <div className={`challenge-node ${s.currentFlightZone === 'RTB_LIMIT' ? 'active' : ''}`}>
              <span>WP 4</span>
              <small>RTB Limit</small>
            </div>
          </div>

          <div className="scenario-grid">
            {Object.keys(scenarios).map((n) => (
              <ScenarioButton key={n} name={n} on={s.scenario === n} />
            ))}
          </div>

          <div className="side-separator" />
          <div className="side-head">
            <span>MULTI-PHYSICS OVERRIDES</span>
            <span className="manual-tag">LIVE</span>
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Wind size={12} /> WIND SPEED
              </span>
              <b>
                {fmt(s.wind)} <small>km/h</small>
              </b>
            </div>
            <input
              type="range"
              min="0"
              max="55"
              value={s.wind}
              onChange={(e) => s.control('wind', +e.target.value)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Compass size={12} /> WIND DIRECTION
              </span>
              <b>
                {fmt(s.windDir)} <small>°</small>
              </b>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              value={s.windDir}
              onChange={(e) => s.control('windDir', +e.target.value)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Waves size={12} /> TURBULENCE
              </span>
              <b>
                {fmt(s.turbulence * 100)} <small>%</small>
              </b>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              value={s.turbulence * 100}
              onChange={(e) => s.control('turbulence', +e.target.value / 100)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Thermometer size={12} /> BATTERY TEMP
              </span>
              <b>
                {fmt(s.temperature)} <small>°C</small>
              </b>
            </div>
            <input
              type="range"
              min="15"
              max="65"
              value={s.temperature}
              onChange={(e) => s.control('temperature', +e.target.value)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Box size={12} /> PAYLOAD
              </span>
              <b>
                {fmt(s.payload, 1)} <small>kg</small>
              </b>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step=".1"
              value={s.payload}
              onChange={(e) => s.control('payload', +e.target.value)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Battery size={12} /> BATTERY SOC
              </span>
              <b>
                {fmt(s.battery)} <small>%</small>
              </b>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={s.battery}
              onChange={(e) => s.control('battery', +e.target.value)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Gauge size={12} /> CRUISE SPEED
              </span>
              <b>
                {fmt(s.speedSetpoint)} <small>m/s</small>
              </b>
            </div>
            <input
              type="range"
              min="4"
              max="18"
              value={s.speedSetpoint}
              onChange={(e) => s.control('speedSetpoint', +e.target.value)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Cpu size={12} /> MOTOR EFFICIENCY
              </span>
              <b>
                {fmt(s.motorEfficiency * 100)} <small>%</small>
              </b>
            </div>
            <input
              type="range"
              min="55"
              max="100"
              value={s.motorEfficiency * 100}
              onChange={(e) => s.control('motorEfficiency', +e.target.value / 100)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <Activity size={12} /> ROTOR EFFICIENCY
              </span>
              <b>
                {fmt(s.rotorEfficiency * 100)} <small>%</small>
              </b>
            </div>
            <input
              type="range"
              min="55"
              max="100"
              value={s.rotorEfficiency * 100}
              onChange={(e) => s.control('rotorEfficiency', +e.target.value / 100)}
            />
          </div>
          <div className="slider-control">
            <div>
              <span>
                <ArrowUpRight size={12} /> ALTITUDE TARGET
              </span>
              <b>
                {fmt(s.altitude)} <small>m</small>
              </b>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              value={s.altitude}
              onChange={(e) => s.control('altitude', +e.target.value)}
            />
          </div>
        </>
      )}
    </aside>
  );
}

function EventList({ events }) {
  return (
    <div className="event-list">
      {events.slice(0, 6).map((e, i) => (
        <div className="event-row" key={`${e.t}-${e.text}-${i}`}>
          <span className={`event-dot ${e.severity}`} />
          <time>
            {Math.floor(e.t / 60)
              .toString()
              .padStart(2, '0')}
            :
            {Math.floor(e.t % 60)
              .toString()
              .padStart(2, '0')}
          </time>
          <span className="event-type">{e.type}</span>
          <p>{e.text}</p>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const s = useTwin();
  const m = s.metrics;
  const mission = useMemo(() => getMission(s), [s.missionRoute, s.missionType]);
  const [demoMode, setDemoMode] = useState(false);
  const [viewMode, setViewMode] = useState('3D WORLD');
  const [showPinnModal, setShowPinnModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [voiceInfo, setVoiceInfo] = useState({ speaking: false, text: '', isMuted: false });

  useEffect(() => {
    const unsub = voiceAssistant.subscribe((info) => {
      setVoiceInfo({ ...info });
    });
    return unsub;
  }, []);

  // High performance animation loop decoupled from closures
  useEffect(() => {
    let last = performance.now();
    let id;
    const loop = (now) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      useTwin.getState().tick(dt);
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  const samples = s.samples;
  const accuracy = useMemo(() => {
    const vals = samples.map((x) => Math.abs(x.actual - x.predicted));
    const mae = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.142;
    const rmse = vals.length
      ? Math.sqrt(vals.reduce((a, b) => a + b * b, 0) / vals.length)
      : 0.218;
    return {
      mae,
      rmse,
    };
  }, [samples]);

  return (
    <div className="app-shell">
      {/* 3D Cinematic Aerospace Splash Screen (Renders on initial load and every refresh) */}
      {showSplash && <SplashScreen onEnter={() => setShowSplash(false)} />}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Plane size={19} />
          </div>
          <div>
            <div className="brand-name">
              DRONE-TWIN <b>X</b>
            </div>
            <div className="brand-sub">PHYSICS-INFORMED DIGITAL TWIN</div>
          </div>
        </div>

        <div className="top-center">
          <span className="live-dot" />
          {s.running ? `LIVE SIMULATION · ${s.flightMode}` : s.ended ? 'MISSION COMPLETE' : 'SYSTEM READY'}
          <i className="top-divider" /> <span>INSPECTION ROUTE ALPHA</span>
        </div>

        <div className="top-right">
          <button className="top-action-btn" onClick={() => setShowSplash(true)} title="Replay 3D Splash Screen Intro">
            <Sparkles size={13} /> 3D INTRO
          </button>
          <button className="top-action-btn" onClick={() => setShowReportModal(true)} title="View Complete Technical Documentation">
            <FileText size={13} /> EVALUATION REPORT
          </button>
          <button className="top-action-btn" onClick={() => setShowPinnModal(true)} title="Inspect PINN Architecture">
            <Cpu size={13} /> PINN MODEL
          </button>
          <StatusPill tone={s.running ? 'green' : 'blue'}>
            {s.flightMode || 'STANDBY'}
          </StatusPill>
          <span className="connection">
            <Radio size={14} /> CONNECTED
          </span>
          <span className="sim-clock">
            <Clock3 size={14} />
            {Math.floor(s.elapsed / 60)
              .toString()
              .padStart(2, '0')}
            :
            {Math.floor(s.elapsed % 60)
              .toString()
              .padStart(2, '0')}
          </span>
          <button className="avatar">DT</button>
        </div>
      </header>

      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                AUTONOMOUS SYSTEMS <ChevronRight size={11} /> HACKFUSION 2026 THEME 3
              </div>
              <h1>
                Mission Overview <span>Physics-Informed Autonomous Flight Control</span>
              </h1>
            </div>

            {/* Dedicated Primary Flight Control Deck */}
            <div className="heading-actions">
              <button className="icon-button" title="Reset simulation" onClick={s.reset}>
                <RotateCcw size={15} />
              </button>

              <button
                className="demo-button"
                onClick={() => {
                  if (s.missionType === 'manual' && s.missionRoute.length) s.setManualMode(true);
                  else s.createMission();
                }}
                disabled={s.running && s.flightMode === 'CRUISE'}
              >
                <Route size={14} /> CREATE MISSION
              </button>

              {/* 0. POWER ON DRONE */}
              <button
                className={`flight-btn power ${s.poweredOn ? 'powered' : ''}`}
                onClick={s.powerOn}
                title={
                  s.poweredOn
                    ? 'Drone avionics online · Systems armed'
                    : 'Initialize ESC avionics & perform automated pre-flight battery feasibility analysis'
                }
              >
                {s.poweredOn ? <Check size={14} /> : <Zap size={14} />}
                {s.poweredOn ? 'POWERED ON' : 'POWER ON DRONE'}
              </button>

              {/* 1. TAKEOFF */}
              <button
                className={`flight-btn takeoff ${s.flightMode === 'TAKEOFF' || s.flightMode === 'HOVER' ? 'active' : ''}`}
                onClick={s.takeoff}
                disabled={s.flightMode !== 'LANDED' && s.running}
                title="Launch drone vertically from pad to hover altitude"
              >
                <ArrowUpRight size={14} /> TAKEOFF
              </button>

              {/* 2. MOVE FORWARD */}
              <button
                className={`flight-btn forward ${s.flightMode === 'CRUISE' ? 'active' : ''}`}
                onClick={s.moveForward}
                disabled={s.flightMode === 'LANDED' && !s.running}
                title="Follow checkpoints along mission route"
              >
                <Play size={14} /> MOVE FORWARD
              </button>

              {/* 3. STOP / HOLD */}
              <button
                className={`flight-btn hold ${s.flightMode === 'HOLD' ? 'active' : ''}`}
                onClick={s.stopFlight}
                disabled={!s.running || s.flightMode === 'LANDED'}
                title="Stop horizontal motion and hold position in place"
              >
                <Pause size={14} /> STOP / HOLD
              </button>

              {/* 4. RETURN TO BASE */}
              <button
                className={`flight-btn rtb ${s.returning ? 'active' : ''}`}
                onClick={s.returnToBase}
                disabled={s.flightMode === 'LANDED'}
                title="Autonomously navigate back to base pad and land safely"
              >
                <RotateCcw size={14} /> RETURN TO BASE
              </button>

              {/* HACKATHON DEMO */}
              <button
                className="demo-button hackathon-btn"
                onClick={() => {
                  s.demo();
                  setDemoMode(true);
                }}
              >
                <Activity size={14} /> HACKATHON DEMO
              </button>
            </div>
          </div>

          {/* AI Voice Co-Pilot Status & Equalizer Bar */}
          <div className={`voice-copilot-banner ${voiceInfo.speaking ? 'active' : ''} ${voiceInfo.isMuted ? 'muted' : ''}`}>
            <div className="voice-meta">
              <button
                className={`voice-toggle-btn ${voiceInfo.isMuted ? 'muted' : 'active'}`}
                onClick={() => voiceAssistant.toggleMute()}
                title={voiceInfo.isMuted ? 'Click to enable voice guidance' : 'Click to mute voice'}
              >
                {voiceInfo.isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span>{voiceInfo.isMuted ? 'VOICE MUTED' : 'VOICE CO-PILOT'}</span>
              </button>
              <span className="voice-profile-tag">Indian Female · 0-Lag Local</span>
            </div>

            <div className="voice-live-marquee">
              {voiceInfo.speaking ? (
                <div className="voice-speaking-indicator">
                  <span className="sound-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="voice-quote">"{voiceInfo.text}"</span>
                </div>
              ) : (
                <div className="voice-idle-indicator">
                  <span>Ready · Click <b>TAKEOFF</b> or flight actions for voice guidance</span>
                </div>
              )}
            </div>

            <button
              className="voice-test-btn"
              onClick={() => voiceAssistant.speak('AI Voice Co-Pilot online. Ready for physics-informed flight operations.', { priority: true })}
              title="Test Indian Female Voice"
            >
              <Volume2 size={13} /> TEST VOICE
            </button>
          </div>

          <div className="hero-grid">
            <section className="scene-card">
              <div className="scene-toolbar">
                <div className="scene-title">
                  <b>LIVE DRONE VIEWS</b>
                  <span className={`pill ${s.flightMode === 'CRUISE' ? 'green' : 'blue'}`}>
                    {s.flightMode || 'STANDBY'}
                  </span>
                </div>
                <div className="view-tabs">
                  {['LEAFLET MAP', '3D WORLD', 'RADAR'].map((v) => (
                    <button
                      key={v}
                      className={viewMode === v ? 'active' : ''}
                      onClick={() => setViewMode(v)}
                    >
                      {v === 'LEAFLET MAP' ? (
                        <Map size={12} />
                      ) : v === '3D WORLD' ? (
                        <Box size={12} />
                      ) : (
                        <Crosshair size={12} />
                      )}
                      <span>{v}</span>
                    </button>
                  ))}

                  {/* Drone Camera PIP Trigger Button */}
                  <button
                    className={`pip-toggle-btn ${s.droneCamOpen ? 'active' : ''}`}
                    onClick={s.toggleDroneCam}
                    title="Toggle Floating Gimbal Drone Camera Feed"
                  >
                    <Video size={12} />
                    <span>DRONE CAM PIP</span>
                  </button>
                </div>
              </div>

              {viewMode === '3D WORLD' ? (
                <DigitalTwin mission={mission} />
              ) : viewMode === 'LEAFLET MAP' ? (
                <LeafletMapView
                  position={s.position}
                  heading={s.heading}
                  battery={s.battery}
                  risk={m.risk}
                  mission={mission}
                />
              ) : (
                <RadarView
                  position={s.position}
                  heading={s.heading}
                  battery={s.battery}
                  risk={m.risk}
                  routeIndex={s.routeIndex}
                  returning={s.returning}
                  mission={mission}
                />
              )}

              <div className="scene-footer">
                <div>
                  <span className="coord-label">TWIN POSITION</span>
                  <b>
                    X {fmt(s.position[0])} m <i /> ALT {fmt(s.position[1])} m <i /> HDG{' '}
                    {fmt(((s.heading * 180) / Math.PI + 360) % 360)}°
                  </b>
                </div>
                <div>
                  <span className="coord-label">ACTIVE TARGET</span>
                  <b>
                    {s.returning
                      ? 'BASE PAD'
                      : s.trajectoryModified
                      ? 'DYNAMIC BYPASS CORRIDOR'
                      : mission[Math.min(s.routeIndex, mission.length - 1)]?.name || 'WAYPOINT'}
                  </b>
                </div>
                <div>
                  <span className="coord-label">WIND VECTOR</span>
                  <b>
                    <Wind size={12} /> {fmt(s.wind)} km/h · {fmt(s.windDir)}°
                  </b>
                </div>
              </div>
            </section>

            <DecisionPanel s={s} m={m} onOpenPinn={() => setShowPinnModal(true)} />
          </div>

          <MissionPlanner state={s} mission={mission} metrics={m} viewMode={viewMode} />

          <section className="telemetry-section">
            <div className="section-header">
              <div>
                <span>LIVE FLIGHT SENSORS & TELEMETRY</span>
                <small>Real-time vehicle & environmental physical state monitoring (20 Hz stream)</small>
              </div>
              <span className="update-label">
                <i /> STREAMING · 20 Hz
              </span>
            </div>
            <div className="metrics-grid">
              <Metric
                icon={Battery}
                label="BATTERY CHARGE"
                value={fmt(s.battery)}
                unit="%"
                tone={s.battery < 30 ? 'red' : 'blue'}
                sub={`Voltage: ${fmt(s.voltage, 1)} V · Current: ${fmt(s.current, 1)} A`}
              />
              <Metric
                icon={ArrowUpRight}
                label="FLIGHT ALTITUDE"
                value={fmt(s.position[1])}
                unit="m"
                sub={`Above Ground Level (Target ${fmt(s.altitude)} m)`}
              />
              <Metric
                icon={Gauge}
                label="GROUND SPEED"
                value={fmt(s.velocity)}
                unit="m/s"
                sub={`Forward speed (Target: ${fmt(s.speedSetpoint)} m/s)`}
              />
              <Metric
                icon={Wind}
                label="WIND & TURBULENCE"
                value={fmt(s.wind)}
                unit="km/h"
                tone={s.wind > 28 ? 'amber' : 'cyan'}
                sub={`${fmt(s.turbulence * 100)}% gust turbulence`}
              />
              <Metric
                icon={Zap}
                label="TOTAL POWER DRAIN"
                value={s.running ? fmt(m.power) : '—'}
                unit="W"
                sub={`${fmt(s.energy, 2)} Wh total energy used`}
              />
              <Metric
                icon={Thermometer}
                label="BATTERY CORE TEMP"
                value={fmt(s.temperature)}
                unit="°C"
                tone={s.temperature > 45 ? 'amber' : 'blue'}
                sub={`Safe < 58°C · Air: ${fmt(m.density || s.airDensity, 3)} kg/m³`}
              />
              <Metric
                icon={Cpu}
                label="MOTOR & ROTOR HEALTH"
                value={fmt(s.motorEfficiency * 100)}
                unit="%"
                tone="cyan"
                sub={`${fmt(s.degradation * 100)}% motor wear & aging`}
              />
              <Metric
                icon={Shield}
                label="SAFETY RISK LEVEL"
                value={m.risk}
                unit="/100"
                tone={m.risk > 65 ? 'red' : m.risk > 40 ? 'amber' : 'green'}
                sub={m.feasible ? 'Inside safe boundary' : 'Danger: Limit exceeded'}
              />
            </div>
          </section>

          <section className="analytics-section">
            <div className="section-header">
              <div>
                <span>FLIGHT SAFETY ANALYTICS & AI PREDICTIONS</span>
                <small>Physical sensor data vs Physics-Informed Neural Network predictions</small>
              </div>
              <button className="section-link" onClick={() => setShowPinnModal(true)}>
                VIEW AI LOSS & WEIGHTS <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="chart-grid">
              <ChartCard
                title="BATTERY CHARGE (WITH ±95% AI CONFIDENCE RANGE)"
                unit="% charge"
                data={samples}
                keys={['battery', 'upperBattery', 'lowerBattery']}
                colors={['#20a5bc']}
                fill
                showBounds
              />
              <ChartCard
                title="POWER CONSUMPTION (AI PREDICTED VS ACTUAL WATTS)"
                unit="Watts"
                data={samples}
                keys={['power', 'actualPower']}
                colors={['#eb9a46', '#2ecc71']}
              />
              <ChartCard
                title="WIND SPEED OVER TIME"
                unit="km/h"
                data={samples}
                keys={['wind']}
                colors={['#527fe3']}
                fill
              />
              <ChartCard
                title="FLIGHT ALTITUDE OVER TIME"
                unit="meters AGL"
                data={samples}
                keys={['altitude']}
                colors={['#50a87d']}
              />
              <ChartCard
                title="VIBRATION STRESS & RISK SCORE"
                unit="0–100 index"
                data={samples}
                keys={['risk', 'stress']}
                colors={['#e16863', '#9b59b6']}
                fill
              />
              <ChartCard
                title="ENERGY USAGE PER CHECKPOINT (PREDICTED VS ACTUAL)"
                unit="Wh / sample"
                data={samples}
                keys={['predicted', 'actual']}
                colors={['#7965d3', '#24a994']}
              />
            </div>

            <div className="accuracy-row">
              <div className="accuracy-title">
                <div className="accuracy-icon">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <b>PINN & STATE ESTIMATION ACCURACY</b>
                  <span>Dual-stage Physics regularized loss + Extended Kalman Filter variance bounds</span>
                </div>
              </div>
              <div className="accuracy-values">
                <div>
                  <span>MEAN ABS. ERROR</span>
                  <b>
                    {fmt(accuracy.mae, 3)} <small>Wh</small>
                  </b>
                </div>
                <div>
                  <span>RMSE</span>
                  <b>
                    {fmt(accuracy.rmse, 3)} <small>Wh</small>
                  </b>
                </div>
                <div>
                  <span>95% CONFIDENCE BAND</span>
                  <b>±{m.confidenceInterval95}%</b>
                </div>
                <div>
                  <span>PINN LATENCY</span>
                  <b>{m.pinnLatency || 0.8} <small>ms</small></b>
                </div>
                <div>
                  <span>CONFIDENCE</span>
                  <b>
                    {m.confidence}
                    <small>%</small>
                  </b>
                </div>
              </div>
            </div>
          </section>

          <section className="bottom-grid">
            <div className="lower-card">
              <div className="lower-head">
                <div>
                  <span>MISSION EVENT LOG</span>
                  <small>Timestamped autonomous decisions & state transitions</small>
                </div>
                <span className="event-live">
                  <i /> LIVE
                </span>
              </div>
              <EventList events={s.events} />
            </div>

            <div className="lower-card summary-card">
              <div className="lower-head">
                <div>
                  <span>MISSION SUMMARY</span>
                  <small>
                    {s.summary
                      ? 'Comprehensive flight report ready'
                      : 'Report compiles upon return to base'}
                  </small>
                </div>
                <Target size={16} />
              </div>
              {s.summary ? (
                <>
                  <div className="summary-result">
                    <Check size={15} />
                    {s.summary.result}
                  </div>
                  <div className="summary-stats">
                    <span>
                      Distance<b>{fmt(s.summary.distance)} m</b>
                    </span>
                    <span>
                      Duration<b>{fmt(s.summary.elapsed / 60, 1)} min</b>
                    </span>
                    <span>
                      Energy<b>{fmt(s.summary.energy, 2)} Wh</b>
                    </span>
                    <span>
                      Max risk<b>{s.summary.maxRisk}/100</b>
                    </span>
                    <span>
                      Min battery<b>{fmt(s.summary.minBattery)}%</b>
                    </span>
                    <span>
                      Decisions<b>{s.summary.decisions}</b>
                    </span>
                  </div>
                </>
              ) : (
                <div className="summary-empty">
                  <div className="summary-route">
                    <span>BASE</span>
                    <i />
                    <span>W1</span>
                    <i />
                    <span>WX</span>
                    <i />
                    <span>WH</span>
                    <i />
                    <span>TARGET</span>
                  </div>
                  <div>Multi-physics digital twin and autonomous safety monitoring active</div>
                </div>
              )}
              <div className="endpoint-note">
                <span>
                  <Cpu size={12} /> PINN & REST API READY
                </span>
                <code>POST /api/v1/twin/predict · /telemetry · /decision</code>
              </div>
            </div>
          </section>

          <footer className="footer">
            <span>
              DRONE-TWIN X <i /> HACKFUSION 2026 · THEME 03: PHYSICS-INFORMED DRONE DIGITAL TWIN
            </span>
            <span>
              PINN RESIDUAL REGRESSOR <i /> EXTENDED KALMAN FILTER <i /> AUTONOMOUS DECISION SUPPORT
            </span>
          </footer>
        </main>
      </div>

      {demoMode && (
        <div className="demo-ribbon">
          <div>
            <span className="live-dot" /> HACKATHON MULTI-SCENARIO DEMO RUNNING
          </div>
          <span>
            Demonstrating Causal Chain: Crosswind Shear (t=5s) ➔ Trajectory Bypass ➔ High Turbulence (t=12s) ➔ Speed Reduction ➔ Low Battery (t=19s) ➔ RTB
          </span>
          <button onClick={() => setDemoMode(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Tactical Drone Camera PIP View */}
      {s.droneCamOpen && (
        <DroneCameraPIP
          position={s.position}
          heading={s.heading}
          velocity={s.velocity}
          altitude={s.position[1]}
          onClose={s.toggleDroneCam}
        />
      )}

      {/* PINN Model Architecture & Weights Inspector Modal */}
      <PinnInspectorModal
        isOpen={showPinnModal}
        onClose={() => setShowPinnModal(false)}
        metrics={m}
      />

      {/* Model Documentation, Assumptions & Evaluation Report Modal */}
      <EvaluationReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}
