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

  // 4. BIGQUERY SPATIAL ANALYTICS (USGS Seismic Activity 3D Columns)
  if (currentMode === "bq-analytics") {
    fetch('/api/bq-seismic')
      .then(res => res.json())
      .then(data => {
        // Guard against rapid tab switching
        if (currentMode !== "bq-analytics") return;

        const earthquakes = data.earthquakes || [];
        
        // Update telemetry panel values with real BigQuery metrics
        const bqDatasetLabel = document.querySelector(".bq-dataset-label");
        const bqRowsLabel = document.querySelector(".bq-rows-label");
        const bqLatencyLabel = document.querySelector(".bq-latency-label");
        const bqSourceLabel = document.querySelector(".bq-source-label");
        
        if (bqDatasetLabel) bqDatasetLabel.textContent = data.dataset || "usgs_seismic.earthquakes";
        if (bqRowsLabel) bqRowsLabel.textContent = `${data.recordsAnalyzed || earthquakes.length} rows`;
        if (bqLatencyLabel) bqLatencyLabel.textContent = data.queryLatency || "0.24s";
        if (bqSourceLabel) bqSourceLabel.textContent = data.source || "BigQuery Analytics Table";

        earthquakes.forEach((eq) => {
          const mag = eq.magnitude;
          // Height represents magnitude: scale for global visualization.
          const length = mag * 18000; 

          // Color code based on severity
          let colorStr = "#facc15"; // moderate: yellow
          if (mag >= 6.0) {
            colorStr = "#ff2a5f"; // severe: neon red
          } else if (mag >= 4.5) {
            colorStr = "#fb923c"; // strong: orange
          }
          const color = Cesium.Color.fromCssColorString(colorStr);

          // Render directly at degrees to avoid slow and hanging global clampToHeight calls
          const centerPosition = Cesium.Cartesian3.fromDegrees(eq.longitude, eq.latitude, length / 2);

          // Add Cylinder Entity with rich metadata description window
          const desc = `
            <div style="font-family: 'Space Grotesk', sans-serif; padding: 12px; background: rgba(11, 15, 25, 0.95); border: 1px solid rgba(0,229,255,0.25); border-radius: 8px; color: #fff;">
              <h4 style="margin: 0 0 8px 0; color: #00e5ff; font-weight:700; letter-spacing:0.5px;">🌋 SEISMIC TELEMETRY ACCUMULATION</h4>
              <div style="font-size:0.78rem; margin-bottom:6px;"><strong>Place:</strong> ${eq.place}</div>
              <div style="font-size:0.78rem; margin-bottom:6px;"><strong>Magnitude:</strong> <span style="color: ${colorStr}; font-weight:700;">${mag} M</span></div>
              <div style="font-size:0.78rem; margin-bottom:6px;"><strong>Depth:</strong> ${eq.depth} km</div>
              <div style="font-size:0.78rem; margin-bottom:6px;"><strong>Time (UTC):</strong> ${new Date(eq.time).toUTCString()}</div>
              <div style="font-size:0.7rem; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.1); margin-top:10px; padding-top:6px; text-align:right;">Source: ${data.source}</div>
            </div>
          `;

          const entityId = `bq-column-${eq.id}`;
          
          // Clear any duplicate entity first to resolve async race condition crashes
          const existing = viewerRef.entities.getById(entityId);
          if (existing) {
            viewerRef.entities.remove(existing);
          }

          viewerRef.entities.add({
            id: entityId,
            position: centerPosition,
            description: desc,
            cylinder: {
              length: length,
              topRadius: 16000.0, // visible globally
              bottomRadius: 16000.0,
              material: color.withAlpha(0.75),
              outline: true,
              outlineColor: color,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
          });
        });
        
        console.log(`✅ Loaded ${earthquakes.length} real USGS seismic analytics onto Cesium globe.`);
        
        // Smoothly fly camera to show the biggest earthquake in the recent list (8000km global view)
        if (earthquakes.length > 0 && viewerRef) {
          const biggest = earthquakes[0]; // ordered by magnitude DESC
          viewerRef.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(biggest.longitude, biggest.latitude - 12.0, 8000000), 
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-42),
              roll: 0
            },
            duration: 2.5
          });
        }
      })
      .catch(err => {
        console.error("Failed to load BigQuery seismic data:", err);
      });
  }
}

