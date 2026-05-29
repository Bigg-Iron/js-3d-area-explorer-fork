// Copyright 2026 Google LLC
import React, { useEffect, useRef, useState } from 'react';

export const StreetViewPanel = ({ placeId }) => {
  const containerRef = useRef(null);
  const [hasStreetView, setHasStreetView] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [panorama, setPanorama] = useState(null);

  useEffect(() => {
    if (!placeId) {
      setHasStreetView(false);
      setEnlarged(false);
      return;
    }

    let activePano = null;

    const initStreetView = async () => {
      try {
        const { Place } = await google.maps.importLibrary("places");
        const place = new Place({ id: placeId });
        await place.fetchFields({ fields: ["location"] });
        
        if (!place.location) {
          setHasStreetView(false);
          return;
        }

        const lat = typeof place.location.lat === "function" ? place.location.lat() : 
                    (typeof place.location.lat === "number" ? place.location.lat : place.location.latitude);
        const lng = typeof place.location.lng === "function" ? place.location.lng() : 
                    (typeof place.location.lng === "number" ? place.location.lng : place.location.longitude);
        const latLng = new google.maps.LatLng(lat, lng);

        const { StreetViewService, StreetViewPanorama, StreetViewStatus } = await google.maps.importLibrary("streetView");
        const streetViewService = new StreetViewService();
        
        streetViewService.getPanorama({ location: latLng, radius: 50 }, (data, status) => {
          if (status === StreetViewStatus.OK && containerRef.current) {
            setHasStreetView(true);
            const newPanorama = new StreetViewPanorama(containerRef.current, {
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
            newPanorama.setPov({ heading: 270, pitch: 0 });
            setPanorama(newPanorama);
            activePano = newPanorama;
            window.activePanorama = newPanorama;
          } else {
            setHasStreetView(false);
          }
        });
      } catch (err) {
        console.error("Error setting up Street View:", err);
        setHasStreetView(false);
      }
    };

    initStreetView();

    return () => {
      if (activePano) {
        activePano.setVisible(false);
      }
      setPanorama(null);
      setEnlarged(false);
    };
  }, [placeId]);

  // Handle resizing panorama when enlarged state transitions
  useEffect(() => {
    if (panorama) {
      const timer = setTimeout(() => {
        google.maps.event.trigger(panorama, 'resize');
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [enlarged, panorama]);

  const toggleEnlarge = (forceState) => {
    setEnlarged(prev => {
      const nextState = forceState !== undefined ? forceState : !prev;
      return nextState;
    });
  };

  if (!hasStreetView) return null;

  return (
    <>
      {/* Backdrop for enlarged modal */}
      {enlarged && (
        <div
          onClick={() => toggleEnlarge(false)}
          className="fixed inset-0 z-[10004] bg-slate-950/78 backdrop-blur-xl transition-all duration-500 cursor-zoom-out"
        />
      )}

      {/* Street View Panel Wrapper */}
      <div
        className={`relative w-[calc(100%-2rem)] mx-4 my-3 flex-shrink-0 transition-all duration-500 ease-in-out pointer-events-auto ${
          enlarged
            ? 'fixed top-[10vh] left-[10vw] w-[80vw] h-[80vh] z-[10005] m-0 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,229,255,0.45)] scale-100 opacity-100 animate-[modal-zoom-fade_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards]'
            : 'h-48 border border-white/10 rounded-xl overflow-hidden bg-black/40 shadow-[0_0_10px_rgba(0,229,255,0.15)] group'
        }`}
      >
        {/* Street View Container */}
        <div
          ref={containerRef}
          className="w-full h-full rounded-inherit overflow-hidden"
        />

        {/* Glassmorphic Overlay for Compact Mode Click to Explore */}
        {!enlarged && (
          <div
            onClick={() => toggleEnlarge(true)}
            className="absolute inset-0 z-10 cursor-pointer bg-slate-950/0 group-hover:bg-slate-950/45 group-hover:backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-350 ease-out rounded-xl"
          >
            <span className="flex items-center gap-2 text-cyan-400 font-sans text-xs font-semibold px-4 py-2 bg-slate-950/90 border border-cyan-500/40 rounded-full shadow-[0_0_15px_rgba(0,229,255,0.3)] transform scale-90 group-hover:scale-100 group-hover:border-cyan-400 group-hover:shadow-[0_0_25px_rgba(0,229,255,0.5)] transition-all duration-350">
              <span>⛶</span> Click to Explore
            </span>
          </div>
        )}

        {/* Expand / Minimize floating button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleEnlarge();
          }}
          className={`absolute top-2 right-2 z-10 w-8 h-8 rounded flex items-center justify-center cursor-pointer text-base backdrop-filter backdrop-blur-[4px] transition-all duration-300 ${
            enlarged
              ? 'bg-slate-950/85 border border-red-500/40 text-red-500 hover:scale-108 hover:bg-slate-900 shadow-[0_0_12px_rgba(255,42,95,0.4)]'
              : 'bg-slate-950/85 border border-cyan-500/30 text-cyan-400 hover:scale-108 hover:bg-slate-950 shadow-[0_0_8px_rgba(0,229,255,0.25)]'
          }`}
          title={enlarged ? "Minimize Street View" : "Expand Street View"}
        >
          {enlarged ? '✕' : '⛶'}
        </button>
      </div>
    </>
  );
};
