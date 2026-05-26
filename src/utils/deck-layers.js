// Copyright 2026 Google LLC
// deck.gl Layers Orchestration & Camera Synchronization with CesiumJS

import { fleetSimulator } from "./fleet-simulator.js";

let deckInstance = null;
let centerCoords = { lat: 40.74244, lng: -74.006144 };
let currentMode = "area-explorer"; // "area-explorer", "fleet-operations", "indoor-venues", "bq-analytics"
let activeLayers = [];

// Helper to calculate deck.gl zoom from Cesium camera height
function calculateZoomFromHeight(height) {
  if (height <= 0) return 18;
  // Logarithmic conversion: range 800m -> zoom ~15, 100m -> zoom ~18
  return Math.max(1, Math.min(20, 18.2 - Math.log2(height / 100)));
}

// Synchronize Cesium Camera state to deck.gl ViewState
function syncCamera(cesiumViewer) {
  if (!deckInstance || !cesiumViewer) return;

  const camera = cesiumViewer.camera;
  const cartographic = Cesium.Cartographic.fromCartesian(camera.position);

  if (!cartographic) return;

  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const height = cartographic.height;

  // Convert angles to degrees
  const bearing = -Cesium.Math.toDegrees(camera.heading);
  const pitch = Cesium.Math.toDegrees(camera.pitch) + 90; // deck.gl 0 = straight down

  const zoom = calculateZoomFromHeight(height);

  deckInstance.setProps({
    viewState: {
      longitude,
      latitude,
      zoom,
      bearing,
      pitch,
      maxPitch: 85,
      minZoom: 1,
      maxZoom: 20
    }
  });
}

// Update Active deck.gl Layers based on current mode and simulators
export function updateDeckLayers() {
  if (!deckInstance) return;

  const layers = [];

  // 1. FLEET OPERATIONS LAYERS
  if (currentMode === "fleet-operations") {
    const vehicles = fleetSimulator.getVehicles();

    // Trace vehicle routes
    layers.push(
      new deck.PathLayer({
        id: "fleet-routes",
        data: vehicles,
        getPath: d => d.route.map(p => [p.lng, p.lat]),
        getColor: d => d.status === "DELAYED" ? [255, 42, 95, 180] : [99, 102, 241, 180],
        getWidth: 3,
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true
      })
    );

    // Active vehicle icons (glowing scatterplots & drivers)
    layers.push(
      new deck.ScatterplotLayer({
        id: "fleet-vehicles",
        data: vehicles,
        getPosition: d => [d.position.lng, d.position.lat],
        getRadius: 15,
        radiusMinPixels: 8,
        radiusMaxPixels: 20,
        getFillColor: d => d.status === "DELAYED" ? [255, 42, 95] : [57, 255, 20],
        getLineColor: [255, 255, 255],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true
      })
    );
  }

  // 2. ORIIENT INDOOR GEOMAGNETIC LAYERS
  if (currentMode === "indoor-venues") {
    const lat = centerCoords.lat;
    const lng = centerCoords.lng;

    // We simulate building indoor layouts relative to the new center
    const floorOutline = [
      [lng - 0.00036, lat - 0.00044],
      [lng + 0.00064, lat - 0.00044],
      [lng + 0.00064, lat + 0.00036],
      [lng - 0.00036, lat + 0.00036],
      [lng - 0.00036, lat - 0.00044]
    ];

    // Store shelves / layout polygons inside building
    const aisles = [
      { path: [[lng - 0.00016, lat - 0.00034], [lng - 0.00016, lat + 0.00026]], name: "Aisle A - Fresh Produce" },
      { path: [[lng + 0.00004, lat - 0.00034], [lng + 0.00004, lat + 0.00026]], name: "Aisle B - Bakery & Cafe" },
      { path: [[lng + 0.00024, lat - 0.00034], [lng + 0.00024, lat + 0.00026]], name: "Aisle C - Dry Groceries" },
      { path: [[lng + 0.00044, lat - 0.00034], [lng + 0.00044, lat + 0.00026]], name: "Checkout Counters" }
    ];

    // Draw transparent building shell
    layers.push(
      new deck.PolygonLayer({
        id: "indoor-building-shell",
        data: [{ polygon: floorOutline }],
        getPolygon: d => d.polygon,
        getFillColor: [0, 229, 255, 30],
        getLineColor: [0, 229, 255, 120],
        getLineWidth: 2,
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true
      })
    );

    // Draw indoor grocery aisles
    layers.push(
      new deck.PathLayer({
        id: "indoor-aisles",
        data: aisles,
        getPath: d => d.path,
        getColor: [255, 255, 255, 100],
        getWidth: 2,
        widthMinPixels: 1.5
      })
    );

    // Simulated Oriient Geomagnetic "Blue Dot" tracking inside building
    // Generates a path that cycles through the aisles
    const now = Date.now() / 4000;
    const dotLat = lat - 0.00034 + (0.0005 * (Math.sin(now) + 1));
    const dotLng = lng - 0.00016 + (0.0005 * (Math.cos(now * 0.5) + 1));

    // Outer radar ring
    layers.push(
      new deck.ScatterplotLayer({
        id: "oriient-radar",
        data: [{ position: [dotLng, dotLat] }],
        getPosition: d => d.position,
        getRadius: 25,
        radiusMinPixels: 12,
        radiusMaxPixels: 40,
        getFillColor: [0, 229, 255, 40],
        getLineColor: [0, 229, 255, 200],
        lineWidthMinPixels: 1.5,
        stroked: true,
        filled: true
      })
    );

    // Core active Blue Dot
    layers.push(
      new deck.ScatterplotLayer({
        id: "oriient-blue-dot",
        data: [{ position: [dotLng, dotLat] }],
        getPosition: d => d.position,
        getRadius: 6,
        radiusMinPixels: 5,
        getFillColor: [0, 229, 255],
        getLineColor: [255, 255, 255],
        lineWidthMinPixels: 2,
        stroked: true,
        filled: true
      })
    );
  }

  // 3. BIGQUERY SPATIAL ANALYTICS HEATMAPS
  if (currentMode === "bq-analytics") {
    // Generate simulated coordinates representing hundreds of historical delivery tasks
    // centered around Chelsea Market area
    const bqData = [];
    const seedLat = centerCoords.lat;
    const seedLng = centerCoords.lng;

    for (let i = 0; i < 400; i++) {
      // Gaussian distribution around seed coordinates
      const r = 0.006 * Math.sqrt(-2 * Math.log(Math.random() || 0.001));
      const theta = 2 * Math.PI * Math.random();
      const lat = seedLat + r * Math.sin(theta);
      const lng = seedLng + r * Math.cos(theta);
      bqData.push({ position: [lng, lat] });
    }

    // Hexagon clustering layer draped over 3D terrain representing BigQuery delivery data
    layers.push(
      new deck.HexagonLayer({
        id: "bq-heatmap",
        data: bqData,
        getPosition: d => d.position,
        radius: 40,
        elevationScale: 4,
        extruded: true,
        pickable: true,
        opacity: 0.7,
        coverage: 0.85,
        colorRange: [
          [243, 232, 255],
          [216, 180, 254],
          [192, 132, 252],
          [168, 85, 247],
          [147, 51, 234],
          [107, 33, 168]
        ]
      })
    );
  }

  deckInstance.setProps({ layers });
}

