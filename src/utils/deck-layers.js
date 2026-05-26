// Copyright 2026 Google LLC
// Geospatial Overlay Management using Native CesiumJS Clamped Primitives & Entities

import { fleetSimulator } from "./fleet-simulator.js";
import { stopAutoOrbitAnimation } from "./cesium.js";

let viewerRef = null;
let centerCoords = { lat: 40.74244, lng: -74.006144 };
let currentMode = "area-explorer"; // "area-explorer", "fleet-operations", "indoor-venues", "bq-analytics"

// Clear only dynamic moving entities from Cesium scene on every frame
function clearDynamicEntities() {
  if (!viewerRef) return;
  const dynamicPrefixes = ["fleet-vehicle-", "oriient-blue-dot", "oriient-radar"];
  const entitiesToRemove = [];
  
  viewerRef.entities.values.forEach(entity => {
    if (dynamicPrefixes.some(prefix => entity.id && entity.id.startsWith(prefix))) {
      entitiesToRemove.push(entity);
    }
  });
  
  entitiesToRemove.forEach(entity => {
    viewerRef.entities.remove(entity);
  });
}

// Clear static elements (routes, shell layout, BQ cylinder bars)
function clearStaticEntities() {
  if (!viewerRef) return;
  const staticPrefixes = ["fleet-route-", "indoor-shell", "indoor-aisle-", "bq-column-"];
  const entitiesToRemove = [];
  
  viewerRef.entities.values.forEach(entity => {
    if (staticPrefixes.some(prefix => entity.id && entity.id.startsWith(prefix))) {
      entitiesToRemove.push(entity);
    }
  });
  
  entitiesToRemove.forEach(entity => {
    viewerRef.entities.remove(entity);
  });
}