// Update Dynamic operational overlays smoothly on every frame tick
export function updateDynamicEntities() {
  if (!viewerRef) return;

  // Track active entity IDs in this frame to perform an efficient sweep-cleanup
  const activeIds = new Set();

  // 1. FLEET DYNAMIC VEHICLES
  if (currentMode === "fleet-operations") {
    const vehicles = fleetSimulator.getVehicles();

    vehicles.forEach(v => {
      const id = `fleet-vehicle-${v.id}`;
      activeIds.add(id);

      const position = Cesium.Cartesian3.fromDegrees(v.position.lng, v.position.lat);
      const color = v.status === "DELAYED" ? Cesium.Color.fromCssColorString("#ff2a5f") : Cesium.Color.fromCssColorString("#39ff14");

      const existingEntity = viewerRef.entities.getById(id);
      if (existingEntity) {
        // High-performance in-place property updates (Cesium-native dirty flags)
        existingEntity.position = position;
        if (existingEntity.point) {
          existingEntity.point.color = color;
        }
      } else {
        // Cold start: allocate once
        viewerRef.entities.add({
          id,
          position,
          point: {
            pixelSize: 14,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        });
      }
    });
  }

  // 2. ORIIENT INDOOR PULSING BLUE DOT & RADAR
  if (currentMode === "indoor-venues") {
    const lat = centerCoords.lat;
    const lng = centerCoords.lng;

    const now = Date.now() / 4000;
    const dotLat = lat - 0.00034 + (0.0005 * (Math.sin(now) + 1));
    const dotLng = lng - 0.00016 + (0.0005 * (Math.cos(now * 0.5) + 1));
    const position = Cesium.Cartesian3.fromDegrees(dotLng, dotLat);

    // Core Blue Dot
    const blueDotId = "oriient-blue-dot";
    activeIds.add(blueDotId);
    const existingBlueDot = viewerRef.entities.getById(blueDotId);
    if (existingBlueDot) {
      existingBlueDot.position = position;
    } else {
      viewerRef.entities.add({
        id: blueDotId,
        position,
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString("#00e5ff"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2.3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
    }

    // Pulse radar ring
    const radarId = "oriient-radar";
    activeIds.add(radarId);
    const radarScale = 16 + 10 * Math.sin(Date.now() / 400);
    const existingRadar = viewerRef.entities.getById(radarId);
    if (existingRadar) {
      existingRadar.position = position;
      if (existingRadar.point) {
        existingRadar.point.pixelSize = radarScale;
      }
    } else {
      viewerRef.entities.add({
        id: radarId,
        position,
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

  // 3. SWEEP-CLEANUP OF INACTIVE OVERLAY ENTITIES
  // Efficiently sweeps away entities belonging to other modes or offline devices
  const dynamicPrefixes = ["fleet-vehicle-", "oriient-blue-dot", "oriient-radar"];
  const entitiesToRemove = [];

  viewerRef.entities.values.forEach(entity => {
    if (entity.id && dynamicPrefixes.some(prefix => entity.id.startsWith(prefix))) {
      if (!activeIds.has(entity.id)) {
        entitiesToRemove.push(entity);
      }
    }
  });

  entitiesToRemove.forEach(entity => {
    viewerRef.entities.remove(entity);
  });
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
          <span class="ops-stat-label">Telemetry Source</span>
          <span class="ops-stat-val bq-source-label" style="color: var(--neon-blue);">Connecting to BigQuery...</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Queried Dataset</span>
          <span class="ops-stat-val bq-dataset-label">Querying...</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Records Analyzed</span>
          <span class="ops-stat-val bq-rows-label">Analyzing...</span>
        </div>
        <div class="ops-stat-row">
          <span class="ops-stat-label">Query Latency</span>
          <span class="ops-stat-val bq-latency-label">0.0s</span>
        </div>
      </div>
      <div class="ops-panel-section">
        <div class="ops-section-title">🌋 USGS SEISMIC ACTIVITY</div>
        <div style="font-size: 0.72rem; color: #cbd5e1; line-height: 1.4;">
          Aggregated recent Earthquakes of M2.5+ over the past 7 days. Glowing cylinder heights represent magnitude, color-coded by severity, perfectly clamped to coordinates. Click on any cylinder to inspect full telemetry.
        </div>
      </div>
      <div class="ops-panel-section" id="bq-telemetry-hud">
        <div class="ops-section-title">🌋 SELECTED SEISMIC TELEMETRY</div>
        <div style="font-size: 0.72rem; color: #94a3b8; line-height: 1.4;">
          Click on any glowing cylinder on the globe to inspect real-time earthquake parameters.
        </div>
      </div>
    `;
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

  // LEFT_CLICK interaction handler for BigQuery seismic cylinders
  const bqClickHandler = new Cesium.ScreenSpaceEventHandler(viewerRef.canvas);
  bqClickHandler.setInputAction((click) => {
    if (currentMode !== "bq-analytics") return;
    const pickedObject = viewerRef.scene.pick(click.position);
    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id && pickedObject.id.id.startsWith("bq-column-")) {
      const entity = pickedObject.id;
      const desc = entity.description.getValue();
      const bqHud = document.getElementById("bq-telemetry-hud");
      if (bqHud) {
        bqHud.innerHTML = `
          <div class="ops-section-title" style="color: var(--neon-red); margin-top: 8px;">🌋 ACTIVE TELEMETRY DETAILS</div>
          ${desc}
        `;
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

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
  
  // Propagate center to fleet simulator with a callback to redraw once real roads resolve
  fleetSimulator.setCenter(centerCoords, () => {
    drawStaticEntities();
    updateDeckLayers();
    console.log("🛣️ Fleet simulator snapped routes successfully calculated and drawn on real road segments.");
  });
  
  // Redraw static entities immediately centered on the new location using fallback translation
  drawStaticEntities();
  updateDeckLayers();
  
  console.log(`✅ Operations center updated to: lat: ${lat}, lng: ${lng}`);
}
