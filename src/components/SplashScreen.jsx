import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Play, Shield, Cpu, Activity, Zap, Check, ChevronRight } from 'lucide-react';
import { playDroneBootChime } from '../utils/droneAudio';
import { voiceAssistant } from '../utils/voiceAssistant';

/**
 * 3D Drone Model for Splash Screen
 * Features continuous 360° cinematic rotation, smooth sine-wave hovering, and spinning propellers
 */
function SplashDrone() {
  const group = useRef();
  const rotorRef1 = useRef();
  const rotorRef2 = useRef();
  const rotorRef3 = useRef();
  const rotorRef4 = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (group.current) {
      // 360° cinematic rotation & gentle hovering float
      group.current.rotation.y = t * 0.45;
      group.current.position.y = Math.sin(t * 1.6) * 0.12;
      group.current.rotation.x = Math.sin(t * 0.9) * 0.04;
      group.current.rotation.z = Math.cos(t * 1.1) * 0.04;
    }

    // Spin propellers at high cinematic speed
    const spinSpeed = t * 28;
    if (rotorRef1.current) rotorRef1.current.rotation.y = spinSpeed;
    if (rotorRef2.current) rotorRef2.current.rotation.y = -spinSpeed;
    if (rotorRef3.current) rotorRef3.current.rotation.y = -spinSpeed;
    if (rotorRef4.current) rotorRef4.current.rotation.y = spinSpeed;
  });

  return (
    <group ref={group} position={[0, 0.15, 0]}>
      {/* 1. Carbon-Fiber Stealth Main Fuselage */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.74, 0.22, 1.08]} />
        <meshStandardMaterial color="#14181d" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Aerodynamic Top Canopy Shell */}
      <mesh position={[0, 0.13, -0.06]}>
        <boxGeometry args={[0.54, 0.09, 0.84]} />
        <meshStandardMaterial color="#212830" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Glowing Cyber Cyan Spine */}
      <mesh position={[0, 0.18, -0.06]}>
        <boxGeometry args={[0.11, 0.04, 0.74]} />
        <meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={1.4} />
      </mesh>

      {/* Dual Battery Pack Modules (Rear Deck) */}
      <mesh position={[0, 0.09, 0.38]}>
        <boxGeometry args={[0.6, 0.16, 0.32]} />
        <meshStandardMaterial color="#0b0e11" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Top RTK GNSS Mast & Antenna Puck */}
      <mesh position={[0, 0.26, 0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.34, 0.15]}>
        <cylinderGeometry args={[0.09, 0.09, 0.038, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.36, 0.15]}>
        <cylinderGeometry args={[0.04, 0.04, 0.015, 12]} />
        <meshStandardMaterial color="#00f2fe" emissive="#00f2fe" emissiveIntensity={1.2} />
      </mesh>

      {/* 2. 3-Axis Gimbal Optical 4K & Thermal Camera Pod */}
      <group position={[0, -0.15, -0.48]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.06, 12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Sapphire Glass Lens */}
        <mesh position={[0, -0.06, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
          <meshStandardMaterial
            color="#05101a"
            emissive="#00f2fe"
            emissiveIntensity={1.1}
            metalness={0.95}
            roughness={0.05}
          />
        </mesh>
        {/* Optical Sensor Status LED */}
        <mesh position={[0.08, -0.03, -0.07]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.8} />
        </mesh>
      </group>

      {/* 3. Four Heavy-Duty Carbon Tubular Arms & Motors */}
      {[
        { pos: [-0.94, 0.04, -0.94], angle: Math.PI / 4, isPort: true, isFront: true, ref: rotorRef1 },
        { pos: [0.94, 0.04, -0.94], angle: -Math.PI / 4, isPort: false, isFront: true, ref: rotorRef2 },
        { pos: [-0.94, 0.04, 0.94], angle: (3 * Math.PI) / 4, isPort: true, isFront: false, ref: rotorRef3 },
        { pos: [0.94, 0.04, 0.94], angle: -(3 * Math.PI) / 4, isPort: false, isFront: false, ref: rotorRef4 },
      ].map((arm, i) => (
        <group key={i}>
          {/* Diagonal Carbon Arm Tube */}
          <group position={[arm.pos[0] * 0.5, 0.02, arm.pos[2] * 0.5]} rotation={[0, arm.angle, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.042, 0.042, 1.45, 10]} />
              <meshStandardMaterial color="#111827" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>

          {/* Motor Pod Mount */}
          <group position={arm.pos}>
            {/* Clamp & Motor Bell */}
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[0.18, 0.07, 0.18]} />
              <meshStandardMaterial color="#1f2937" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.135, 0.135, 0.135, 16]} />
              <meshStandardMaterial color="#0f172a" metalness={0.95} roughness={0.2} />
            </mesh>
            {/* Stator Cooling Accent Ring */}
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.14, 0.14, 0.03, 16]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* FAA Aviation Navigation LEDs */}
            <mesh position={[0, -0.1, 0]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <meshStandardMaterial
                color={arm.isFront ? (arm.isPort ? '#ef4444' : '#22c55e') : '#3b82f6'}
                emissive={arm.isFront ? (arm.isPort ? '#ef4444' : '#22c55e') : '#3b82f6'}
                emissiveIntensity={2.0}
              />
            </mesh>

            {/* Propeller Blade Assembly */}
            <group ref={arm.ref} position={[0, 0.14, 0]}>
              <mesh>
                <cylinderGeometry args={[0.038, 0.038, 0.05, 10]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
              </mesh>
              {/* Dual Carbon Blades */}
              {[-1, 1].map((dir, bIdx) => (
                <mesh key={bIdx} position={[dir * 0.44, 0, 0]} rotation={[0.08 * dir, 0, 0]}>
                  <boxGeometry args={[0.82, 0.012, 0.08]} />
                  <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
                </mesh>
              ))}
              {/* Spinning Motion Blur Disc */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.08, 0.88, 24]} />
                <meshBasicMaterial
                  color="#38bdf8"
                  transparent
                  opacity={0.16}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* 4. Carbon-Fiber Landing Skids */}
      {[-0.46, 0.46].map((xSide, i) => (
        <group key={`skid-${i}`}>
          <mesh position={[xSide * 0.72, -0.16, -0.3]} rotation={[0, 0, xSide > 0 ? -0.35 : 0.35]}>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 8]} />
            <meshStandardMaterial color="#111827" metalness={0.85} />
          </mesh>
          <mesh position={[xSide * 0.72, -0.16, 0.3]} rotation={[0, 0, xSide > 0 ? -0.35 : 0.35]}>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 8]} />
            <meshStandardMaterial color="#111827" metalness={0.85} />
          </mesh>
          <mesh position={[xSide, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 1.25, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Concentric Cybernetic Rings & Energy Field on Pedestal
 */
function HolographicPedestal() {
  const ring1 = useRef();
  const ring2 = useRef();
  const ring3 = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ring1.current) ring1.current.rotation.z = t * 0.3;
    if (ring2.current) ring2.current.rotation.z = -t * 0.45;
    if (ring3.current) ring3.current.rotation.z = t * 0.15;
  });

  return (
    <group position={[0, -0.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer Solid Ring */}
      <mesh ref={ring1}>
        <ringGeometry args={[1.9, 1.95, 48]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Middle Rotating Cyan Radar Ring */}
      <mesh ref={ring2}>
        <ringGeometry args={[1.4, 1.48, 36]} />
        <meshBasicMaterial color="#00f2fe" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Inner Glowing Helipad Disc */}
      <mesh ref={ring3}>
        <ringGeometry args={[0.8, 0.86, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Circular Grid Surface */}
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[2.4, 32]} />
        <meshBasicMaterial color="#03111f" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * 3D Ambient Dust Particles
 */
function DustParticles({ count = 90 }) {
  const points = useMemo(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      coords[i * 3] = (Math.random() - 0.5) * 8;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 5;
      coords[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return coords;
  }, [count]);

  const pRef = useRef();
  useFrame((state) => {
    if (pRef.current) {
      pRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <points ref={pRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length / 3}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#38bdf8" transparent opacity={0.65} />
    </points>
  );
}

class SplashCanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn("Splash Canvas notice:", err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function SplashScreen({ onEnter }) {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const steps = [
    { title: 'AERODYNAMIC ATMOSPHERIC MODEL', detail: 'Barometric Density & Wind Shear Vector' },
    { title: 'PINN NEURAL REGRESSOR', detail: 'Hover Power + Parasitic Drag + GELU AI Residual' },
    { title: '6-AXIS SAFE OPERATING ENVELOPE', detail: 'Real-Time Dynamic Stress & Stability Bounds' },
    { title: 'EXTENDED KALMAN FILTER (EKF)', detail: 'Battery SoC & Motor Degradation Estimator' },
    { title: 'AI INDIAN VOICE CO-PILOT', detail: 'Offline 0-Lag Real-Time Voice Advisory System' },
  ];

  // Smooth loading progression (completes in ~2.8s)
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        const next = p + 2;
        if (next > 20 && next <= 40) setActiveStep(1);
        else if (next > 40 && next <= 60) setActiveStep(2);
        else if (next > 60 && next <= 80) setActiveStep(3);
        else if (next > 80) setActiveStep(4);
        return next;
      });
    }, 45);

    return () => clearInterval(timer);
  }, []);

  const handleEnter = () => {
    if (isExiting) return;
    setIsExiting(true);
    // Play realistic electronic chime
    playDroneBootChime();
    // Voice welcome
    setTimeout(() => {
      voiceAssistant.speak('Welcome to Physics-Informed Drone Digital Twin. Mission control ready.', { priority: true });
    }, 400);

    setTimeout(() => {
      onEnter();
    }, 650);
  };

  return (
    <div className={`splash-overlay ${isExiting ? 'fade-out' : ''}`}>
      {/* Background 3D Real-Time Canvas */}
      <div className="splash-3d-wrap">
        <SplashCanvasErrorBoundary>
          <Canvas camera={{ position: [0, 1.4, 4.4], fov: 42 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[4, 6, 4]} intensity={1.6} color="#e0f2fe" />
            <pointLight position={[-4, 3, -4]} intensity={2.2} color="#00f2fe" />
            <spotLight position={[0, -1.2, 0]} intensity={3.5} color="#22d3ee" angle={0.8} />
            
            <HolographicPedestal />
            <SplashDrone />
            <DustParticles count={110} />
          </Canvas>
        </SplashCanvasErrorBoundary>
      </div>

      {/* Cyber Grid Lines & Vignette */}
      <div className="splash-grid-lines" />

      {/* Aerospace HUD Overlay */}
      <div className="splash-hud">
        {/* Top Header */}
        <header className="splash-top">
          <div className="splash-event-pill">
            <span className="splash-pulse-dot" />
            <span>IEEE RAS HACKFUSION 2026 · THEME 3</span>
          </div>

          <button className="splash-skip-btn" onClick={handleEnter} title="Enter Mission Control Immediately">
            SKIP INTRO <ChevronRight size={13} />
          </button>
        </header>

        {/* Center Title & Branding */}
        <div className="splash-hero">
          <div className="splash-logo-row">
            <div className="splash-logo-mark">
              <Activity size={26} />
            </div>
            <div>
              <h1 className="splash-title">
                DRONE-TWIN <b>X</b>
              </h1>
              <div className="splash-subtitle">PHYSICS-INFORMED AUTONOMOUS DIGITAL TWIN</div>
            </div>
          </div>
          <p className="splash-desc">
            Autonomous decision-support and multi-physics state estimation for unmanned aerial vehicles operating under severe environmental disturbances.
          </p>
        </div>

        {/* Bottom Status & Diagnostic Deck */}
        <div className="splash-deck">
          {/* Diagnostic Step Cards */}
          <div className="splash-steps-grid">
            {steps.map((st, i) => (
              <div
                key={i}
                className={`splash-step-card ${i < activeStep ? 'completed' : i === activeStep ? 'current' : 'pending'}`}
              >
                <div className="step-icon">
                  {i < activeStep ? <Check size={12} /> : i === activeStep ? <Zap size={12} /> : <span>0{i + 1}</span>}
                </div>
                <div>
                  <div className="step-title">{st.title}</div>
                  <div className="step-detail">{st.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Loading Progress Bar & Launch Action */}
          <div className="splash-action-row">
            <div className="splash-progress-track">
              <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
              <div className="splash-progress-label">
                <span>SYSTEM AVIONICS INITIALIZATION</span>
                <b>{progress}%</b>
              </div>
            </div>

            <button
              className={`splash-launch-btn ${progress >= 100 ? 'ready' : ''}`}
              onClick={handleEnter}
            >
              <Play size={16} fill="currentColor" />
              <span>{progress >= 100 ? 'ENTER MISSION CONTROL' : 'INITIALIZE TWIN'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