// Draw static operational elements once per mode switch or center translation
export function drawStaticEntities() {
  if (!viewerRef) return;

  // 1. Clear previous static representations
  clearStaticEntities();

  // 2. FLEET ENGINE STATIC ROUTES
  if (currentMode === "fleet-operations") {
    const vehicles = fleetSimulator.getVehicles();

    vehicles.forEach(v => {
      const routePositions = [];
      v.route.forEach(p => {
        routePositions.push(p.lng, p.lat);
      });

      const colorHex = v.status === "DELAYED" ? "#ff2a5f" : "#6366f1";
      const color = Cesium.Color.fromCssColorString(colorHex);

      // Draw the static route polyline clamped perfectly to 3D terrain/roads
      viewerRef.entities.add({
        id: `fleet-route-${v.id}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(routePositions),
          width: 3.5,
          material: color.withAlpha(0.7),
          clampToGround: true
        }
      });
    });
  }

  // 3. ORIIENT INDOOR LAYOUT & AISLES
  if (currentMode === "indoor-venues") {
    const lat = centerCoords.lat;
    const lng = centerCoords.lng;

    const floorOutline = [
      lng - 0.00036, lat - 0.00044,
      lng + 0.00064, lat - 0.00044,
      lng + 0.00064, lat + 0.00036,
      lng - 0.00036, lat + 0.00036,
      lng - 0.00036, lat - 0.00044
    ];

    // building shell outline draped flawlessly across rooftops and floors
    viewerRef.entities.add({
      id: "indoor-shell",
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(floorOutline),
        material: Cesium.Color.fromCssColorString("#00e5ff").withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#00e5ff"),
        classificationType: Cesium.ClassificationType.BOTH
      }
    });

    const aisles = [
      [lng - 0.00016, lat - 0.00034, lng - 0.00016, lat + 0.00026],
      [lng + 0.00004, lat - 0.00034, lng + 0.00004, lat + 0.00026],
      [lng + 0.00024, lat - 0.00034, lng + 0.00024, lat + 0.00026],
      [lng + 0.00044, lat - 0.00034, lng + 0.00044, lat + 0.00026]
    ];

    aisles.forEach((aisle, i) => {
      viewerRef.entities.add({
        id: `indoor-aisle-${i}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(aisle),
          width: 2.5,
          material: Cesium.Color.WHITE.withAlpha(0.4),
          clampToGround: true
        }
      });
    });
  }

  // 4. BIGQUERY SPATIAL ANALYTICS (Highly Optimized 3D Cylinder Heatmaps)
  if (currentMode === "bq-analytics") {
    const seedLat = centerCoords.lat;
    const seedLng = centerCoords.lng;

    // Cache clusters statically to prevent infinite random redraws
    if (!window.bqClustersCache) {
      window.bqClustersCache = [];
      for (let i = 0; i < 70; i++) {
        const r = 0.0055 * Math.sqrt(-2 * Math.log(Math.random() || 0.001));
        const theta = 2 * Math.PI * Math.random();
        const lat = seedLat + r * Math.sin(theta);
        const lng = seedLng + r * Math.cos(theta);
        const count = Math.floor(Math.random() * 450) + 50;
        window.bqClustersCache.push({ lat, lng, count });
      }
    }

    const bqCoords = window.bqClustersCache.map(cluster => {
      const latOffset = cluster.lat - seedLat;
      const lngOffset = cluster.lng - seedLng;
      return Cesium.Cartesian3.fromDegrees(seedLng + lngOffset, seedLat + latOffset);
    });

    // Clamp coordinates once to rooftops & streets in a single highly optimized call
    viewerRef.scene.clampToHeightMostDetailed(bqCoords).then(clampedCoords => {
      // Guard against rapid mode switching
      if (currentMode !== "bq-analytics") return;

      clampedCoords.forEach((clampedCoord, i) => {
        const cluster = window.bqClustersCache[i];
        
        let colorStr = "#f3e8ff";
        if (cluster.count > 400) colorStr = "#6b21a8";
        else if (cluster.count > 300) colorStr = "#9333ea";
        else if (cluster.count > 200) colorStr = "#a855f7";
        else if (cluster.count > 100) colorStr = "#c084fc";
        
        const color = Cesium.Color.fromCssColorString(colorStr);
        const length = cluster.count * 1.5;

        // Position cylinder center at: Rooftop elevation + (Length / 2)
        // This ensures the BASE sits perfectly flat on Google 3D Tiles rooftops and streets!
        const cartographic = Cesium.Cartographic.fromCartesian(clampedCoord);
        const centerPosition = Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          cartographic.height + (length / 2)
        );

        viewerRef.entities.add({
          id: `bq-column-${i}`,
          position: centerPosition,
          cylinder: {
            length: length,
            topRadius: 18.0,
            bottomRadius: 18.0,
            material: color.withAlpha(0.75),
            outline: true,
            outlineColor: color
          }
        });
      });
      console.log("✅ BigQuery 3D columns clamped perfectly onto building rooftops and streets.");
    }).catch(err => {
      console.error("Error clamping BigQuery columns to heights:", err);
    });
  }
}

