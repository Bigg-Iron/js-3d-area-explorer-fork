// Copyright 2026 Google LLC
import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useStore } from '../store/useStore';
import { getPlaceDetails } from '../utils/places';
import { fleetSimulator } from '../utils/fleet-simulator';

// Camera height above the target when flying to a point
const CAMERA_HEIGHT = 100;
const BASE_PITCH = -30;
const AUTO_ORBIT_PITCH_AMPLITUDE = 10;
const RANGE_AMPLITUDE_RELATIVE = 0.55;
const ZOOM_FACTOR = 20;

const CAMERA_OFFSET = {
  heading: 0,
  pitch: Cesium.Math.toRadians(BASE_PITCH),
  range: 800,
};

const START_COORDINATES = {
  longitude: 0,
  latitude: 60,
  height: 15000000,
};

// Global export of the Cesium viewer instance
export let cesiumViewer = null;

export async function performFlyTo(coords, options = {}) {
  if (!cesiumViewer || !coords) return;
  try {
    const { range = CAMERA_OFFSET.range, duration } = options;
    const store = useStore.getState();

    // Stop auto-orbit during fly
    if (store.cameraState.autoOrbitEnabled) {
      // Temporarily bypass store reaction if needed, but Zustand updates are reactive
    }

    const targetCoords = {
      lat: typeof coords.lat === 'function' ? coords.lat() : coords.lat,
      lng: typeof coords.lng === 'function' ? coords.lng() : coords.lng
    };

    const adjustedCoords = await adjustCoordinateHeight(targetCoords);

    cesiumViewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(adjustedCoords, 0),
      {
        offset: new Cesium.HeadingPitchRange(cesiumViewer.camera.heading, Cesium.Math.toRadians(store.cameraState.orbitPitch), range),
        duration: duration !== undefined ? duration : 1.5,
      }
    );
  } catch (error) {
    console.error("Error during performFlyTo:", error);
  }
}

let lastClampedCoords = null;
let cachedClampedCartesian = null;

async function adjustCoordinateHeight(coords) {
  const { lat, lng } = coords;
  const cartesian = Cesium.Cartesian3.fromDegrees(lng, lat);
  if (!cesiumViewer) return cartesian;

  if (lastClampedCoords && lastClampedCoords.lat === lat && lastClampedCoords.lng === lng && cachedClampedCartesian) {
    return cachedClampedCartesian;
  }

  try {
    const clampedCoords = await cesiumViewer.scene.clampToHeightMostDetailed([cartesian]);
    if (clampedCoords && clampedCoords[0]) {
      const cartographic = Cesium.Cartographic.fromCartesian(clampedCoords[0]);
      const result = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height + CAMERA_HEIGHT
      );
      lastClampedCoords = { lat, lng };
      cachedClampedCartesian = result;
      return result;
    }
  } catch (err) {
    console.warn("clampToHeightMostDetailed failed, using baseline fallback:", err);
  }

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const result = Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    cartographic.height + CAMERA_HEIGHT
  );
  lastClampedCoords = { lat, lng };
  cachedClampedCartesian = result;
  return result;
}

// Marker configuration details
const defaultMarkerScale = 0.744;
const defaultLabelOffset = -60;
const defaultLabelVisibility = new Cesium.NearFarScalar(650, 1, 1000, 0);
const CENTER_MARKER_ID = "center";
let createdEntityIds = [];
let markerClickHandler = null;
let markerHoverHandler = null;
let hoveredMarker = null;

async function fetchSvgContent(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const text = await response.text();
    return new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  } catch (error) {
    console.warn(`Failed to fetch SVG ${url}, using store fallback.`, error);
    try {
      const fallbackResponse = await fetch("/assets/icons/poi/store.svg");
      if (fallbackResponse.ok) {
        const text = await fallbackResponse.text();
        return new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
      }
    } catch (fallbackErr) {
      console.error("Critical fallback SVG fetch failed:", fallbackErr);
    }
    const dummySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    dummySvg.setAttribute("viewBox", "0 0 24 24");
    return dummySvg;
  }
}

function setSvgAttributes(svgElement, attributes) {
  Object.entries(attributes).forEach(([key, value]) => svgElement.setAttribute(key, value));
}

function encodeSvgToDataUri(svgElement) {
  return `data:image/svg+xml,${encodeURIComponent(svgElement.outerHTML)}`;
}

