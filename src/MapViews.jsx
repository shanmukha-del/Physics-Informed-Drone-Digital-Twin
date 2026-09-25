import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTwin } from './simulation/store';
import { localToLatLng, latLngToLocal, TIRUPATI_ORIGIN } from './utils/coordinateConverter';

const toGps = (p) => localToLatLng(p[0], p[2]);
const inBounds = (x, z) => Math.abs(x) <= 500 && Math.abs(z) <= 500;

export const MAP_LAYERS = {
  SATELLITE: {
    id: 'SATELLITE',
    label: '🛰️ GOOGLE SATELLITE',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: 'Imagery &copy; Google Satellite',
  },
  ESRI: {
    id: 'ESRI',
    label: '🌍 ESRI AERIAL',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: ['server', 'services'],
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri World Imagery',
  },
  STREET: {
    id: 'STREET',
    label: '🏙️ STREET MAP',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  },
};

export function LeafletMapView({ position, heading, battery, risk, mission }) {
  const host = useRef(null),
    mapRef = useRef(null),
    droneRef = useRef(null),
    routeRef = useRef(null),
    pointsRef = useRef([]),
    tileLayerRef = useRef(null),
    lastPan = useRef(0);
  const [tileWarning, setTileWarning] = useState(false);
  const [mapStyle, setMapStyle] = useState('SATELLITE'); // 'SATELLITE' | 'ESRI' | 'STREET'
  const manualMode = useTwin((s) => s.manualMode),
    selectedWaypoint = useTwin((s) => s.selectedWaypoint),
    missionType = useTwin((s) => s.missionType),
    running = useTwin((s) => s.running),
    routeIndex = useTwin((s) => s.routeIndex),
    returning = useTwin((s) => s.returning),
    trajectoryModified = useTwin((s) => s.trajectoryModified),
    bypassWaypoint = useTwin((s) => s.bypassWaypoint);

  const gps = toGps(position);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    const map = L.map(host.current, { zoomControl: true, preferCanvas: true }).setView(
      [TIRUPATI_ORIGIN.latitude, TIRUPATI_ORIGIN.longitude],
      16
    );
    mapRef.current = map;

    // Default to Photorealistic Google Satellite Hybrid Imagery
    const initialConfig = MAP_LAYERS.SATELLITE;
    const tiles = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      subdomains: initialConfig.subdomains,
      attribution: initialConfig.attribution,
    }).addTo(map);
    tileLayerRef.current = tiles;

    tiles.on('tileerror', () => {
      // Seamless fallback to Esri World Imagery if Google is unavailable
      if (tileLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
        const fallback = L.tileLayer(MAP_LAYERS.ESRI.url, {
          maxZoom: MAP_LAYERS.ESRI.maxZoom,
          attribution: MAP_LAYERS.ESRI.attribution,
        }).addTo(mapRef.current);
        tileLayerRef.current = fallback;
      }
    });

    droneRef.current = L.marker([gps.latitude, gps.longitude], {
      icon: L.divIcon({
        className: 'leaflet-drone-icon',
        html: '<span class="leaflet-drone-arrow">▲</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindTooltip('Simulated drone twin');

    map.on('click', (e) => {
      const s = useTwin.getState();
      const [x, z] = latLngToLocal(e.latlng.lat, e.latlng.lng);
      if (inBounds(x, z)) {
        if (s.missionType !== 'manual') {
          s.setMissionType('manual');
          s.setManualMode(true);
        }
        s.addWaypoint([x, s.altitude, z]);
      }
    });

    L.Util.requestAnimFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      droneRef.current = null;
      routeRef.current = null;
      pointsRef.current = [];
    };
  }, []);

  // Dynamic Tile Layer Switching
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const config = MAP_LAYERS[mapStyle] || MAP_LAYERS.SATELLITE;
    const newTiles = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
      attribution: config.attribution,
    }).addTo(mapRef.current);
    tileLayerRef.current = newTiles;
  }, [mapStyle]);

  useEffect(() => {
    if (mapRef.current) {
      drawRoute(mapRef.current, mission, {
        routeRef,
        pointsRef,
        selectedWaypoint,
        manualMode,
        missionType,
        running,
        routeIndex,
        returning,
        position,
        trajectoryModified,
        bypassWaypoint,
      });
    }
  }, [
    mission,
    selectedWaypoint,
    manualMode,
    missionType,
    running,
    routeIndex,
    returning,
    trajectoryModified,
    bypassWaypoint,
  ]);

  useEffect(() => {
    if (!droneRef.current || !mapRef.current) return;
    droneRef.current.setLatLng([gps.latitude, gps.longitude]);
    droneRef.current.getElement()?.style.setProperty('--drone-heading', `${(heading * 180 / Math.PI + 360) % 360}deg`);
    if (Date.now() - lastPan.current > 1200) {
      mapRef.current.panTo([gps.latitude, gps.longitude], { animate: false });
      lastPan.current = Date.now();
    }
  }, [gps.latitude, gps.longitude, heading]);

  const selected = mission.find((w) => w.id === selectedWaypoint);

  return (
    <div className="map-view">
      <div ref={host} className="leaflet-map" aria-label="Interactive Leaflet map." />
      {tileWarning && (
        <div className="map-tile-warning">Map imagery is caching. Waypoint editing and local grid are active.</div>
      )}
      <div className="map-overlay map-top">
        <span className="map-pin" /> GPS{' '}
        <b>
          {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
        </b>

        {/* Satellite / Street Map Layer Switcher */}
        <div className="map-layer-selector">
          {Object.values(MAP_LAYERS).map((layer) => (
            <button
              key={layer.id}
              className={`map-layer-btn ${mapStyle === layer.id ? 'active' : ''}`}
              onClick={() => setMapStyle(layer.id)}
              title={`Switch to ${layer.label}`}
            >
              {layer.label}
            </button>
          ))}
        </div>

        {trajectoryModified && <span className="pill purple">DYNAMIC BYPASS ACTIVE</span>}
        <button
          className="map-action-pill"
          onClick={() => useTwin.getState().clearMission()}
          title="Clear all points to draw your own custom mission"
        >
          CLEAR & DROP CUSTOM POINTS
        </button>
        <span className="map-hint">CLICK ANYWHERE ON MAP TO DROP WAYPOINTS</span>
      </div>
      {selected && (
        <div className="map-overlay waypoint-pop">
          <b>
            {selected.id} · {selected.name}
          </b>
          <span>
            {selected.type} · ALT {selected.altitude} m · PRIORITY {selected.priority || 'NORMAL'}
          </span>
        </div>
      )}
      <div className="map-overlay map-bottom">
        <b>SIMULATED GPS · TIRUPATI, AP (13.63551° N, 79.41989° E)</b>
        <span>
          HDG {((heading * 180 / Math.PI + 360) % 360).toFixed(0)}° · BAT {battery.toFixed(0)}% · RISK {risk}/100
        </span>
      </div>
    </div>
  );
}