// Update Dynamic operational overlays smoothly on every frame tick
export function updateDynamicEntities() {
  if (!viewerRef) return;

  // Clear last frame's moving elements
  clearDynamicEntities();

  // 1. FLEET DYNAMIC VEHICLES
  if (currentMode === "fleet-operations") {
    const vehicles = fleetSimulator.getVehicles();

    vehicles.forEach(v => {
      viewerRef.entities.add({
        id: `fleet-vehicle-${v.id}`,
        position: Cesium.Cartesian3.fromDegrees(v.position.lng, v.position.lat),
        point: {
          pixelSize: 14,
          color: v.status === "DELAYED" ? Cesium.Color.fromCssColorString("#ff2a5f") : Cesium.Color.fromCssColorString("#39ff14"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
    });
  }

  // 2. ORIIENT INDOOR PULSING BLUE DOT
  if (currentMode === "indoor-venues") {
    const lat = centerCoords.lat;
    const lng = centerCoords.lng;

    const now = Date.now() / 4000;
    const dotLat = lat - 0.00034 + (0.0005 * (Math.sin(now) + 1));
    const dotLng = lng - 0.00016 + (0.0005 * (Math.cos(now * 0.5) + 1));

    // Core Blue Dot
    viewerRef.entities.add({
      id: "oriient-blue-dot",
      position: Cesium.Cartesian3.fromDegrees(dotLng, dotLat),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString("#00e5ff"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2.3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });

    // Pulse radar ring
    const radarScale = 16 + 10 * Math.sin(Date.now() / 400);
    viewerRef.entities.add({
      id: "oriient-radar",
      position: Cesium.Cartesian3.fromDegrees(dotLng, dotLat),
      point: {
        pixelSize: radarScale,
        color: Cesium.Color.fromCssColorString("#00e5ff").withAlpha(0.2),
        outlineColor: Cesium.Color.fromCssColorString("#00e5ff").withAlpha(0.55),
        outlineWidth: 1.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });
  }
}

// Refresh active visual states
export function updateDeckLayers() {
  updateDynamicEntities();
}

// Configure active operations mode globally
export function setOpsMode(mode, cesiumViewer) {
  // Clear any camera fight orbit animations
  stopAutoOrbitAnimation();

  currentMode = mode;

  // Redraw all static structures immediately for the new mode
  drawStaticEntities();

  // Draw initial dynamic elements immediately
  updateDeckLayers();

  const telemetryPanel = document.getElementById("ops-telemetry-panel");
  if (!telemetryPanel) return;

  if (mode === "area-explorer") {
    telemetryPanel.classList.add("hidden");
    return;
  }

  telemetryPanel.classList.remove("hidden");

  // Load telemetry panel UI templates
  if (mode === "fleet-operations") {
    telemetryPanel.innerHTML = `
      <div class="ops-panel-section">
        <div class="ops-section-title">🚚 FLEET ENGINE METRICS</div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Active Transits</span>
          <span class="ops-stat-val active-vehicle">3 Vehicles Online</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Routing SLA</span>
          <span class="ops-stat-val">98.4%</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Telemetry Feed</span>
          <span class="ops-stat-val">Active (Real-time)</span>
        </div>
      </div>
      <div class="ops-panel-section">
        <div class="ops-section-title">ACTIVE TRACKING</div>
        <div id="fleet-telemetry-list">
          <div style="font-size: 0.75rem; color: #94a3b8; line-height: 1.4;">
            Loading active driver logs...
          </div>
        </div>
      </div>
    `;
    updateFleetPanelUI();
  } else if (mode === "indoor-venues") {
    telemetryPanel.innerHTML = `
      <div class="ops-panel-section">
        <div class="ops-section-title">🏢 ORIIENT INDOOR GPS</div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Active Venue</span>
          <span class="ops-stat-val"> Chelsea Market Retail Hub</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Calibration State</span>
          <span class="ops-stat-val" style="color: var(--neon-blue);">Geomagnetic (Locked)</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Accuracy (sub-meter)</span>
          <span class="ops-stat-val">± 0.45 meters</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Sensor Lock</span>
          <span class="ops-stat-val">Smartphone Magnetometer</span>
        </div>
      </div>
      <div class="ops-panel-section">
        <div class="ops-section-title">INDOOR FLOOR TRACKER</div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Active Floor Level</span>
          <span class="ops-stat-val" style="color: var(--neon-blue); font-family: 'Space Grotesk'; font-weight:700;">LEVEL 1</span>
        </div>
        <div style="font-size: 0.72rem; color: #94a3b8; line-height: 1.4; margin-top: 8px;">
          Oriient Geomagnetic Blue Dot matches the Earth's localized magnetic signatures inside this building.
        </div>
      </div>
    `;
    
    if (cesiumViewer) {
      cesiumViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerCoords.lng, centerCoords.lat - 0.001, 200),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-35),
          roll: 0
        },
        duration: 2.5
      });
    }
  } else if (mode === "bq-analytics") {
    telemetryPanel.innerHTML = `
      <div class="ops-panel-section">
        <div class="ops-section-title">📊 BIGQUERY GEOSPATIAL DATA</div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Queried Dataset</span>
          <span class="ops-stat-val bq-rows">nyc_logistics.deliveries_3d</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Records Analyzed</span>
          <span class="ops-stat-val bq-rows">1,248,390 rows</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Query Latency</span>
          <span class="ops-stat-val">0.34 seconds</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Visualization Cluster</span>
          <span class="ops-stat-val">3D Cylinders (Clamped)</span>
        </div>
      </div>
      <div class="ops-panel-section">
        <div class="ops-section-title">DELIVERY COMPLETED MAP</div>
        <div style="font-size: 0.72rem; color: #cbd5e1; line-height: 1.4;">
          Aggregated completed logistics orders. Length of the cylinders represents historical density of order drop-offs, perfectly clamped to ground level.
        </div>
      </div>
    `;
    
    if (cesiumViewer) {
      cesiumViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerCoords.lng, centerCoords.lat - 0.004, 1200),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: 2.0
      });
    }
  }
}