async function createMarkerSvg(markerData) {
  const baseSvgElement = await fetchSvgContent("/assets/icons/empty-marker.svg");
  const iconSvgElement = await fetchSvgContent(
    markerData.icon_mask_base_uri.startsWith('/') 
      ? `${markerData.icon_mask_base_uri}.svg` 
      : `/${markerData.icon_mask_base_uri}.svg`
  );

  const baseConfig = {
    fill: markerData.icon_background_color,
    height: markerData.isCenterLocation ? "70" : "60",
    width: markerData.isCenterLocation ? "96" : "80",
    stroke: markerData.isCenterLocation ? "#8C2820" : "white",
  };

  const iconConfig = {
    width: markerData.isCenterLocation ? "18" : "15",
    height: markerData.isCenterLocation ? "18" : "15",
    x: markerData.isCenterLocation ? "14.5" : "16.5",
    y: markerData.isCenterLocation ? "14.5" : "16.5",
    fill: "white",
    border: "none",
    stroke: "none",
  };

  setSvgAttributes(baseSvgElement, baseConfig);
  setSvgAttributes(iconSvgElement, iconConfig);
  baseSvgElement.appendChild(iconSvgElement);

  return encodeSvgToDataUri(baseSvgElement);
}

function addHeightOffset(coord, heightOffset) {
  const cartographic = Cesium.Cartographic.fromCartesian(coord);
  return Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    cartographic.height + heightOffset
  );
}

function truncateName(name) {
  const maximumNameLength = 25;
  if (name && name.length > maximumNameLength) {
    return name.slice(0, maximumNameLength) + "...";
  }
  return name || "";
}

function getPolylineConfiguration({ start, end }) {
  return {
    polyline: {
      positions: [start, end],
      material: Cesium.Color.WHITE,
    },
  };
}

function getMarkerEntityConfiguration({ position, id, name, markerSvg }) {
  return {
    position,
    id,
    label: {
      font: "20px var(--font-family, sans-serif)",
      text: truncateName(name),
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineColor: Cesium.Color.GREY,
      outlineWidth: 1,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      pixelOffset: new Cesium.Cartesian2(0, defaultLabelOffset),
      scaleByDistance: defaultLabelVisibility,
    },
    billboard: {
      image: markerSvg,
      scale: defaultMarkerScale,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    },
  };
}

export function setSelectedMarker(marker) {
  if (!cesiumViewer) return;
  const store = useStore.getState();
  const prevId = store.selectedPlaceId;
  const prevMarker = prevId ? cesiumViewer.entities.getById(prevId) : null;

  if (prevMarker && prevMarker.billboard && prevMarker.label) {
    prevMarker.billboard.scale = defaultMarkerScale;
    prevMarker.label.pixelOffset = new Cesium.Cartesian2(0, defaultLabelOffset);
  }

  if (marker && marker.billboard && marker.label) {
    marker.billboard.scale = 1.0;
    marker.label.pixelOffset = new Cesium.Cartesian2(0, -80);
  }
}