// Set the active Mode
export function setOpsMode(mode, cesiumViewer) {
  currentMode = mode;
  updateDeckLayers();

  const telemetryPanel = document.getElementById("ops-telemetry-panel");
  if (!telemetryPanel) return;

  if (mode === "area-explorer") {
    telemetryPanel.classList.add("hidden");
    return;
  }

  telemetryPanel.classList.remove("hidden");

  // Load telemetry stats dynamically based on mode
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
          <span class="ops-stat-val">Chelsea Market Retail Hub</span>
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
    
    // Smooth FlyTo building center
    if (cesiumViewer) {
      // Move camera to a close, tilted view looking down at the building
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
          <span class="ops-stat-val">deck.gl Hexagons (Spatial)</span>
        </div>
      </div>
      <div class="ops-panel-section">
        <div class="ops-section-title">DELIVERY COMPLETED MAP</div>
        <div style="font-size: 0.72rem; color: #cbd5e1; line-height: 1.4;">
          Aggregated completed logistics orders in the Chelsea area. Height of the hexagons represents historical density of order drop-offs.
        </div>
      </div>
    `;
    
    // Zoom out slightly to see the hexagon patterns
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

// Initialize the deck.gl overlay
export function initializeDeckOverlay(cesiumViewer) {
  if (deckInstance) return;

  deckInstance = new deck.Deck({
    canvas: "deck-canvas",
    width: "100%",
    height: "100%",
    initialViewState: {
      longitude: -74.006144,
      latitude: 40.74244,
      zoom: 15,
      pitch: 30,
      bearing: 0
    },
    controller: false, // Let Cesium manage camera inputs
    layers: []
  });

  // Connect camera event listeners
  cesiumViewer.camera.changed.addEventListener(() => {
    syncCamera(cesiumViewer);
  });

  // Call sync once at startup
  syncCamera(cesiumViewer);

  // Set up continuous simulation tick loop
  let lastTime = Date.now();
  const tick = () => {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // Advance Fleet Engine simulation
    fleetSimulator.update(deltaTime);

    // Refresh UI overlays & deck layers
    updateDeckLayers();
    updateFleetPanelUI();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
  
  console.log("✅ deck.gl overlay successfully initialized and synced with CesiumJS camera.");
}

// Update operations coordinate center globally
export function updateDeckCenter(newCoords) {
  if (!newCoords) return;
  
  // Accept both google.maps.LatLng object and plain lat/lng literal
  const lat = typeof newCoords.lat === "function" ? newCoords.lat() : newCoords.lat;
  const lng = typeof newCoords.lng === "function" ? newCoords.lng() : newCoords.lng;
  
  centerCoords = { lat, lng };
  
  // Propagate center to fleet simulator
  fleetSimulator.setCenter(centerCoords);
  
  // Refresh deck.gl overlays
  updateDeckLayers();
  
  console.log(`✅ Operations center updated to: lat: ${lat}, lng: ${lng}`);
}