function drawRoute(map, mission, refs) {
  const {
    routeRef,
    pointsRef,
    selectedWaypoint,
    missionType,
    manualMode,
    running,
    routeIndex,
    returning,
    position,
    trajectoryModified,
    bypassWaypoint,
  } = refs;

  routeRef.current?.remove();
  pointsRef.current.forEach((layer) => layer.remove());

  const base = mission[0] || { id: 'BASE', name: 'BASE', p: [0, 3, 0] };
  let activeRoute = [];

  if (returning) {
    activeRoute = [position, base.p];
  } else {
    activeRoute = [position];
    if (trajectoryModified && bypassWaypoint) {
      activeRoute.push(bypassWaypoint);
    }
    const rem = mission.slice(Math.max(1, routeIndex)).map((w) => w.p);
    activeRoute.push(...rem, base.p);
  }

  const routeLatLngs = activeRoute.map(toGps).map((p) => [p.latitude, p.longitude]);
  const group = L.layerGroup().addTo(map);

  const routeColor = returning ? '#dc5959' : trajectoryModified ? '#9b59b6' : '#169f88';
  group.addLayer(
    L.polyline(routeLatLngs, {
      color: routeColor,
      weight: 4,
      opacity: 0.9,
      dashArray: returning || trajectoryModified ? '8 6' : undefined,
    })
  );

  const editable = missionType === 'manual' && manualMode && !running;

  // Render Waypoint Markers
  pointsRef.current = mission.map((w, i) => {
    const p = toGps(w.p),
      isBase = i === 0;
    const marker = L.marker([p.latitude, p.longitude], {
      draggable: !isBase && editable,
      bubblingMouseEvents: false,
      icon: L.divIcon({
        className: `mission-waypoint-icon ${isBase ? 'base' : ''} ${w.id === selectedWaypoint ? 'selected' : ''}`,
        html: `<span>${isBase ? 'BASE' : w.id}</span>`,
        iconSize: [42, 30],
        iconAnchor: [21, 15],
      }),
    }).addTo(map);

    marker.bindTooltip(`${isBase ? 'BASE' : w.id} · ${w.name} · ${w.type || 'BASE'} · ${w.altitude ?? 3} m`, {
      direction: 'top',
    });

    if (!isBase) {
      marker.on('click', () => useTwin.getState().selectWaypoint(w.id));
      marker.on('dragend', (e) => {
        const ll = e.target.getLatLng(),
          [x, z] = latLngToLocal(ll.lat, ll.lng);
        if (inBounds(x, z)) useTwin.getState().updateWaypoint(w.id, { p: [x, 0, z] });
        else map.panTo([p.latitude, p.longitude]);
      });
    }
    return marker;
  });

  // Render dynamic bypass marker on map if active
  if (trajectoryModified && bypassWaypoint) {
    const bpGps = toGps(bypassWaypoint);
    const bypassMarker = L.marker([bpGps.latitude, bpGps.longitude], {
      icon: L.divIcon({
        className: 'mission-waypoint-icon bypass',
        html: '<span style="background:#9b59b6;border-color:#fff;">BYPASS</span>',
        iconSize: [48, 30],
        iconAnchor: [24, 15],
      }),
    }).addTo(map);
    bypassMarker.bindTooltip('Dynamic Safe Bypass Corridor (Crosswind Mitigation)', { direction: 'top' });
    pointsRef.current.push(bypassMarker);
  }

  // Directional arrows along route
  routeLatLngs.slice(1).forEach((p, i) => {
    const q = routeLatLngs[i],
      angle = (Math.atan2(p[0] - q[0], p[1] - q[1]) * 180) / Math.PI;
    group.addLayer(
      L.marker([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], {
        interactive: false,
        icon: L.divIcon({
          className: 'route-direction-icon',
          html: `<span style="transform:rotate(${angle}deg);color:${routeColor}">➤</span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
    );
  });

  routeRef.current = group;
  if (mission.length > 1 && !running && !returning) {
    const bounds = L.latLngBounds(routeLatLngs);
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { maxZoom: 17, animate: false });
  }
}

export function RadarView({ position, heading, battery, risk, routeIndex, returning, mission }) {
  const trajectoryModified = useTwin((s) => s.trajectoryModified);
  const bypassWaypoint = useTwin((s) => s.bypassWaypoint);

  const cx = 300,
    cy = 200,
    radius = 165,
    point = (p) => {
      const dx = p[0] - position[0],
        dz = p[2] - position[2],
        d = Math.hypot(dx, dz),
        scale = (Math.min(d, 290) / Math.max(d, 1)) * (radius / 290);
      return [cx + dx * scale, cy + dz * scale];
    },
    base = mission[0]?.p || [0, 3, 0];

  const targets = returning
    ? [{ id: 'BASE', name: 'BASE', p: base }]
    : [
        ...(trajectoryModified && bypassWaypoint
          ? [{ id: 'BYPASS', name: 'DYNAMIC BYPASS', p: bypassWaypoint }]
          : []),
        ...mission.slice(Math.max(1, routeIndex)),
        { id: 'BASE', name: 'BASE', p: base },
      ];

  const route = [position, ...targets.map((w) => w.p)]
    .map(point)
    .map((p) => p.join(','))
    .join(' ');

  const active = returning
    ? mission[0]
    : trajectoryModified && bypassWaypoint
    ? { name: 'DYNAMIC BYPASS CORRIDOR' }
    : mission[Math.min(routeIndex, mission.length - 1)];

  return (
    <div className="radar-view">
      <svg viewBox="0 0 600 400" role="img" aria-label="Live tactical drone radar">
        <defs>
          <radialGradient id="radarGlow">
            <stop stopColor="#163d50" />
            <stop offset="1" stopColor="#0b1e2c" />
          </radialGradient>
          <linearGradient id="sweepFade">
            <stop stopColor="#52e7c0" stopOpacity=".28" />
            <stop offset="1" stopColor="#52e7c0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" rx="8" fill="url(#radarGlow)" />
        {[45, 85, 125, 165].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#326071" strokeWidth="1" />
        ))}
        <path d={`M${cx} 22V378M22 ${cy}H578`} stroke="#326071" />
        <path d={`M${cx} ${cy}L${cx + radius} ${cy}`} fill="none" stroke="url(#sweepFade)" strokeWidth="2" className="radar-sweep" />
        <polyline
          points={route}
          fill="none"
          stroke={returning ? '#ee6666' : trajectoryModified ? '#b370cf' : '#43bda6'}
          strokeWidth="2.5"
          strokeDasharray="5 5"
          opacity=".9"
        />
        {mission.map((w, i) => {
          const [x, y] = point(w.p),
            current = !returning && !trajectoryModified && i === routeIndex;
          return (
            <g key={w.id}>
              <circle
                cx={x}
                cy={y}
                r={current ? 5.5 : 3.5}
                fill={current ? '#ffc461' : i === 0 ? '#41c8c0' : '#6fd8c1'}
                stroke="#0b1e2c"
                strokeWidth="2"
              />
              <text x={x + 7} y={y - 6} fill="#c4dce1" fontSize="9">
                {i === 0 ? 'BASE' : w.id}
              </text>
            </g>
          );
        })}
        {trajectoryModified && bypassWaypoint && (
          <g>
            {(() => {
              const [bx, by] = point(bypassWaypoint);
              return (
                <>
                  <polygon
                    points={`${bx},${by - 7} ${bx + 6},${by} ${bx},${by + 7} ${bx - 6},${by}`}
                    fill="#e056fd"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <text x={bx + 9} y={by - 4} fill="#e056fd" fontSize="9" fontWeight="bold">
                    BYPASS
                  </text>
                </>
              );
            })()}
          </g>
        )}
        <g transform={`translate(${cx} ${cy}) rotate(${(heading * 180) / Math.PI})`}>
          <path d="M0 -12L8 9L0 5L-8 9Z" fill="#fff" stroke="#55e6c1" strokeWidth="2" />
        </g>
        <text x="24" y="28" fill="#9abac5" fontSize="10" letterSpacing="2">
          TACTICAL RADAR · POLAR RELATIVE RANGE
        </text>
        <text x="24" y="382" fill="#8ba8b4" fontSize="10">
          DRONE CENTER · ACTIVE TARGET: {active?.name || 'BASE'}
        </text>
        <text x="430" y="28" fill="#8ba8b4" fontSize="10">
          BAT {battery.toFixed(0)}% · RISK {risk}
        </text>
      </svg>
      <div className="radar-caption">Polar radar reflects real-time aerodynamic relative range.</div>
    </div>
  );
}