// Live update of driver details on the Fleet Panel
function updateFleetPanelUI() {
  const listDiv = document.getElementById("fleet-telemetry-list");
  if (!listDiv || currentMode !== "fleet-operations") return;

  const vehicles = fleetSimulator.getVehicles();
  listDiv.innerHTML = vehicles.map(v => `
    <div style="margin-bottom: 12px; padding: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px;">
      <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.78rem;">
        <span style="color: #fff;">${v.id} (${v.type})</span>
        <span style="color: ${v.status === 'DELAYED' ? 'var(--neon-red)' : 'var(--neon-green)'};">${v.status}</span>
      </div>
      <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">Driver: ${v.driver}</div>
      <div style="font-size: 0.72rem; color: #94a3b8;">Task: ${v.task}</div>
      <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #818cf8; margin-top: 6px;">
        <span>ETA: ${v.eta} min</span>
        <span>Fuel: ${v.fuel}%</span>
      </div>
    </div>
  `).join("");
}

// Initialize the layers controller
export function initializeDeckOverlay(cesiumViewer) {
  if (viewerRef) return;
  viewerRef = cesiumViewer;

  // Deprecate transparent deck-canvas overlay
  const canvas = document.getElementById("deck-canvas");
  if (canvas) {
    canvas.style.display = "none";
  }

  // Set up continuous simulation tick loop
  let lastTime = Date.now();
  const tick = () => {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // Advance Fleet Engine simulation
    fleetSimulator.update(deltaTime);

    // Refresh Dynamic Cesium Entities (vehicles & blue dot position updates)
    updateDeckLayers();
    updateFleetPanelUI();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
  
  // Render initial static elements
  drawStaticEntities();

  console.log("✅ Native Cesium ground-clamped overlays successfully initialized.");
}

// Update operations coordinate center globally
export function updateDeckCenter(newCoords) {
  if (!newCoords) return;
  
  const lat = typeof newCoords.lat === "function" ? newCoords.lat() : newCoords.lat;
  const lng = typeof newCoords.lng === "function" ? newCoords.lng() : newCoords.lng;
  
  centerCoords = { lat, lng };

  // Clear BigQuery clusters cache so they re-cluster around the new location
  window.bqClustersCache = null;
  
  // Propagate center to fleet simulator
  fleetSimulator.setCenter(centerCoords);
  
  // Redraw static entities immediately centered on the new location
  drawStaticEntities();
  updateDeckLayers();
  
  console.log(`✅ Operations center updated to: lat: ${lat}, lng: ${lng}`);
}