export const MapViewer = () => {
  const containerRef = useRef(null);
  
  const opsMode = useStore((state) => state.opsMode);
  const centerCoords = useStore((state) => state.centerCoords);
  const nearbyPois = useStore((state) => state.nearbyPois);
  const selectedPlaceId = useStore((state) => state.selectedPlaceId);
  
  const setNearbyPois = useStore((state) => state.setNearbyPois);
  const setSelectedPlace = useStore((state) => state.setSelectedPlace);
  const updateCameraState = useStore((state) => state.updateCameraState);

  // Initialize Cesium Viewer on Mount
  useEffect(() => {
    if (!containerRef.current) return;

    Cesium.Ion.defaultAccessToken = null;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      imageryProvider: false,
      homeButton: false,
      fullscreenButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      geocoder: false,
      infoBox: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
    });

    viewer.scene.globe.baseColor = Cesium.Color.TRANSPARENT;
    viewer.resolutionScale = 2.0;
    viewer.scene.screenSpaceCameraController.enableLook = false;

    // Default Starting View over globe
    const { latitude, longitude, height } = START_COORDINATES;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });

    cesiumViewer = viewer;

    // Load Photorealistic 3D Tileset
    const loadTileset = async () => {
      try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        const apiKey = config.apiKey;

        if (apiKey) {
          const tileset = await Cesium.Cesium3DTileset.fromUrl(
            `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`
          );
          viewer.scene.primitives.add(tileset);
        } else {
          throw new Error("Missing API Key");
        }
      } catch (err) {
        console.warn("3D Google Tiles unavailable, deploying OpenStreetMap 3D buildings & imagery...", err);
        try {
          const osmImageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            minimumLevel: 0,
            maximumLevel: 19
          });
          viewer.imageryLayers.addImageryProvider(osmImageryProvider);
        } catch (imageryErr) {
          console.error("OSM Imagery Provider fallback failed:", imageryErr);
        }

        try {
          const osmBuildings = await Cesium.createOsmBuildingsAsync();
          viewer.scene.primitives.add(osmBuildings);
        } catch (fallbackError) {
          console.error("OSM Fallback failed:", fallbackError);
        }
      }
    };

    loadTileset();

    // Add Attribution
    const cesiumCredits = viewer.scene.frameState.creditDisplay.container;
    const text = document.createTextNode("Google • Landsat / Copernicus • IBCAO • Data SIO, NOAA, U.S. Navy, NGA, GEBCO • U.S. Geological Survey");
    text.className = "cesium-credits__text";
    cesiumCredits.prepend(text);

    const img = document.createElement("img");
    img.src = "/assets/google-attribution.png";
    img.alt = "Google";
    cesiumCredits.prepend(img);

    // Initial camera movement to center coordinates
    const initialCenter = useStore.getState().centerCoords;
    performFlyTo(initialCenter);

    // Continuous RequestAnimationFrame simulation tick loop
    let lastTime = Date.now();
    let animationFrameId = 0;
    let heading = 0;

    const tick = () => {
      const storeState = useStore.getState();
      const currentTimestamp = Date.now();
      const deltaTime = (currentTimestamp - lastTime) / 1000;
      lastTime = currentTimestamp;

      // Update vehicle positions in Zustand/Fleet
      fleetSimulator.update(deltaTime);

      // 1. Process Auto-Orbit camera moves if active
      const cameraConfig = storeState.cameraState;
      if (cameraConfig.autoOrbitEnabled && viewer.scene) {
        // Calculate orbit center height
        const activeCenter = storeState.centerCoords;
        const radianSpeed = deltaTime * (cameraConfig.orbitSpeed / 60) * Math.PI * 2;
        heading += radianSpeed;

        const currentBaseRange = cameraConfig.orbitRadius;
        const currentBasePitch = Cesium.Math.toRadians(cameraConfig.orbitPitch);
        const pitchAmplitude = Cesium.Math.toRadians(AUTO_ORBIT_PITCH_AMPLITUDE);

        // Orbit styles calculations
        const pitch = cameraConfig.orbitStyle === 'dynamic-orbit'
          ? currentBasePitch + pitchAmplitude * Math.sin(heading)
          : currentBasePitch;

        const range = cameraConfig.orbitStyle === 'dynamic-orbit'
          ? currentBaseRange + RANGE_AMPLITUDE_RELATIVE * currentBaseRange * -Math.sin(heading)
          : currentBaseRange;

        adjustCoordinateHeight(activeCenter).then(centerPosition => {
          viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(centerPosition, 0),
            {
              offset: new Cesium.HeadingPitchRange(heading, pitch, range),
              duration: 0,
            }
          );
        });
      }

      // 2. Ticks for dynamic entities
      updateDynamicEntities(viewer, storeState.opsMode, storeState.centerCoords);

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    // Screen interaction bindings to cancel orbit
    const stopOrbitHandler = () => {
      useStore.getState().updateCameraState({ autoOrbitEnabled: false });
    };

    viewer.canvas.addEventListener("pointerdown", stopOrbitHandler);
    viewer.canvas.addEventListener("wheel", stopOrbitHandler);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      cesiumViewer = null;
      if (markerClickHandler) markerClickHandler.destroy();
      if (markerHoverHandler) markerHoverHandler.destroy();
    };
  }, []);

  // Sync static entities on mode/center transitions
  useEffect(() => {
    if (!cesiumViewer) return;
    drawStaticEntities(cesiumViewer, opsMode, centerCoords);
  }, [opsMode, centerCoords]);

  // Sync POI markers on nearbyPois transitions
  useEffect(() => {
    if (!cesiumViewer || !nearbyPois) return;

    const drawMarkers = async () => {
      // Clear old marker entities
      createdEntityIds.forEach((id) => {
        const entity = cesiumViewer.entities.getById(id);
        if (entity) cesiumViewer.entities.remove(entity);
      });
      createdEntityIds = [];

      const centerMarkerData = {
        name: "",
        geometry: {
          location: new google.maps.LatLng(centerCoords),
        },
        place_id: null,
        icon_background_color: "#ea4335",
        icon_mask_base_uri: "/assets/icons/poi/center",
        isCenterLocation: true,
      };

      const pointsArray = [...nearbyPois, centerMarkerData];
      const positions = pointsArray.map((poi) => {
        const jsonLoc = poi.geometry.location.toJSON ? poi.geometry.location.toJSON() : poi.geometry.location;
        const lng = typeof jsonLoc.lng === 'function' ? jsonLoc.lng() : jsonLoc.lng;
        const lat = typeof jsonLoc.lat === 'function' ? jsonLoc.lat() : jsonLoc.lat;
        return Cesium.Cartesian3.fromDegrees(lng, lat);
      });

      try {
        const adjustedPositions = await cesiumViewer.scene.clampToHeightMostDetailed(positions);
        
        for (let i = 0; i < adjustedPositions.length; i++) {
          const coord = adjustedPositions[i];
          const poi = pointsArray[i];
          const coordWithHeightOffset = addHeightOffset(coord, 28);
          const id = i < nearbyPois.length ? poi.place_id : CENTER_MARKER_ID;
          const markerSvg = await createMarkerSvg(poi);

          const entity = cesiumViewer.entities.add({
            ...getPolylineConfiguration({ start: coord, end: coordWithHeightOffset }),
            ...getMarkerEntityConfiguration({
              position: coordWithHeightOffset,
              id,
              name: poi.name,
              markerSvg,
            }),
          });

          createdEntityIds.push(id);

          if (selectedPlaceId === id) {
            setSelectedMarker(entity);
          }
        }
      } catch (err) {
        console.error("Error drawing billboards:", err);
      }

      // Re-bind click event
      if (markerClickHandler) markerClickHandler.destroy();
      markerClickHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);

      cesiumViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      markerClickHandler.setInputAction(async (click) => {
        const picked = cesiumViewer.scene.pick(click.position);
        if (picked && picked.primitive && picked.primitive instanceof Cesium.Billboard) {
          const markerEntity = picked.primitive.id;
          const placeId = markerEntity.id;

          if (placeId === CENTER_MARKER_ID) return;

          const activePoi = nearbyPois.find(p => p.place_id === placeId);
          if (!activePoi) return;

          if (useStore.getState().selectedPlaceId === placeId) {
            setSelectedMarker(null);
            setSelectedPlace(null);
          } else {
            setSelectedMarker(markerEntity);
            try {
              const details = await getPlaceDetails(placeId);
              setSelectedPlace({ ...activePoi, ...details });
            } catch (err) {
              setSelectedPlace(activePoi);
            }
          }

          // Camera focus zoom
          const focusCoords = activePoi.geometry.location.toJSON ? activePoi.geometry.location.toJSON() : activePoi.geometry.location;
          performFlyTo(focusCoords, { range: 580, duration: 1.0 });
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Re-bind hover event
      if (markerHoverHandler) markerHoverHandler.destroy();
      markerHoverHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.canvas);
      
      const handleHover = (movement) => {
        const picked = cesiumViewer.scene.pick(movement.endPosition);
        if (picked && picked.primitive && picked.primitive instanceof Cesium.Billboard && picked.primitive.id.id !== CENTER_MARKER_ID) {
          document.body.style.cursor = 'pointer';
          if (hoveredMarker && picked.primitive.id.id !== hoveredMarker.id.id) {
            hoveredMarker.id.label.scaleByDistance = defaultLabelVisibility;
          }
          hoveredMarker = picked.primitive;
          hoveredMarker.id.label.scaleByDistance = undefined;
        } else {
          document.body.style.cursor = 'default';
          if (hoveredMarker) {
            hoveredMarker.id.label.scaleByDistance = defaultLabelVisibility;
            hoveredMarker = null;
          }
        }
      };

      const throttle = (callback, wait) => {
        let last = 0;
        return (...args) => {
          const now = Date.now();
          if (now - last < wait) return;
          last = now;
          return callback(...args);
        };
      };

      markerHoverHandler.setInputAction(
        throttle(handleHover, 80),
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );
    };

    drawMarkers();
  }, [nearbyPois, centerCoords, selectedPlaceId]);

  return <div ref={containerRef} id="cesium-container" className="w-full h-full" />;
};

