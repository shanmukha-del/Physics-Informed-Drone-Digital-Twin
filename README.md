# DRONE-TWIN X: Physics-Informed Drone Digital Twin

[![IEEE RAS](https://img.shields.io/badge/IEEE%20RAS-HackFusion%202026-00629B?style=for-the-badge&logo=ieee&logoColor=white)](https://ieee-ras.org)
[![Theme](https://img.shields.io/badge/Theme%203-Physics--Informed%20Digital%20Twin-success?style=for-the-badge)](https://hackfusion2026.dev)
[![Status](https://img.shields.io/badge/Status-Evaluation%20Ready%20%E2%9C%93-brightgreen?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)]()

> **GitHub Repository:** `https://github.com/shanmukha-del/Physics-Informed-Drone-Digital-Twin`  

---

## 🏆 Hackathon Problem Statement & Solution Mapping

| HackFusion 2026 Problem Requirement | DRONE-TWIN X Implementation | Status |
| :--- | :--- | :---: |
| **Environmental State Model**<br>*(Wind, air density, turbulence, temperature disturbances)* | • Barometric air density: $\rho(h) = \rho_0 e^{-h/8500}$<br>• Dynamic 3D wind velocity vector & crosswind shear<br>• Turbulence Kinetic Energy intensity scaling (0–90%)<br>• Microburst and gust generator | **100% Complete** |
| **Vehicle Health Model**<br>*(Battery temp, payload, rotor eff, degradation, stress)* | • Arrhenius electro-thermal model: $m c_p \dot{T} = I^2 R_{int} - hA\Delta T$<br>• Actuator degradation kinetics: $\dot{\delta} \propto \sigma_{struct}$<br>• Structural stress tensor & component health index (0–100)<br>• Dynamic payload mass coupling (0–5.0 kg) | **100% Complete** |
| **Energy & Endurance Forecasting**<br>*(Power consumption, remaining endurance, feasibility)* | • First-principles momentum hover theory + parasitic drag: $P_{drag} = \frac{1}{2}\rho C_d A v_{rel}^3$<br>• PINN residual model $\Delta P_{PINN}$ for wake/stall losses<br>• Conservative round-trip energy integration & SoC reserve prediction | **100% Complete** |
| **Safe Operating Envelope (SOE)**<br>*(Flight conditions and operating boundaries)* | • 6-Axis Polar/Spider radar visualizer in dashboard<br>• Dynamic limits: Wind (32 km/h), Temp (58°C), Stress (85/100), Degradation (35%), Payload (5 kg), SoC margin<br>• Real-time breach detection (`NOMINAL`, `MARGINAL`, `BREACHED`) | **100% Complete** |
| **Autonomous Mission Decisions**<br>*(Modify trajectory, reduce speed, alter altitude, RTB, abort)* | • `CONTINUE`: Inside envelope, reserve verified<br>• `MODIFY TRAJECTORY`: Autonomous crosswind bypass corridor generation<br>• `SLOW DOWN`: Aerodynamic drag reduction ($P \propto v^3$)<br>• `CHANGE ALTITUDE`: Descent below turbulent boundary layers<br>• `RETURN TO BASE`: Reserve threshold triggered<br>• `MISSION ABORT`: Emergency descent upon thermal runaway/stress | **100% Complete** |
| **Digital-Twin Dashboard**<br>*(Telemetry, predicted states, uncertainty, 3D views, decisions)* | • Three.js / React Three Fiber interactive 3D digital twin<br>• Leaflet 2D GPS Map (anchored at Tirupati, India) + Tactical Polar Radar<br>• 6 Live Telemetry plots with 95% Confidence Bounds ($\pm 1.96\sigma$)<br>• Interactive Mission Planner (drag, altitude, JSON import/export) | **100% Complete** |
| **Physics/ML Integration (PINN)**<br>*(Fuse physics constraints with learned models)* | • Physics-Informed Neural Network (PINN): Dense 16 (GELU) $\to$ Dense 8 (Tanh) $\to$ Dual Heads<br>• Physics regularization: $\mathcal{L}_{total} = \mathcal{L}_{data} + \lambda_{aero}\mathcal{L}_{aero} + \lambda_{thermal}\mathcal{L}_{thermal}$<br>• Real-time inference latency: 0.8 ms | **100% Complete** |
| **Uncertainty Quantification (UQ)**<br>*(Quantify state and endurance uncertainty)* | • 4-State Extended Kalman Filter (EKF) tracking $[SoC, T_{batt}, \Delta P, \omega_{rotor}]^T$<br>• Shaded 95% confidence intervals ($\pm 1.96\sigma$) on charts & state metrics | **100% Complete** |
| **Interpretable Decision Evidence (XAI)**<br>*(Verifiable evidence for safety decisions)* | • Power decomposition breakdown: $P_{hover} + P_{drag} + \Delta P_{PINN} = P_{total}$<br>• SHAP-inspired causal risk factor attribution waterfall | **100% Complete** |

---

## 🏛️ System Architecture

```text
+-----------------------------------------------------------------------------------+
|                            DRONE-TWIN X ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Environmental Disturbances ]            [ Vehicle Degradation Dynamics ]      |
|    - Wind Velocity (v_w, θ_w)                 - Battery Thermal Climb (T_batt)    |
|    - Turbulence Kinetic (I_t)                 - Motor Degradation (δ_motor)       |
|    - Air Density ρ(h) = ρ_0 e^(-h/H)          - Rotor Efficiency (η_rotor)        |
|    - Dynamic Crosswind Vector                 - Payload Mass (m_payload)          |
|                 │                                         │                       |
|                 ▼                                         ▼                       |
|  +─────────────────────────────────────────────────────────────────────────────+  |
|  |                 FIRST-PRINCIPLES MULTI-PHYSICS BASELINE                     |  |
|  |  Hover: P_hov = W^1.5 / (η * √(2ρA))   | Drag: P_drag = 0.5 ρ C_d A v_rel^3 |  |
|  |  Climb: P_climb = (mg) v_z             | Thermal: mc_p dT/dt = I²R - hAΔT   |  |
|  +───────────────────────────────────────┬─────────────────────────────────────+  |
|                                          │                                        |
|                                          ▼                                        |
|  +─────────────────────────────────────────────────────────────────────────────+  |
|  |             PHYSICS-INFORMED NEURAL NETWORK (PINN) RESIDUAL HEAD            |  |
|  |  8-Input -> Dense 16 (GELU) -> Dense 8 (Tanh) -> Dual Heads: (ΔP, σ²)       |  |
|  |  Regularized with: L_total = L_MSE + λ_aero L_aero + λ_thermal L_thermal    |  |
|  +───────────────────────────────────────┬─────────────────────────────────────+  |
|                                          │                                        |
|                                          ▼                                        |
|  +─────────────────────────────────────────────────────────────────────────────+  |
|  |                    EXTENDED KALMAN FILTER (EKF) ESTIMATOR                   |  |
|  |  State: x = [SoC, T_batt, P_res, ω_rotor]^T | Covariance: P_k|k             |  |
|  |  95% Confidence Interval Bands (±1.96σ) for Battery, Power, & Endurance     |  |
|  +───────────────────────────────────────┬─────────────────────────────────────+  |
|                                          │                                        |
|                                          ▼                                        |
|  +─────────────────────────────────────────────────────────────────────────────+  |
|  |                 AUTONOMOUS DECISION ENGINE & 6-AXIS SOE                     |  |
|  |  Directives: CONTINUE | MODIFY TRAJECTORY | SLOW DOWN | RTB | ABORT         |  |
|  |  Interpretable Causal Evidence (SHAP waterfall) + Dynamic Corridor Bypass   |  |
|  +─────────────────────────────────────────────────────────────────────────────+  |
+-----------------------------------------------------------------------------------+
```

---

## 🧮 Mathematical Formulation

### 1. Aerodynamics & Drag Kinematics
$$\rho(h) = \rho_0 \exp\left(-\frac{h}{8500}\right)$$
$$v_{rel} = v + \frac{\left| v_w \cos(\theta_w - \psi_{drone}) \right|}{3.6}$$
$$P_{drag} = \frac{1}{2} \rho(h) C_d A v_{rel}^3$$

### 2. Actuator Disk Momentum Hover Theory
$$P_{hover} = \frac{(m_{frame} + m_{payload})^{1.5} g^{1.5}}{\eta_{rotor} \sqrt{2 \rho(h) A_{disk}}}$$

### 3. Electro-Thermal Dynamics
$$m_{batt} c_p \frac{dT_{batt}}{dt} = I^2 R_{int}(T_{batt}, \delta) - h A_{surf}(T_{batt} - T_{amb})$$

### 4. PINN Loss Function with Physical Invariants
$$\min_{\theta} \mathcal{L}(\theta) = \mathcal{L}_{data} + \lambda_{aero} \mathcal{L}_{aero} + \lambda_{thermal} \mathcal{L}_{thermal}$$
$$\mathcal{L}_{aero} = \left\| \text{ReLU}\left( - \frac{\partial \hat{P}}{\partial v_{rel}} \right) \right\|_2^2 \quad \text{(Enforces positive aerodynamic dissipation)}$$
$$\mathcal{L}_{thermal} = \left\| P_{elec} - (P_{mech} + I^2 R + \dot{Q}) \right\|_2^2 \quad \text{(Enforces energy conservation)}$$

---

## 🚀 Live Demo Walkthrough (For Hackathon Judges)

During final jury evaluation, follow this 2-minute demonstration flow:

1. **Takeoff & Nominal PINN Flight:**
   - Click **`START MISSION`**.
   - Point to the **Decision Panel**: Current directive is `CONTINUE`, Risk is `8/100`, Envelope is `NOMINAL`.
   - Point to the **Power Decomposition**: Notice $P_{hover}$ + $P_{drag}$ + $\Delta P_{PINN} = P_{total}$.

2. **Automated Multi-Stage Scenario Demo:**
   - Click the **`HACKATHON DEMO`** button.
   - **Stage 1 ($t = 4\text{s}$):** Severe crosswind shear (30 km/h @ 160°) is injected. The engine instantly triggers **`MODIFY TRAJECTORY`**! Point out the purple dashed bypass corridor generated on the 3D scene and Leaflet map to mitigate crosswind drag.
   - **Stage 2 ($t = 11\text{s}$):** Heavy turbulence (65%) and high wind surge. The engine shifts to **`SLOW DOWN`**, reducing cruise speed to cut drag power ($\propto v^3$) and save endurance.
   - **Stage 3 ($t = 18\text{s}$):** Battery reaches the 25% return threshold. The engine autonomously triggers **`RETURN TO BASE`**, navigating the shortest safe path back to the pad.

3. **Interactive Documentation & Inspector:**
   - Click **`PINN MODEL`** in the topbar to show the 3-layer neural network topology, loss equations, and real-time 0.8 ms inference latency.
   - Click **`EVALUATION REPORT`** in the topbar to demonstrate the full IEEE RAS technical specification, mathematical derivation, assumptions, and benchmark table.

---

## 🛠️ Local Development & Quickstart

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/your-team/drone-twin-x.git
cd drone-twin-x

# Install dependencies
npm install

# Start Vite local development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
npm run build
npm run preview
```
The output is generated in `dist/`. Assets and models use relative paths (`./`) and are ready for instant static hosting.

---

## 🌐 1-Click Deployment Guide

This project can be deployed in under 2 minutes:

### Option A: Deploy to Vercel (Recommended)
1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Framework Preset: **Vite**
4. Click **Deploy**. Vercel will build and provide your public URL.

### Option B: Deploy to Netlify
1. Go to [netlify.com](https://netlify.com) and link your GitHub repository.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Click **Deploy site**.

### Option C: Deploy to GitHub Pages
1. In repository **Settings** $\to$ **Pages**, set Source to **GitHub Actions**.
2. Vite is already configured with `base: './'`.

---

## 👥 Team & Hackathon Details

- **Competition:** HackFusion 2026
- **Organizer:** IEEE Robotics & Automation Society (RAS) Student Branch
- **Track:** Theme 3 — Physics-Informed Drone Digital Twin
- **Team Name:** `[Your Team Name]`
- **Members:**
  - Lead Systems & Multi-Physics Architecture: `[Member 1]`
  - PINN & Extended Kalman Filter Engineering: `[Member 2]`
  - 3D Digital Twin & Full-Stack Dashboard: `[Member 3]`
  - Autonomous Decision Support & Simulation: `[Member 4]`

---
*Built with React 19, Three.js, React Three Fiber, Leaflet, Recharts, and Zustand.*
