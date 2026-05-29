// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { loadConfig } from "./utils/config.js";
import { performFlyTo, initializeCesiumViewer, cesiumViewer } from "./utils/cesium.js";

import { getNearbyPois, initAutocomplete } from "./utils/places.js";
import createMarkers from "./utils/create-markers.js";

// Import our deck.gl geospatial operations layer managers
import { initializeDeckOverlay, setOpsMode, updateDeckCenter } from "./utils/deck-layers.js";

// Import our Conversational AI Geospatial Assistant
import { initializeAgenticChat } from "./utils/agentic-chat.js";

// Here we load the configuration.
// The current implementation loads our local `config.json`.
//
// This can be changed easily, to fetch from any other API, CMS
// or request some file from another host, by changing the config url parameter.
//
// You could also implement your (dynamic) configuration loading function here.
export const config = await loadConfig("config.json");

const {
  location: { coordinates },
  poi: poiConfig,
  camera: cameraConfig,
} = config;

// Setup floating menu tab click handlers for mode switching
function setupOperationsMenu() {
  const tabs = [
    { id: "tab-explorer", mode: "area-explorer" },
    { id: "tab-fleet", mode: "fleet-operations" },
    { id: "tab-indoor", mode: "indoor-venues" },
    { id: "tab-bq", mode: "bq-analytics" }
  ];

  tabs.forEach(tab => {
    const btn = document.getElementById(tab.id);
    if (!btn) return;

    btn.addEventListener("click", () => {
      // Clear active class from all tabs
      tabs.forEach(t => {
        const otherBtn = document.getElementById(t.id);
        if (otherBtn) otherBtn.classList.remove("active");
      });

      // Activate clicked tab
      btn.classList.add("active");

      // Switch operations mode
      setOpsMode(tab.mode, cesiumViewer);
    });
  });
}

export async function main() {
  try {
    await initializeCesiumViewer(coordinates, cameraConfig);

    // Initialize our premium deck.gl overlay on top of CesiumJS viewer
    initializeDeckOverlay(cesiumViewer);
    
    // Wire up dynamic menu mode tabs
    setupOperationsMenu();

    // Initialize our Conversational AI Geospatial Assistant
    initializeAgenticChat();

    // Wire up dynamic Google Places Search Autocomplete
    const searchInput = document.getElementById("place-search-input");
    if (searchInput) {
      initAutocomplete(searchInput, async (place) => {
        const loc = place.geometry.location;
        const targetCoords = { lat: loc.lat(), lng: loc.lng() };

        // Reset dynamic camera sliders to default values for the new city center
        const radiusSlider = document.getElementById("orbit-radius-slider");
        const pitchSlider = document.getElementById("orbit-pitch-slider");
        if (radiusSlider) radiusSlider.value = 800;
        if (pitchSlider) pitchSlider.value = -30;

        // 1. Smoothly fly Cesium camera to the newly searched place
        await performFlyTo(targetCoords);

        // 2. Propagate coordinates shift to our deck.gl layers & fleet simulator
        updateDeckCenter(loc);

        // 3. Re-enrich and draw Places POI 3D markers centered on new search coords
        const pois = await getNearbyPois(poiConfig, loc);
        await createMarkers(pois, loc);
      });
    }

    if (coordinates.lat && coordinates.lng) {
      console.log("Inside main.js - Initializing 3D Spatial Operations Control.");
      // move the camera to face the main location's coordinates
      await performFlyTo(coordinates);
      // based on the given main location, fetch the surrounding POIs of the selected categories
      const pois = await getNearbyPois(poiConfig, coordinates);
      // create markers according to the POIs placed on the map
      await createMarkers(pois, coordinates);
    }
  } catch (error) {
    console.error(error);
  }
}

main();
