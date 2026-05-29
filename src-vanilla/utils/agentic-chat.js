// Copyright 2026 Google LLC
// Geospatial Conversational AI Assistant Chat module

import { cesiumViewer, performFlyTo } from "./cesium.js";
import createMarkers, { setSelectedMarker } from "./create-markers.js";
import { updateSidebarElements } from "../sidebar/sidebar.js";

let chatHistory = [];
let activeSearchPlaces = [];
let activeRouteEntity = null;

// Polyline Decoder for Directions Overview Path
function decodePolyline(encoded) {
  let len = encoded.length;
  let index = 0;
  let array = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    array.push(Cesium.Cartesian3.fromDegrees(lng * 1e-5, lat * 1e-5));
  }
  return array;
}

// Format streamed AI text with interactive registry index links
function formatText(text, places) {
  // Translate markdown line breaks & boldings
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  // Replace indices [0], [1], [2] with interactive anchors
  formatted = formatted.replace(/\[(\d+)\]/g, (match, idx) => {
    const index = parseInt(idx, 10);
    if (places && places[index]) {
      return `<a class="registry-anchor" data-index="${index}">[${index}]</a>`;
    }
    return match;
  });

  return formatted;
}

export function initializeAgenticChat() {
  const panel = document.getElementById("ops-chat-panel");
  const header = panel.querySelector(".chat-header");
  const historyContainer = document.getElementById("chat-history");
  const statusBar = document.getElementById("chat-status-bar");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");

  if (!panel || !header) return;

  // Toggle chat panel open/closed states
  header.addEventListener("click", () => {
    panel.classList.toggle("closed");
  });

  const appendMessage = (sender, text) => {
    const bubble = document.createElement("div");
    bubble.className = `message ${sender}`;
    bubble.innerHTML = text;
    historyContainer.appendChild(bubble);
    historyContainer.scrollTop = historyContainer.scrollHeight;
    return bubble;
  };

  const handleSend = async () => {
    const query = chatInput.value.trim();
    if (!query) return;

    chatInput.value = "";
    appendMessage("user", query);

    statusBar.textContent = "Connecting to agent...";
    const assistantBubble = appendMessage("assistant", "...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Read streaming Server-Sent Events (SSE)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let aiText = "";
      let currentEvent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Save the last partial line back to buffer
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.substring(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.substring(5).trim();
            try {
              const payload = JSON.parse(dataStr);
              
              if (currentEvent === "status") {
                statusBar.textContent = payload;
              } else if (currentEvent === "text") {
                aiText += payload;
                assistantBubble.innerHTML = formatText(aiText, activeSearchPlaces);
              } else if (currentEvent === "action") {
                handleMapAction(payload);
              } else if (currentEvent === "done") {
                chatHistory = payload.history;
                statusBar.textContent = "Ready";
              } else if (currentEvent === "error") {
                statusBar.textContent = "Error: " + payload;
                assistantBubble.innerHTML = "Sorry, I encountered a backend processing error: " + payload;
              }
            } catch (err) {
              console.error("Error parsing SSE payload:", err, dataStr);
            }
          }
        }
      }
    } catch (err) {
      statusBar.textContent = "Error";
      assistantBubble.textContent = "Failed to communicate with conversational service: " + err.message;
    }
  };

  const handleMapAction = async (action) => {
    console.log("🤖 Chat Assistant Triggered Map Action:", action);

    if (action.type === "addMarkers" && action.places && action.places.length > 0) {
      activeSearchPlaces = action.places;
      
      const firstPlace = action.places[0];
      const loc = firstPlace.geometry.location;
      const center = { lat: loc.latitude, lng: loc.longitude };

      // Map place list format back to legacy expected by createMarkers
      const mappedPois = action.places.map(p => {
        let iconBaseUri = "assets/icons/poi/store";
        if (p.types && p.types[0]) {
          iconBaseUri = `assets/icons/poi/${p.types[0]}`;
        }
        return {
          place_id: p.id,
          name: p.displayName?.text || p.displayName || "",
          geometry: {
            location: new google.maps.LatLng({ lat: p.location.latitude, lng: p.location.longitude })
          },
          icon_background_color: p.iconBackgroundColor || "#4f46e5",
          icon_mask_base_uri: iconBaseUri,
          types: p.types || []
        };
      });

      // Fly to the new search results center
      statusBar.textContent = `Flying to ${firstPlace.displayName?.text || "location"}...`;
      await performFlyTo(center);

      // Render ground-clamped 3D markers
      await createMarkers(mappedPois, new google.maps.LatLng(center));
      statusBar.textContent = "Map markers updated.";
    } 
    else if (action.type === "drawRoute" && action.route) {
      const { polyline, startLocation } = action.route;
      
      if (!polyline) return;
      const decodedPoints = decodePolyline(polyline);

      // Clean up previous route
      if (activeRouteEntity) {
        cesiumViewer.entities.remove(activeRouteEntity);
      }

      // Add ground-clamped cyan operations route
      activeRouteEntity = cesiumViewer.entities.add({
        polyline: {
          positions: decodedPoints,
          width: 6,
          material: new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.fromCssColorString('#00e5ff'),
            outlineColor: Cesium.Color.fromCssColorString('#0b0f19'),
            outlineWidth: 2
          }),
          clampToGround: true
        }
      });

      // Fly to the route origin
      const center = { lat: startLocation.lat, lng: startLocation.lng };
      await performFlyTo(center);
      statusBar.textContent = "Snapped route calculated and displayed.";
    }
  };

  // Wire send event triggers
  sendBtn.addEventListener("click", handleSend);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  // Handle clickable registry index link selection
  historyContainer.addEventListener("click", async (e) => {
    const anchor = e.target.closest(".registry-anchor");
    if (!anchor) return;

    e.preventDefault();
    const index = parseInt(anchor.getAttribute("data-index"), 10);
    const place = activeSearchPlaces[index];

    if (place) {
      const loc = place.location;
      const center = { lat: loc.latitude, lng: loc.longitude };
      
      statusBar.textContent = `Flying to [${index}] ${place.displayName?.text || "place"}...`;
      await performFlyTo(center);

      // Open UI Kit compact details panel in sidebar
      await updateSidebarElements(place.id);
    }
  });
}