// HELPER: Clear only dynamic entities
function clearDynamicEntities(viewer) {
  const dynamicPrefixes = ["fleet-vehicle-", "oriient-blue-dot", "oriient-radar"];
  const toRemove = [];
  viewer.entities.values.forEach(e => {
    if (dynamicPrefixes.some(prefix => e.id && e.id.startsWith(prefix))) {
      toRemove.push(e);
    }
  });
  toRemove.forEach(e => viewer.entities.remove(e));
}

// HELPER: Dynamic simulation entities ticks
function updateDynamicEntities(viewer, mode, center) {
  clearDynamicEntities(viewer);

  if (mode === 'fleet-operations') {
    const vehicles = fleetSimulator.getVehicles();
    vehicles.forEach(v => {
      viewer.entities.add({
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
  } else if (mode === 'indoor-venues') {
    const lat = center.lat;
    const lng = center.lng;
    const now = Date.now() / 4000;
    const dotLat = lat - 0.00034 + (0.0005 * (Math.sin(now) + 1));
    const dotLng = lng - 0.00016 + (0.0005 * (Math.cos(now * 0.5) + 1));

    viewer.entities.add({
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

    const radarScale = 16 + 10 * Math.sin(Date.now() / 400);
    viewer.entities.add({
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

// HELPER: Clear static entities
function clearStaticEntities(viewer) {
  const staticPrefixes = ["fleet-route-", "indoor-shell", "indoor-aisle-", "bq-column-", "agentic-route-"];
  const toRemove = [];
  viewer.entities.values.forEach(e => {
    if (staticPrefixes.some(prefix => e.id && e.id.startsWith(prefix))) {
      toRemove.push(e);
    }
  });
  toRemove.forEach(e => viewer.entities.remove(e));
}

// HELPER: Redraw static map shapes
function drawStaticEntities(viewer, mode, center) {
  clearStaticEntities(viewer);

  if (mode === 'fleet-operations') {
    const vehicles = fleetSimulator.getVehicles();
    vehicles.forEach(v => {
      const positions = [];
      v.route.forEach(p => positions.push(p.lng, p.lat));
      const colorHex = v.status === "DELAYED" ? "#ff2a5f" : "#6366f1";

      viewer.entities.add({
        id: `fleet-route-${v.id}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(positions),
          width: 3.5,
          material: Cesium.Color.fromCssColorString(colorHex).withAlpha(0.7),
          clampToGround: true
        }
      });
    });
  } else if (mode === 'indoor-venues') {
    const floorOutline = [
      center.lng - 0.00036, center.lat - 0.00044,
      center.lng + 0.00064, center.lat - 0.00044,
      center.lng + 0.00064, center.lat + 0.00036,
      center.lng - 0.00036, center.lat + 0.00036,
      center.lng - 0.00036, center.lat - 0.00044
    ];

    viewer.entities.add({
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
      [center.lng - 0.00016, center.lat - 0.00034, center.lng - 0.00016, center.lat + 0.00026],
      [center.lng + 0.00004, center.lat - 0.00034, center.lng + 0.00004, center.lat + 0.00026],
      [center.lng + 0.00024, center.lat - 0.00034, center.lng + 0.00024, center.lat + 0.00026],
      [center.lng + 0.00044, center.lat - 0.00034, center.lng + 0.00044, center.lat + 0.00026]
    ];

    aisles.forEach((aisle, i) => {
      viewer.entities.add({
        id: `indoor-aisle-${i}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(aisle),
          width: 2.5,
          material: Cesium.Color.WHITE.withAlpha(0.4),
          clampToGround: true
        }
      });
    });

    // Fly camera directly into venue
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat - 0.001, 200),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0
      },
      duration: 2.5
    });
  } else if (mode === 'bq-analytics') {
    // Generate static cylinder heatmap coordinates
    const seedLat = center.lat;
    const seedLng = center.lng;

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

    const bqCoords = window.bqClustersCache.map(c => {
      const latOffset = c.lat - seedLat;
      const lngOffset = c.lng - seedLng;
      return Cesium.Cartesian3.fromDegrees(seedLng + lngOffset, seedLat + latOffset);
    });

    viewer.scene.clampToHeightMostDetailed(bqCoords).then(clamped => {
      if (useStore.getState().opsMode !== 'bq-analytics') return;
      clamped.forEach((clampedCoord, i) => {
        const cluster = window.bqClustersCache[i];
        let colorStr = "#f3e8ff";
        if (cluster.count > 400) colorStr = "#6b21a8";
        else if (cluster.count > 300) colorStr = "#9333ea";
        else if (cluster.count > 200) colorStr = "#a855f7";
        else if (cluster.count > 100) colorStr = "#c084fc";

        const color = Cesium.Color.fromCssColorString(colorStr);
        const length = cluster.count * 1.5;
        const cartographic = Cesium.Cartographic.fromCartesian(clampedCoord);
        const centerPosition = Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          cartographic.height + (length / 2)
        );

        viewer.entities.add({
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
    }).catch(err => console.error("BigQuery heights clamp fail:", err));

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat - 0.004, 1200),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0
      },
      duration: 2.0
    });
  }
}
