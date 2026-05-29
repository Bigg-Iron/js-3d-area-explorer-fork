// Copyright 2026 Google LLC
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { setSelectedMarker } from './MapViewer';
import { StreetViewPanel } from './StreetViewPanel';

export const PlacesSidebar = () => {
  const requestRef = useRef(null);
  const selectedPlace = useStore((state) => state.selectedPlace);
  const selectedPlaceId = useStore((state) => state.selectedPlaceId);
  const setSelectedPlace = useStore((state) => state.setSelectedPlace);

  // Sync the place property on the Places UI Kit web component
  useEffect(() => {
    if (requestRef.current && selectedPlaceId) {
      requestRef.current.place = selectedPlaceId;
    }
  }, [selectedPlaceId]);

  const handleClose = () => {
    setSelectedMarker(null);
    setSelectedPlace(null);
  };

  const isOpen = !!selectedPlaceId;
  const photoUrl = selectedPlace?.photos?.[0]?.getUrl?.();

  return (
    <aside
      id="sidebar"
      className={`fixed top-24 right-4 z-20 w-96 h-[calc(100vh-8rem)] glass-panel rounded-2xl border border-white/10 flex flex-col shadow-2xl transition-all duration-500 ease-in-out pointer-events-auto ${
        isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[110%] opacity-0 pointer-events-none'
      }`}
    >
      <div className="sidebar-content-wrapper h-full flex flex-col overflow-hidden">
        {/* Cover Photo & Close Button */}
        <div className="place-image-container relative flex-shrink-0 w-full h-48 bg-slate-950/40 rounded-t-2xl overflow-hidden border-b border-white/5">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={selectedPlace?.name || 'Place Cover'}
              className="w-full h-full object-cover select-none transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-between px-6 bg-gradient-to-br from-slate-900/60 to-indigo-950/40">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">NO PLACE PHOTOS</span>
            </div>
          )}
          
          <button
            onClick={handleClose}
            className="sidebar-close-button absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-950/65 hover:bg-slate-900 border border-white/15 hover:border-indigo-500/50 flex items-center justify-center transition-all duration-200"
            aria-label="Close Sidebar"
          >
            <img src="/assets/icons/sidebar/close-icon.svg" alt="Close" className="w-3.5 h-3.5 opacity-85 hover:opacity-100" />
          </button>

          {/* Place Category Indicator overlay */}
          {selectedPlace?.name && (
            <div className="absolute bottom-3 left-4 right-4 bg-slate-950/70 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
              <h2 className="text-sm font-bold text-white truncate">{selectedPlace.name}</h2>
            </div>
          )}
        </div>

        {/* Places UI Kit Compact Details */}
        <gmp-place-details-compact
          orientation="vertical"
          id="places-ui-kit-details"
          className="w-full flex-grow overflow-y-auto custom-scrollbar p-4 text-slate-300"
          style={{ colorScheme: 'dark' }}
        >
          <gmp-place-details-place-request ref={requestRef}></gmp-place-details-place-request>
          <gmp-place-all-content></gmp-place-all-content>
        </gmp-place-details-compact>

        {/* Dynamic Street View Telemetry Panel */}
        <StreetViewPanel placeId={selectedPlaceId} />
      </div>
    </aside>
  );
};
