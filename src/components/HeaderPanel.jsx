// Copyright 2026 Google LLC
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { initAutocomplete, getNearbyPois } from '../utils/places';
import { performFlyTo } from './MapViewer';

const POI_CONFIG = {
  density: 30,
  searchRadius: 1000,
  types: ["restaurant", "bar", "supermarket", "cafe"]
};

export const HeaderPanel = () => {
  const inputRef = useRef(null);
  const [searchWiggle, setSearchWiggle] = useState(false);

  const opsMode = useStore((state) => state.opsMode);
  const setOpsMode = useStore((state) => state.setOpsMode);
  const centerCoords = useStore((state) => state.centerCoords);
  const setCenterCoords = useStore((state) => state.setCenterCoords);
  const setNearbyPois = useStore((state) => state.setNearbyPois);
  const resetCameraSliders = useStore((state) => state.resetCameraSliders);

  // Load initial POIs on Mount around default center coordinates (Chelsea Market)
  useEffect(() => {
    const loadInitialPois = async () => {
      try {
        console.log("🚀 Initializing map with default POIs (including Cafes) around Chelsea Market...");
        const pois = await getNearbyPois(POI_CONFIG, centerCoords);
        setNearbyPois(pois);
      } catch (err) {
        console.error("Error loading initial POIs on mount:", err);
      }
    };
    loadInitialPois();
  }, [setNearbyPois, centerCoords]);

  // Initialize Autocomplete once on Mount
  useEffect(() => {
    if (!inputRef.current) return;

    const handlePlaceSelected = async (place) => {
      if (!place || !place.geometry || !place.geometry.location) return;

      const loc = place.geometry.location;
      const targetCoords = {
        lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
        lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng
      };

      // 1. Reset camera sliders to default radius and tilt
      resetCameraSliders();

      // 2. Perform smooth camera flyTo focus transition
      await performFlyTo(targetCoords);

      // 3. Update coordinates center in Zustand
      setCenterCoords(targetCoords);

      // 4. Enrich and update POI pins surrounding new center
      try {
        const pois = await getNearbyPois(POI_CONFIG, loc);
        setNearbyPois(pois);
      } catch (err) {
        console.error("Error loading nearby POIs for autocomplete place:", err);
      }

      // Add a cool search icon wiggle micro-animation
      setSearchWiggle(true);
      setTimeout(() => setSearchWiggle(false), 500);
    };

    initAutocomplete(inputRef.current, handlePlaceSelected);
  }, [setCenterCoords, setNearbyPois, resetCameraSliders]);

  // Initial load of nearby POIs for default location (Chelsea Market) on first load
  useEffect(() => {
    const initialCenter = useStore.getState().centerCoords;
    const loadInitialPois = async () => {
      try {
        const latLng = new google.maps.LatLng(initialCenter.lat, initialCenter.lng);
        const pois = await getNearbyPois(POI_CONFIG, latLng);
        setNearbyPois(pois);
      } catch {
        console.warn("Retrying maps load for initial POIs...");
        // Retrying in 1s if Google Maps is still loading asynchronously
        setTimeout(loadInitialPois, 1000);
      }
    };
    loadInitialPois();
  }, [setNearbyPois]);

  const handleTabClick = (mode) => {
    setOpsMode(mode);
  };

  return (
    <header className="absolute top-4 left-4 right-4 z-10 flex flex-col md:flex-row gap-4 items-center justify-between pointer-events-auto">
      {/* 3D Global Autocomplete Box */}
      <div className="ops-search-box glass-panel flex items-center gap-3 px-4 py-2.5 rounded-full w-full md:w-80 border border-white/10 hover:border-indigo-500/50 transition-all duration-300">
        <svg
          className={`w-5 h-5 text-indigo-400 stroke-2 ${searchWiggle ? 'search-wiggle-animation' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          id="place-search-input"
          name="q"
          placeholder="Search globally..."
          autoComplete="off"
          className="bg-transparent text-white placeholder-slate-400 border-none outline-none text-sm w-full font-medium"
        />
      </div>

      {/* Modern High-Fidelity Vector animated Tabs */}
      <div className="ops-mode-selector glass-panel flex items-center p-1 rounded-full border border-white/10 shadow-lg select-none">
        <button
          onClick={() => handleTabClick('area-explorer')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 border border-transparent ${
            opsMode === 'area-explorer'
              ? 'bg-indigo-600/35 border-indigo-500/50 text-[#00e5ff] shadow-inner shadow-indigo-500/10'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${opsMode === 'area-explorer' ? 'text-[#00e5ff]' : 'text-slate-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path
              className={`needle origin-center ${opsMode === 'area-explorer' ? 'needle-oscillate needle-spin' : ''}`}
              d="M12 5L14 12L12 19L10 12L12 5Z"
              fill="currentColor"
            />
            <circle cx="12" cy="12" r="1.5" fill="#020617" />
          </svg>
          Explorer
        </button>

        <button
          onClick={() => handleTabClick('fleet-operations')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 border border-transparent ${
            opsMode === 'fleet-operations'
              ? 'bg-indigo-600/35 border-indigo-500/50 text-[#39ff14] shadow-inner'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <svg
            className={`w-4 h-4 ${opsMode === 'fleet-operations' ? 'text-[#39ff14]' : 'text-slate-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g className={`${opsMode === 'fleet-operations' ? 'truck-bouncing' : ''}`}>
              <path d="M2 5h12v10H2V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
              <path d="M14 8h5l3 3v4h-8V8z" stroke="currentColor" stroke-width="2" strokeLinejoin="round" fill="none" />
              <circle
                className={`wheel wheel-left origin-center ${opsMode === 'fleet-operations' ? 'wheel-spinning' : ''}`}
                cx="6"
                cy="17"
                r="2"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <circle
                className={`wheel wheel-right origin-center ${opsMode === 'fleet-operations' ? 'wheel-spinning' : ''}`}
                cx="16"
                cy="17"
                r="2"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </g>
          </svg>
          Fleet Engine
        </button>

        <button
          onClick={() => handleTabClick('indoor-venues')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 border border-transparent ${
            opsMode === 'indoor-venues'
              ? 'bg-indigo-600/35 border-indigo-500/50 text-[#00e5ff] shadow-inner'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <svg
            className={`w-4 h-4 ${opsMode === 'indoor-venues' ? 'text-[#00e5ff]' : 'text-slate-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" stroke="currentColor" stroke-width="2" strokeLinecap="round" />
            <path d="M8 7h2v2H8V7zm6 0h2v2h-2V7zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="var(--neon-blue)" />
            <circle
              className={`signal-ring ${opsMode === 'indoor-venues' ? 'radar-pulsing' : ''}`}
              cx="12"
              cy="12"
              r="4"
              stroke="var(--neon-blue)"
              strokeWidth="1.5"
            />
          </svg>
          Oriient Indoor
        </button>

        <button
          onClick={() => handleTabClick('bq-analytics')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 border border-transparent ${
            opsMode === 'bq-analytics'
              ? 'bg-indigo-600/35 border-indigo-500/50 text-[#d500f9] shadow-inner'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <svg
            className={`w-4 h-4 ${opsMode === 'bq-analytics' ? 'text-[#d500f9]' : 'text-slate-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 20h16" stroke="currentColor" stroke-width="2" strokeLinecap="round" />
            <rect className={`bar bar-1 fill-current ${opsMode === 'bq-analytics' ? 'bar-grow-1-anim' : ''}`} x="6" y="11" width="3" height="7" rx="1" />
            <rect className={`bar bar-2 fill-current ${opsMode === 'bq-analytics' ? 'bar-grow-2-anim' : ''}`} x="11" y="7" width="3" height="11" rx="1" />
            <rect className={`bar bar-3 fill-current ${opsMode === 'bq-analytics' ? 'bar-grow-3-anim' : ''}`} x="16" y="13" width="3" height="5" rx="1" />
          </svg>
          BigQuery
        </button>
      </div>
    </header>
  );
};
