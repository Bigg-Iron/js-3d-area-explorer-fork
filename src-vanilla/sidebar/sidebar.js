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

import { updatePlaceHeader } from "./update-place-header.js";
import { updatePlaceOverview } from "./update-place-overview.js";
import { updatePlaceReviews } from "./update-place-reviews.js";

import { getPlaceDetails } from "../utils/places.js";
import { setSelectedMarker } from "../utils/create-markers.js";

const baseSidebar = document.getElementById("sidebar").cloneNode(true); // empty sidebar state for resetting purposes
let closeButtonListener = null; // A reference to the event listener

/**
 * This functions resets the sidebar to the original state defined in the index.html
 *
 * Doing it this way is much simpler than manually removing current elements before adding
 * them again with different data.
 *
 * It replaces the current sidebar html with the original state.
 * Then the `addSidebarElements` function may be called to fill the sidebar with data again.
 */
async function resetSidebar() {
  const currentSidebar = document.getElementById("sidebar");

  // Check if both sidebars exist
  if (!baseSidebar || !currentSidebar) {
    console.error("Sidebar elements not found.");
    return;
  }

  // Clear current sidebar
  while (currentSidebar.firstChild) {
    currentSidebar.removeChild(currentSidebar.firstChild);
  }

  // Clone and append children from the base sidebar
  for (let child of baseSidebar.children) {
    currentSidebar.appendChild(child.cloneNode(true));
  }
}

/**
 * Simply adds a classname to the main element opening the sidebar
 *
 * @param {'open' | 'close'} action - to open or close the sidebar
 */
export function toggleSidebar(action) {
  const mainElement = document.querySelector("main");
  if (action === "open") {
    mainElement.classList.add("sidebar-is-open");
  } else if (action === "close") {
    mainElement.classList.remove("sidebar-is-open");

    const closeButton = mainElement.querySelector(".sidebar-close-button");
    if (!(closeButtonListener && closeButton)) return;

    closeButton.removeEventListener("click", closeButtonListener);
    closeButtonListener = null;
  }
}

/**
 * Adds a click event listener to the close button of the sidebar.
 *
 * @param {Cesium.Billboard} entity - The entity of a given location.
 */
function addCloseButtonListener(entity) {
  const closeButton = document.querySelector(".sidebar-close-button");

  closeButtonListener = () => {
    setSelectedMarker(entity);
    toggleSidebar("close");
  };

  closeButton.addEventListener("click", closeButtonListener);
}

/**
 * Adds sidebar elements for a given place.
 *
 * @param {string} placeId - The place-id of a given location.
 * @param {Cesium.Billboard} entity - The entity of a given location.
 */
export async function updateSidebarElements(placeId) {
  // reset sidebar to base state before adding data
  await resetSidebar();

  // add an event listener to handle the close button click
  addCloseButtonListener();

  // Configure the Places UI Kit details component with the selected place ID
  const detailsRequest = document.getElementById("sidebar").querySelector("gmp-place-details-place-request");
  if (detailsRequest) {
    detailsRequest.place = placeId;
  }
  
  toggleSidebar("open");

  // Load Google Street View if coordinates are available
  try {
    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ["location"] });
    
    if (place.location) {
      const lat = typeof place.location.lat === "function" ? place.location.lat() : 
                  (typeof place.location.lat === "number" ? place.location.lat : place.location.latitude);
      const lng = typeof place.location.lng === "function" ? place.location.lng() : 
                  (typeof place.location.lng === "number" ? place.location.lng : place.location.longitude);
      const latLng = new google.maps.LatLng(lat, lng);

      const streetViewService = new google.maps.StreetViewService();
      streetViewService.getPanorama({ location: latLng, radius: 50 }, (data, status) => {
        const wrapper = document.getElementById("street-view-wrapper");
        const container = document.getElementById("street-view-container");
        if (wrapper && container) {
          if (status === google.maps.StreetViewStatus.OK) {
            wrapper.style.display = "block";
            const panorama = new google.maps.StreetViewPanorama(container, {
              pano: data.location.pano,
              visible: true,
              addressControl: false,
              linksControl: true,
              panControl: false,
              enableCloseButton: false,
              zoomControl: false,
              fullscreenControl: false,
              motionTracking: false,
              motionTrackingControl: false
            });
            panorama.setPov({ heading: 270, pitch: 0 });

            // Store active panorama on global scope for resizing
            window.activePanorama = panorama;

            // Unified Enlarge/Minimize state toggle function
            const expandBtn = document.getElementById("street-view-expand-btn");
            if (!expandBtn) return;

            const newExpandBtn = expandBtn.cloneNode(true);
            expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);

            const toggleEnlarge = (forceState) => {
              const shouldEnlarge = forceState !== undefined ? forceState : !wrapper.classList.contains("enlarged");
              
              if (shouldEnlarge) {
                wrapper.classList.add("enlarged");
                newExpandBtn.innerHTML = "✕";
                newExpandBtn.title = "Minimize Street View";
                newExpandBtn.style.color = "var(--neon-red)";
                newExpandBtn.style.borderColor = "rgba(255, 42, 95, 0.4)";
                newExpandBtn.style.boxShadow = "0 0 12px rgba(255, 42, 95, 0.4)";
              } else {
                wrapper.classList.remove("enlarged");
                newExpandBtn.innerHTML = "⛶";
                newExpandBtn.title = "Expand Street View";
                newExpandBtn.style.color = "#00e5ff";
                newExpandBtn.style.borderColor = "rgba(0, 229, 255, 0.3)";
                newExpandBtn.style.boxShadow = "0 0 8px rgba(0, 229, 255, 0.25)";
              }

              // Force Google Maps API layout recalculation after transition
              setTimeout(() => {
                google.maps.event.trigger(panorama, 'resize');
              }, 250);
            };

            // Wire up Expand button
            newExpandBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              toggleEnlarge();
            });

            // Wire up compact Overlay click to expand
            const overlay = document.getElementById("street-view-overlay");
            if (overlay) {
              overlay.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleEnlarge(true);
              });
            }

            // Wire up Backdrop click to close / minimize
            const backdrop = document.getElementById("street-view-backdrop");
            if (backdrop) {
              backdrop.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleEnlarge(false);
              });
            }
          } else {
            wrapper.style.display = "none";
          }
        }
      });
    }
  } catch (err) {
    console.error("Error setting up Street View:", err);
  }
}
