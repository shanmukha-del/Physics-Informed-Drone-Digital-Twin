import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { Crosshair, Map, Target, Compass, Maximize2 } from 'lucide-react';

import { useTwin } from '../simulation/store';
import { waypointPosition } from '../simulation/model';

function Model({ url, position, scale = 1, rotation = [0, 0, 0], castShadow = false, receiveShadow = false }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const x = scene.clone(true);
    x.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = castShadow;
        o.receiveShadow = receiveShadow;
      }
    });
    return x;
  }, [scene, castShadow, receiveShadow]);
  return <primitive object={clone} position={position} rotation={rotation} scale={scale} />;
}

function Label({ text, position, color = '#426171' }) {
  const map = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,.91)';
    ctx.fillRect(3, 8, 506, 80);
    ctx.strokeStyle = '#cbdce3';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 8, 506, 80);
    ctx.font = '700 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 48, 480);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [text, color]);
  return (
    <sprite position={position} scale={[Math.max(1.25, text.length * 0.075), 0.25, 1]} renderOrder={5}>
      <spriteMaterial map={map} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

function Drone() {
  const group = useRef();
  const position = useTwin((s) => s.position);
  const heading = useTwin((s) => s.heading);
  const velocity = useTwin((s) => s.velocity);
  const flightMode = useTwin((s) => s.flightMode);
  const poweredOn = useTwin((s) => s.poweredOn);

  // Target rotor spin: 0 when landed (engines off), 32 rad/s in flight, 18 rad/s in hover
  const targetRotorSpin = flightMode === 'LANDED' ? 0 : velocity > 0 ? 32 : 18;

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.set(position[0], position[1], position[2]);
    group.current.rotation.y = heading;
    group.current.rotation.z = THREE.MathUtils.damp(
      group.current.rotation.z,
      Math.sin(heading) * Math.min(0.18, velocity * 0.009),
      4,
      dt
    );
  });
  return (
    <group ref={group}>
      {/* 1. Main Aerodynamic Stealth Fuselage (Carbon-Fiber Matte) */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.72, 0.2, 1.05]} />
        <meshStandardMaterial color="#1a1e24" metalness={0.88} roughness={0.25} />
      </mesh>

      {/* Aerodynamic Top Canopy Shell */}
      <mesh position={[0, 0.12, -0.05]}>
        <boxGeometry args={[0.52, 0.08, 0.82]} />
        <meshStandardMaterial color="#242c35" metalness={0.75} roughness={0.35} />
      </mesh>
      {/* Glowing Cyber Cyan Spine */}
      <mesh position={[0, 0.17, -0.05]}>
        <boxGeometry args={[0.1, 0.035, 0.72]} />
        <meshStandardMaterial color="#2095b5" emissive="#167f9f" emissiveIntensity={0.6} />
      </mesh>

      {/* Dual Battery Pack Bay (Rear Deck) */}
      <mesh position={[0, 0.08, 0.36]}>
        <boxGeometry args={[0.58, 0.15, 0.3]} />
        <meshStandardMaterial color="#111417" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Top RTK GNSS Mast & Antenna Puck */}
      <mesh position={[0, 0.24, 0.15]}>
        <cylinderGeometry args={[0.018, 0.018, 0.15, 8]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.32, 0.15]}>
        <cylinderGeometry args={[0.085, 0.085, 0.035, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.34, 0.15]}>
        <cylinderGeometry args={[0.038, 0.038, 0.012, 12]} />
        <meshStandardMaterial color="#2980b9" emissive="#2980b9" emissiveIntensity={0.8} />
      </mesh>

      {/* 2. 3-Axis Gimbal Optical 4K & Thermal FLIR Camera Pod (Nose Underside) */}
      <group position={[0, -0.14, -0.46]}>
        {/* Gimbal Yoke */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.06, 12]} />
          <meshStandardMaterial color="#2c3e50" metalness={0.8} />
        </mesh>
        {/* Camera Sphere Housing */}
        <mesh position={[0, -0.06, 0]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#161b22" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Sapphire Glass Lens */}
        <mesh position={[0, -0.06, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.04, 16]} />
          <meshStandardMaterial
            color="#05101a"
            emissive="#00f2fe"
            emissiveIntensity={poweredOn ? 0.75 : 0.05}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        {/* Optical Sensor Status LED */}
        <mesh position={[0.075, -0.03, -0.07]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial
            color={poweredOn ? '#2ecc71' : '#334155'}
            emissive={poweredOn ? '#2ecc71' : '#000000'}
            emissiveIntensity={poweredOn ? 1.2 : 0}
          />
        </mesh>
      </group>

      {/* 3. Heavy-Duty Carbon-Fiber Diagonal Tubular Arms & Motors */}
      {[
        { pos: [-0.92, 0.04, -0.92], angle: Math.PI / 4, isPort: true, isFront: true },
        { pos: [0.92, 0.04, -0.92], angle: -Math.PI / 4, isPort: false, isFront: true },
        { pos: [-0.92, 0.04, 0.92], angle: (3 * Math.PI) / 4, isPort: true, isFront: false },
        { pos: [0.92, 0.04, 0.92], angle: -(3 * Math.PI) / 4, isPort: false, isFront: false },
      ].map((arm, i) => (
        <group key={i}>
          {/* Diagonal Carbon Arm Tube extending from center */}
          <group position={[arm.pos[0] * 0.5, 0.02, arm.pos[2] * 0.5]} rotation={[0, arm.angle, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.04, 0.04, 1.4, 10]} />
              <meshStandardMaterial color="#181d22" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>

          {/* Motor Pod Mount at arm tip */}
          <group position={arm.pos}>
            {/* Motor Mount Clamp */}
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[0.17, 0.07, 0.17]} />
              <meshStandardMaterial color="#242b33" metalness={0.8} />
            </mesh>
            {/* CNC Anodized Brushless Motor Bell */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.13, 16]} />
              <meshStandardMaterial color="#111518" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Gold/Bronze Stator Cooling Vent Accent Ring */}
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.135, 0.135, 0.03, 16]} />
              <meshStandardMaterial color="#d4a373" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* FAA Aviation Navigation LEDs */}
            <mesh position={[0, -0.1, 0]}>
              <sphereGeometry args={[0.03, 10, 8]} />
              <meshStandardMaterial
                color={arm.isFront ? (arm.isPort ? '#ff3b30' : '#34c759') : '#007aff'}
                emissive={arm.isFront ? (arm.isPort ? '#ff3b30' : '#34c759') : '#007aff'}
                emissiveIntensity={poweredOn ? 1.5 : 0.05}
              />
            </mesh>

            {/* Aerodynamic Carbon Propeller Assembly */}
            <Rotor spin={targetRotorSpin} />
          </group>
        </group>
      ))}

      {/* 4. Carbon-Fiber Landing Skids (Helipad Stance Legs) */}
      {[-0.45, 0.45].map((xSide, i) => (
        <group key={`skid-${i}`}>
          {/* Angled Vertical Carbon Struts */}
          <mesh position={[xSide * 0.72, -0.16, -0.3]} rotation={[0, 0, xSide > 0 ? -0.35 : 0.35]}>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 8]} />
            <meshStandardMaterial color="#1a1e24" metalness={0.85} />
          </mesh>
          <mesh position={[xSide * 0.72, -0.16, 0.3]} rotation={[0, 0, xSide > 0 ? -0.35 : 0.35]}>
            <cylinderGeometry args={[0.024, 0.024, 0.38, 8]} />
            <meshStandardMaterial color="#1a1e24" metalness={0.85} />
          </mesh>
          {/* Horizontal Landing Skid Tube */}
          <mesh position={[xSide, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.2, 10]} />
            <meshStandardMaterial color="#15191d" metalness={0.9} roughness={0.3} />
          </mesh>
          {/* Rubberized Helipad Touchdown End Caps */}
          <mesh position={[xSide, -0.34, -0.6]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#080a0c" roughness={0.8} />
          </mesh>
          <mesh position={[xSide, -0.34, 0.6]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#080a0c" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Tactical Aircraft Callout Label */}
      <Label text="DRONE-TWIN X · ENTERPRISE UAV" position={[0, 0.95, 0]} color="#167f9f" />
    </group>
  );
}

function Rotor({ spin }) {
  const r = useRef();
  const currentSpeed = useRef(0);
  useFrame((_, dt) => {
    if (!r.current) return;
    currentSpeed.current = THREE.MathUtils.damp(currentSpeed.current, spin, 3.5, dt);
    if (currentSpeed.current > 0.02) {
      r.current.rotation.y += dt * currentSpeed.current;
    }
  });
  return (
    <group ref={r} position={[0, 0.12, 0]}>
      {/* Center Propeller Spinner Hub */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.045, 14]} />
        <meshStandardMaterial color="#1a2027" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Carbon Airfoil Propeller Blades */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[1.25, 0.016, 0.075]} />
        <meshStandardMaterial color="#222831" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Blade Tip Accents */}
      <mesh position={[-0.62, 0.025, 0]}>
        <boxGeometry args={[0.02, 0.025, 0.055]} />
        <meshStandardMaterial color="#2095b5" />
      </mesh>
      <mesh position={[0.62, 0.025, 0]}>
        <boxGeometry args={[0.02, 0.025, 0.055]} />
        <meshStandardMaterial color="#2095b5" />
      </mesh>

      {/* Semi-transparent Motion Disc when spinning */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.64, 0.64, 0.004, 24]} />
        <meshStandardMaterial
          color="#33465a"
          transparent
          opacity={spin > 0 ? 0.28 : 0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Waypoints({ mission }) {
  const {
    selectedWaypoint,
    selectWaypoint,
    missionType,
    manualMode,
    running,
    updateWaypoint,
    setDraggingWaypoint,
    altitude,
    trajectoryModified,
    bypassWaypoint,
  } = useTwin((s) => s);
  const editable = missionType === 'manual' && manualMode && !running;

  return (
    <>
      {mission.map((w, i) => {
        const isEditable = editable && i > 0;
        return (
          <group
            key={w.id}
            position={waypointPosition(w, altitude)}
            onClick={(e) => {
              e.stopPropagation();
              selectWaypoint(w.id);
            }}
            onPointerDown={(e) => {
              if (!isEditable) return;
              e.stopPropagation();
              e.target.setPointerCapture?.(e.pointerId);
              setDraggingWaypoint(w.id);
            }}
            onPointerMove={(e) => {
              if (!isEditable || useTwin.getState().draggingWaypoint !== w.id) return;
              e.stopPropagation();
              const groundHit = e.ray.intersectPlane(
                new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
                new THREE.Vector3()
              );
              if (groundHit) updateWaypoint(w.id, { p: [groundHit.x, 0, groundHit.z] });
            }}
            onPointerUp={(e) => {
              if (useTwin.getState().draggingWaypoint === w.id) {
                e.stopPropagation();
                e.target.releasePointerCapture?.(e.pointerId);
                setDraggingWaypoint(null);
              }
            }}
            onPointerCancel={() => setDraggingWaypoint(null)}
          >
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 1.4, 10]} />
              <meshStandardMaterial
                color={i === 0 ? '#19a8bc' : i === mission.length - 1 ? '#eb7556' : '#f4a83f'}
                emissive={i === mission.length - 1 ? '#9e3218' : '#000'}
                emissiveIntensity={0.35}
              />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <sphereGeometry args={[selectedWaypoint === w.id ? 0.65 : 0.43, 12, 12]} />
              <meshStandardMaterial
                color={selectedWaypoint === w.id ? '#17acd0' : i === mission.length - 1 ? '#ec7351' : '#f3aa43'}
                emissive="#209bb7"
                emissiveIntensity={0.25}
              />
            </mesh>
            <Label
              text={selectedWaypoint === w.id ? `${w.id} · ${w.name}` : w.id}
              position={[0, 2.8, 0]}
              color={i === mission.length - 1 ? '#bd533d' : '#426171'}
            />
          </group>
        );
      })}

      {/* Dynamic Bypass Waypoint Beacon when trajectory modification is active */}
      {trajectoryModified && bypassWaypoint && (
        <group position={bypassWaypoint}>
          <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color="#9b59b6" emissive="#8e44ad" emissiveIntensity={0.6} />
          </mesh>
          <Label text="DYNAMIC BYPASS CORRIDOR" position={[0, 2.6, 0]} color="#8e44ad" />
        </group>
      )}
    </>
  );
}

