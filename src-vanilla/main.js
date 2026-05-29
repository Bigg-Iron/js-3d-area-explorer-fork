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

    // Wire up dynamic modern Google Places Autocomplete web component
    const autocompleteElement = document.getElementById("place-search-input");
    if (autocompleteElement) {
      let lastSelectTime = 0;

      // Helper function to handle a selected or searched place
      const handlePlaceSelect = async (place) => {
        if (!place.location) {
          await place.fetchFields({ fields: ["location", "displayName", "id"] });
        }

        const lat = typeof place.location.lat === "function" ? place.location.lat() : 
                    (typeof place.location.lat === "number" ? place.location.lat : place.location.latitude);
        const lng = typeof place.location.lng === "function" ? place.location.lng() : 
                    (typeof place.location.lng === "number" ? place.location.lng : place.location.longitude);
        const targetCoords = { lat, lng };
        const latLng = new google.maps.LatLng(lat, lng);

        const radiusSlider = document.getElementById("orbit-radius-slider");
        const pitchSlider = document.getElementById("orbit-pitch-slider");
        if (radiusSlider) radiusSlider.value = 800;
        if (pitchSlider) pitchSlider.value = -30;

        await performFlyTo(targetCoords);
        updateDeckCenter(latLng);

        const pois = await getNearbyPois(poiConfig, latLng);
        await createMarkers(pois, latLng);
      };

      // 1. Listen for standard select suggestion events
      autocompleteElement.addEventListener("gmp-placeselect", async (event) => {
        const place = event.place;
        if (place) {
          lastSelectTime = Date.now();
          await handlePlaceSelect(place);
        }
      });

      // 2. Listen for manual Enter key queries inside the slotted input element
      const inputSlot = autocompleteElement.querySelector('input[slot="input"]');
      if (inputSlot) {
        inputSlot.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            const query = inputSlot.value.trim();
            if (!query) return;

            // Run search after a tiny timeout to see if an autocomplete prediction was clicked/entered
            setTimeout(async () => {
              if (Date.now() - lastSelectTime < 250) {
                console.log("🚫 Skipping manual Enter search: Autocomplete prediction was selected.");
                return;
              }

              try {
                console.log(`🔍 Slotted Input Search: Querying "${query}"...`);
                const { Place } = await google.maps.importLibrary("places");
                const request = {
                  textQuery: query,
                  fields: ["displayName", "location", "id"]
                };
                const { places } = await Place.searchByText(request);
                if (places && places.length > 0) {
                  await handlePlaceSelect(places[0]);
                  inputSlot.blur(); // dismiss dropdown
                } else {
                  console.warn("No places found for query:", query);
                }
              } catch (err) {
                console.error("Manual text query search failed:", err);
              }
            }, 100);
          }
        });
      }
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

    // Collapsible Camera Controls Card Toggle
    const cameraPanel = document.getElementById("ops-camera-panel");
    const cameraHeader = document.getElementById("camera-panel-header");
    const cameraMinBtn = document.getElementById("camera-minimize-btn");
    if (cameraPanel && cameraHeader) {
      cameraHeader.addEventListener("click", () => {
        cameraPanel.classList.toggle("minimized");
        if (cameraPanel.classList.contains("minimized")) {
          cameraMinBtn.textContent = "+";
        } else {
          cameraMinBtn.textContent = "−";
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
}

main();
