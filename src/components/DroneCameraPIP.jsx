import React, { useEffect, useRef, useState } from 'react';
import { Video, X, Eye, Maximize2, Minimize2, Crosshair, Compass, Sun, ShieldAlert, ZoomIn } from 'lucide-react';
import L from 'leaflet';
import { localToLatLng } from '../utils/coordinateConverter';
import { useTwin } from '../simulation/store';

/**
 * Tactical Drone Downward Gimbal & Optical Camera PIP
 * Captures real-time photorealistic Google Satellite / Esri imagery, target crosshairs, and thermal FLIR overlay.
 */
export default function DroneCameraPIP({ position, heading, velocity, altitude, onClose }) {
  const [filterMode, setFilterMode] = useState('RGB'); // 'RGB' | 'FLIR' | 'NVG'
  const [zoomLevel, setZoomLevel] = useState(18); // 17 (1x), 18 (2x), 19 (4x)
  const [minimized, setMinimized] = useState(false);
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  const geo = localToLatLng(position[0], position[2]);
  const headingDeg = Math.round(((heading * 180) / Math.PI + 360) % 360);

  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const mapInstance = L.map(mapContainerRef.current, {
      attributionControl: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([geo.latitude, geo.longitude], zoomLevel);

    // Primary High-Resolution Google Satellite Hybrid Layer
    const satTile = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
    }).addTo(mapInstance);
    tileLayerRef.current = satTile;

    satTile.on('tileerror', () => {
      // Seamless fallback to Esri World Imagery if Google is unavailable
      if (tileLayerRef.current) {
        mapInstance.removeLayer(tileLayerRef.current);
      }
      const esriTile = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(mapInstance);
      tileLayerRef.current = esriTile;
    });

    // Tactical Target Reticle on Ground Center
    markerRef.current = L.circleMarker([geo.latitude, geo.longitude], {
      radius: 8,
      color: '#00f2fe',
      fillColor: '#4facfe',
      fillOpacity: 0.85,
      weight: 2,
    }).addTo(mapInstance);

    leafletMapRef.current = mapInstance;
    L.Util.requestAnimFrame(() => mapInstance.invalidateSize());

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update zoom level
  const handleZoomChange = (newZoom) => {
    setZoomLevel(newZoom);
    if (leafletMapRef.current) {
      leafletMapRef.current.setZoom(newZoom);
    }
  };

  // Update map center on drone movement
  useEffect(() => {
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([geo.latitude, geo.longitude], zoomLevel, { animate: false });
      if (markerRef.current) {
        markerRef.current.setLatLng([geo.latitude, geo.longitude]);
      }
    }
  }, [geo.latitude, geo.longitude, zoomLevel]);

  return (
    <div className={`drone-pip-card ${minimized ? 'minimized' : ''} filter-${filterMode.toLowerCase()}`}>
      <div className="pip-head">
        <div className="pip-title">
          <span className="live-rec-dot" />
          <Video size={13} />
          <b>OPTICAL SENSOR · GIMBAL DOWNWARD (NADIR)</b>
        </div>
        <div className="pip-controls">
          {/* Digital Zoom Controls */}
          <div className="filter-buttons zoom-group">
            <button
              className={zoomLevel === 17 ? 'active' : ''}
              onClick={() => handleZoomChange(17)}
              title="1x Wide Field of View"
            >
              1x
            </button>
            <button
              className={zoomLevel === 18 ? 'active' : ''}
              onClick={() => handleZoomChange(18)}
              title="2x Medium Drone Gimbal Zoom"
            >
              2x
            </button>
            <button
              className={zoomLevel === 19 ? 'active' : ''}
              onClick={() => handleZoomChange(19)}
              title="4x High-Magnification Inspection"
            >
              4x
            </button>
          </div>

          {/* Sensor Filter Mode Buttons */}
          <div className="filter-buttons">
            <button
              className={filterMode === 'RGB' ? 'active' : ''}
              onClick={() => setFilterMode('RGB')}
              title="Photorealistic Google Satellite daylight imagery"
            >
              🛰️ SATELLITE
            </button>
            <button
              className={filterMode === 'FLIR' ? 'active' : ''}
              onClick={() => setFilterMode('FLIR')}
              title="Thermal FLIR infrared sensor"
            >
              FLIR
            </button>
            <button
              className={filterMode === 'NVG' ? 'active' : ''}
              onClick={() => setFilterMode('NVG')}
              title="Night Vision tactical green"
            >
              NVG
            </button>
          </div>

          <button
            className="pip-icon-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand camera' : 'Minimize'}
          >
            {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button className="pip-icon-btn" onClick={onClose} title="Close camera feed">
            <X size={13} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="pip-viewport">
          <div ref={mapContainerRef} className="pip-map-canvas" />

          {/* Tactical Crosshair Reticle HUD */}
          <div className="pip-hud-reticle">
            <div className="crosshair-h" />
            <div className="crosshair-v" />
            <div className="reticle-ring" />
            <div className="reticle-box" />
            <div className="hud-heading-pointer" style={{ transform: `rotate(${headingDeg}deg)` }}>
              ▲
            </div>
          </div>

          {/* HUD Telemetry Overlay */}
          <div className="pip-hud-stats top-left">
            <span>ALT AGL: <b>{position[1].toFixed(1)} m</b></span>
            <span>GROUND VEL: <b>{velocity.toFixed(1)} m/s</b></span>
            <span>HDG: <b>{headingDeg}°</b></span>
          </div>

          <div className="pip-hud-stats top-right">
            <span>MODE: <b>{filterMode === 'RGB' ? 'SATELLITE (RGB)' : filterMode}</b></span>
            <span>GIMBAL: <b>-90.0° (NADIR)</b></span>
            <span>ZOOM: <b>{zoomLevel === 17 ? '1.0x' : zoomLevel === 18 ? '2.0x' : '4.0x'}</b></span>
            <span>FPS: <b>60 LIVE</b></span>
          </div>

          <div className="pip-hud-stats bottom-left">
            <span>GPS: <b>{geo.latitude.toFixed(5)}°N, {geo.longitude.toFixed(5)}°E</b></span>
            <span>TARGET LOCK: <b>ACTIVE</b></span>
          </div>

          <div className="pip-hud-stats bottom-right">
            <span>AIR DENSITY: <b>1.22 kg/m³</b></span>
          </div>
        </div>
      )}
    </div>
  );
}