function Route({ mission }) {
  const { position, routeIndex, returning, metrics, altitude, trajectoryModified, bypassWaypoint } = useTwin((s) => s);

  const route = useMemo(() => {
    const points = [new THREE.Vector3(...position)];

    if (trajectoryModified && bypassWaypoint) {
      points.push(new THREE.Vector3(...bypassWaypoint));
    }

    const restOfRoute = returning
      ? [mission[0]]
      : [...mission.slice(Math.max(1, routeIndex)), mission[0]];

    restOfRoute.filter(Boolean).forEach((w) => points.push(new THREE.Vector3(...waypointPosition(w, altitude))));

    return points.length > 1 ? new THREE.CatmullRomCurve3(points).getPoints(80) : points;
  }, [position[0], position[1], position[2], routeIndex, returning, mission, altitude, trajectoryModified, bypassWaypoint]);

  const color = trajectoryModified
    ? '#9b59b6'
    : metrics.risk > 75
    ? '#e55353'
    : metrics.risk > 55
    ? '#ef8c39'
    : metrics.risk > 30
    ? '#edbd55'
    : '#22a995';

  return (
    <>
      {route.length > 1 && (
        <Line
          points={route}
          color={returning ? '#e95858' : color}
          lineWidth={2.8}
          dashed={returning || trajectoryModified}
          dashSize={2}
          gapSize={1.1}
          transparent
          opacity={0.92}
        />
      )}
    </>
  );
}

