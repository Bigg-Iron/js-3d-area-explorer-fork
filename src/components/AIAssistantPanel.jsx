// Copyright 2026 Google LLC
import React, { useState, useRef, useEffect } from 'react';
import * as Cesium from 'cesium';
import { useStore } from '../store/useStore';
import { performFlyTo, cesiumViewer } from './MapViewer';

// Module-level variable to store active route entity reference
let activeRouteEntity = null;

// Polyline Decoder for Google Directions Overview Path
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
      return `<a class="registry-anchor text-[#00e5ff] font-bold underline cursor-pointer hover:text-white transition-colors" data-index="${index}">[${index}]</a>`;
    }
    return match;
  });

  return formatted;
}

export const AIAssistantPanel = () => {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);
  
  const chatState = useStore((state) => state.chatState);
  const updateChatState = useStore((state) => state.updateChatState);
  const addChatMessage = useStore((state) => state.addChatMessage);
  const setCenterCoords = useStore((state) => state.setCenterCoords);
  const setNearbyPois = useStore((state) => state.setNearbyPois);

  const toggleOpen = () => {
    updateChatState({ isOpen: !chatState.isOpen });
  };

  // Scroll to bottom on message additions
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  const handleSend = async () => {
    const query = inputText.trim();
    if (!query) return;

    setInputText('');
    
    // Add user message to history list
    addChatMessage({ role: 'user', content: query });
    updateChatState({ status: 'Connecting to agent...' });

    // Append a placeholder assistant message that we will stream into
    const assistantMsgIndex = chatState.messages.length + 1;
    addChatMessage({ role: 'assistant', content: '...' });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: chatState.chatHistory
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiText = '';
      let currentEvent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Hold last partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.substring(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            try {
              const payload = JSON.parse(dataStr);

              if (currentEvent === 'status') {
                updateChatState({ status: payload });
              } else if (currentEvent === 'text') {
                aiText += payload;
                // Update specific message in list
                useStore.setState((state) => {
                  const updatedMessages = [...state.chatState.messages];
                  if (updatedMessages[assistantMsgIndex]) {
                    updatedMessages[assistantMsgIndex] = { role: 'assistant', content: aiText };
                  }
                  return {
                    chatState: {
                      ...state.chatState,
                      messages: updatedMessages
                    }
                  };
                });
              } else if (currentEvent === 'action') {
                await handleMapAction(payload);
              } else if (currentEvent === 'done') {
                updateChatState({
                  chatHistory: payload.history,
                  status: 'Ready'
                });
              } else if (currentEvent === 'error') {
                updateChatState({ status: 'Error: ' + payload });
                // Replace loading message with error
                useStore.setState((state) => {
                  const updatedMessages = [...state.chatState.messages];
                  if (updatedMessages[assistantMsgIndex]) {
                    updatedMessages[assistantMsgIndex] = {
                      role: 'assistant',
                      content: 'Sorry, I encountered a backend processing error: ' + payload
                    };
                  }
                  return { chatState: { ...state.chatState, messages: updatedMessages } };
                });
              }
            } catch (err) {
              console.error('Error parsing SSE payload:', err, dataStr);
            }
          }
        }
      }
    } catch (err) {
      updateChatState({ status: 'Error' });
      useStore.setState((state) => {
        const updatedMessages = [...state.chatState.messages];
        if (updatedMessages[assistantMsgIndex]) {
          updatedMessages[assistantMsgIndex] = {
            role: 'assistant',
            content: 'Failed to communicate with conversational service: ' + err.message
          };
        }
        return { chatState: { ...state.chatState, messages: updatedMessages } };
      });
    }
  };

  const handleMapAction = async (action) => {
    console.log('🤖 Chat Assistant Triggered Map Action:', action);

    if (action.type === 'addMarkers' && action.places && action.places.length > 0) {
      updateChatState({ activeSearchPlaces: action.places });

      const firstPlace = action.places[0];
      const loc = firstPlace.geometry.location;
      const center = { lat: loc.latitude, lng: loc.longitude };

      // Map places format back to legacy expected by MapViewer
      const mappedPois = action.places.map((p) => {
        let iconBaseUri = 'assets/icons/poi/store';
        if (p.types && p.types[0]) {
          iconBaseUri = `assets/icons/poi/${p.types[0]}`;
        }
        return {
          place_id: p.id,
          name: p.displayName?.text || p.displayName || '',
          geometry: {
            location: (window.google && window.google.maps && window.google.maps.LatLng)
              ? new google.maps.LatLng(p.location.latitude, p.location.longitude)
              : { lat: () => p.location.latitude, lng: () => p.location.longitude }
          },
          icon_background_color: p.iconBackgroundColor || '#4f46e5',
          icon_mask_base_uri: iconBaseUri,
          types: p.types || []
        };
      });

      // Fly to the new search results center
      updateChatState({ status: `Flying to ${firstPlace.displayName?.text || 'location'}...` });
      await performFlyTo(center);

      // Render ground-clamped 3D markers and sync centerCoords
      setCenterCoords(center);
      setNearbyPois(mappedPois);
      updateChatState({ status: 'Map markers updated.' });
    } else if (action.type === 'drawRoute' && action.route) {
      const { polyline, startLocation } = action.route;

      if (!polyline || !cesiumViewer) return;
      const decodedPoints = decodePolyline(polyline);

      // Clean up previous route
      if (activeRouteEntity) {
        cesiumViewer.entities.remove(activeRouteEntity);
      }

      // Add ground-clamped cyan operations route polyline
      activeRouteEntity = cesiumViewer.entities.add({
        id: 'agentic-route-polyline',
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
      updateChatState({ status: 'Snapped route calculated and displayed.' });
    }
  };

  const handleHistoryClick = async (e) => {
    const anchor = e.target.closest('.registry-anchor');
    if (!anchor) return;

    e.preventDefault();
    const index = parseInt(anchor.getAttribute('data-index'), 10);
    const place = chatState.activeSearchPlaces[index];

    if (place) {
      const loc = place.location;
      const center = { lat: loc.latitude, lng: loc.longitude };

      updateChatState({ status: `Flying to [${index}] ${place.displayName?.text || 'place'}...` });
      await performFlyTo(center);

      // Select place and open details panel in sidebar
      useStore.getState().setSelectedPlaceId(place.id);
      
      // Attempt to load place details for the sidebar compact view
      try {
        const detailsRes = await fetch(`/api/searchPlaces?query=${encodeURIComponent(place.displayName?.text || '')}`);
        if (detailsRes.ok) {
          const searchData = await detailsRes.json();
          if (searchData.places && searchData.places[0]) {
            useStore.getState().setSelectedPlace(searchData.places[0]);
          } else {
            useStore.getState().setSelectedPlace(place);
          }
        } else {
          useStore.getState().setSelectedPlace(place);
        }
      } catch (err) {
        useStore.getState().setSelectedPlace(place);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const isOpen = chatState.isOpen;

  return (
    <div
      className={`fixed bottom-6 left-4 z-10 glass-panel border border-white/10 flex flex-col shadow-xl transition-all duration-300 pointer-events-auto ${
        isOpen
          ? 'w-96 h-[50vh] rounded-2xl'
          : 'w-72 h-12 rounded-full cursor-pointer flex justify-center items-center hover:border-indigo-500/50'
      }`}
      onClick={!isOpen ? toggleOpen : undefined}
    >
      {/* Closed Mini Header view */}
      {!isOpen ? (
        <div className="flex items-center justify-between w-full px-5 h-full">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="miniOrbGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#00e5ff" stop-opacity="1" />
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0.2" />
                </radialGradient>
              </defs>
              <circle className="orb-bg orb-pulsing" cx="12" cy="12" r="8" fill="url(#miniOrbGrad)" />
            </svg>
            <span className="text-xs font-bold text-slate-200 tracking-wider">AI ASSISTANT</span>
          </div>
          
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 chat-dot chat-dot-1"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 chat-dot chat-dot-2"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 chat-dot chat-dot-3"></span>
          </div>
        </div>
      ) : (
        /* Full Expanded Panel View */
        <div className="flex flex-col h-full overflow-hidden">
          {/* Panel Header */}
          <div
            className="flex justify-between items-center px-4 py-3 bg-indigo-650/15 border-b border-white/5 cursor-pointer select-none"
            onClick={toggleOpen}
          >
            <span className="flex items-center gap-2.5 text-xs font-bold tracking-wider text-white">
              <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="orbGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#00e5ff" stop-opacity="1" />
                    <stop offset="100%" stop-color="#6366f1" stop-opacity="0.2" />
                  </radialGradient>
                </defs>
                <circle className="orb-bg orb-pulsing" cx="12" cy="12" r="8" fill="url(#orbGrad)" />
                <circle className="orb-outline orb-spinning" cx="12" cy="12" r="9" stroke="var(--neon-blue)" strokeWidth="1.5" strokeDasharray="4 2" />
              </svg>
              GEOSPATIAL AI ASSISTANT
            </span>
            <button className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 12H6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Chat History */}
          <div
            className="flex-grow overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3.5 select-text"
            onClick={handleHistoryClick}
          >
            {chatState.messages.map((msg, i) => {
              if (msg.role === 'system') {
                return (
                  <div
                    key={i}
                    className="self-start bg-slate-900/40 border border-white/5 text-slate-300 rounded-xl px-4 py-3 text-xs leading-relaxed w-full border-dashed border-indigo-500/20 select-text"
                  >
                    <span dangerouslySetInnerHTML={{ __html: formatText(msg.content, chatState.activeSearchPlaces) }} />
                  </div>
                );
              }
              const isUser = msg.role === 'user';
              return (
                <div
                  key={i}
                  className={`${
                    isUser
                      ? 'self-end bg-indigo-600/35 border border-indigo-500/30 text-white rounded-2xl rounded-tr-none'
                      : 'self-start bg-slate-900/60 border border-white/5 text-slate-200 rounded-2xl rounded-tl-none'
                  } px-4 py-2.5 text-xs leading-relaxed max-w-[85%] message-appearing shadow-md select-text`}
                >
                  <span dangerouslySetInnerHTML={{ __html: formatText(msg.content, chatState.activeSearchPlaces) }} />
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Status Bar */}
          <div className="px-4 py-1 text-[10px] text-indigo-400 font-bold bg-slate-950/20 border-t border-white/5 flex items-center gap-1.5 select-none">
            <span className="w-1 h-1 rounded-full bg-indigo-500 animate-ping"></span>
            <span>{chatState.status}</span>
          </div>

          {/* Input Area */}
          <div className="flex items-center gap-2 p-3 bg-slate-950/30 border-t border-white/5 select-none">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything spatial..."
              autoComplete="off"
              className="bg-slate-900/60 text-xs text-white placeholder-slate-400 px-3 py-2.5 rounded-xl border border-white/10 outline-none flex-grow focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={handleSend}
              className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/40 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/10 transition-all active:scale-[0.97]"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