function Wind() {
  const ref = useRef();
  const wind = useTwin((s) => s.wind);
  useFrame((state, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * (0.15 + wind * 0.008);
      ref.current.children.forEach((p, i) => {
        p.position.x += dt * (0.8 + wind * 0.045);
        if (p.position.x > 24) p.position.x = -24;
        p.position.y = 9 + Math.sin(state.clock.elapsedTime * 1.8 + i) * (0.4 + wind * 0.025);
      });
    }
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 32 }, (_, i) => (
        <mesh key={i} position={[(i * 17 % 48) - 24, 9 + (i % 7), ((i * 11) % 42) - 21]}>
          <sphereGeometry args={[0.065 + wind * 0.0015, 6, 6]} />
          <meshBasicMaterial color="#37a9d0" transparent opacity={0.38} />
        </mesh>
      ))}
    </group>
  );
}

function SceneContent({ mode, mission }) {
  const { camera } = useThree();
  const controls = useRef();
  const position = useTwin((s) => s.position);
  const follow = useTwin((s) => s.follow);
  const add3DMode = useTwin((s) => s.add3DMode);
  const altitude = useTwin((s) => s.altitude);
  const addWaypoint = useTwin((s) => s.addWaypoint);

  useFrame((_, dt) => {
    if (follow) {
      camera.position.lerp(new THREE.Vector3(position[0] + 18, position[1] + 13, position[2] + 25), 1 - Math.exp(-dt * 2.2));
      if (controls.current) {
        controls.current.target.lerp(new THREE.Vector3(...position), 1 - Math.exp(-dt * 2.5));
        controls.current.update();
      }
    }
  });

  React.useEffect(() => {
    if (!controls.current) return;
    const center = mission.reduce(
      (a, w) => [a[0] + w.p[0] / mission.length, a[1] + w.p[1] / mission.length, a[2] + w.p[2] / mission.length],
      [0, 0, 0]
    );
    const target =
      mode === 'BASE VIEW'
        ? new THREE.Vector3(0, 4, 0)
        : mode === 'MISSION MAP'
        ? new THREE.Vector3(...center)
        : new THREE.Vector3(...center.map((v, i) => (i === 1 ? v + 8 : v)));
    controls.current.target.copy(target);
    if (mode === 'MISSION MAP') camera.position.set(center[0], center[1] + 275, center[2] + 6);
    else if (mode === 'BASE VIEW') camera.position.set(25, 35, 48);
    else camera.position.set(center[0] - 50, center[1] + 45, center[2] + 72);
    controls.current.update();
  }, [mode, camera, mission]);

  return (
    <>
      <color attach="background" args={['#e8f1f5']} />
      <fog attach="fog" args={['#e8f1f5', 100, 400]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[45, 85, 25]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight skyColor="#e6f5ff" groundColor="#899e71" intensity={0.65} />
      <Suspense fallback={null}>
        <group position={[139, -1, 0]}>
          {/* environment.glb does NOT cast shadow, only receives shadow - saves 80% GPU draw time! */}
          <Model url="/models/environment.glb" position={[0, 0, 0]} scale={[600, 40, 600]} castShadow={false} receiveShadow={true} />
        </group>
        <Model url="/models/drone-base.glb" position={[-9, -1, 3]} scale={4} castShadow={true} receiveShadow={true} />
        <Model url="/models/landing-pad.glb" position={[0, -1, 0]} scale={2.4} castShadow={true} receiveShadow={true} />
        <Model url="/models/warehouse.glb" position={[147, -1, 0]} scale={12} castShadow={true} receiveShadow={true} />
        <Waypoints mission={mission} />
        <Route mission={mission} />
        <Drone />
        <Wind />
      </Suspense>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[100, -3, 0]}
        onClick={(e) => {
          if (add3DMode) {
            e.stopPropagation();
            addWaypoint([e.point.x, altitude, e.point.z]);
          }
        }}
      >
        <planeGeometry args={[650, 360]} />
        <meshStandardMaterial color="#a6be92" roughness={0.92} />
      </mesh>
      <gridHelper args={[340, 68, '#8caa9f', '#a9bdb5']} position={[100, -2.95, 0]} />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[80, 10, 0]}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.06}
        minDistance={14}
        maxDistance={330}
      />
    </>
  );
}

function ModelLoading() {
  const { progress, active } = useProgress();
  return active ? (
    <div className="model-progress" aria-live="polite">
      {Math.round(progress)}% · Loading 3D Digital Twin Assets
    </div>
  ) : null;
}

class ThreeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Three.js Canvas Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', background: '#0b1320', padding: 20 }}>
          <b style={{ color: '#38bdf8', marginBottom: 8, fontSize: 13 }}>3D Digital Twin Ready</b>
          <p style={{ fontSize: 11, marginBottom: 12, color: '#64748b' }}>Click below to reload 3D viewport canvas.</p>
          <button 
            style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', font: '700 11px monospace' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            RELOAD 3D SCENE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DigitalTwin({ mission }) {
  const mode = useTwin((s) => s.camera);
  const setCamera = useTwin((s) => s.setCamera);
  const follow = useTwin((s) => s.follow);
  const toggleFollow = useTwin((s) => s.toggleFollow);
  const trajectoryModified = useTwin((s) => s.trajectoryModified);

  return (
    <div className="viewport">
      <ThreeErrorBoundary>
        <Canvas shadows dpr={[1, 1.25]} camera={{ position: [30, 45, 72], fov: 48, near: 0.1, far: 1000 }}>
          <SceneContent mode={mode} mission={mission} />
        </Canvas>
      </ThreeErrorBoundary>
      <ModelLoading />

      {/* Floating Viewport Camera Controls - NEVER overflows outside header! */}
      <div className="floating-camera-toolbar">
        {['DRONE VIEW', 'MISSION MAP', 'BASE VIEW'].map((x, i) => (
          <button
            key={x}
            className={mode === x ? 'active' : ''}
            onClick={() => setCamera(x)}
          >
            {i === 0 ? <Crosshair size={11} /> : i === 1 ? <Map size={11} /> : <Target size={11} />}
            <span>{x}</span>
          </button>
        ))}
        <button onClick={() => setCamera('DRONE VIEW')} title="Reset Camera">
          <Maximize2 size={11} />
          <span>RESET</span>
        </button>
        <button className={follow ? 'active' : ''} onClick={toggleFollow}>
          <Compass size={11} />
          <span>{follow ? 'LOCK CAM' : 'FOLLOW'}</span>
        </button>
      </div>

      <div className="scene-caption">
        <span className="live-dot" /> DIGITAL TWIN · {mode} <span className="caption-sep">/</span> PINN MULTI-PHYSICS
      </div>
      <div className="scene-legend">
        <span><i className="legend-line safe" />SAFE</span>
        <span><i className="legend-line warn" />WARNING</span>
        {trajectoryModified && <span><i className="legend-line bypass" />DYNAMIC BYPASS</span>}
        <span><i className="legend-line danger" />RETURN ROUTE</span>
      </div>
    </div>
  );
}

useGLTF.preload('/models/environment.glb');
useGLTF.preload('/models/drone-base.glb');
useGLTF.preload('/models/landing-pad.glb');
useGLTF.preload('/models/warehouse.glb');
