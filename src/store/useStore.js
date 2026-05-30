import { create } from 'zustand';

export const useStore = create((set) => ({
  // Active tab/operations mode: 'area-explorer' | 'fleet-operations' | 'indoor-venues' | 'bq-analytics'
  opsMode: 'area-explorer',
  
  // Mapped operational center coordinate (defaults to Chelsea Market, NYC from config.json)
  centerCoords: { lat: 40.74244, lng: -74.006144 },
  
  // Surrounding POIs for markers
  nearbyPois: [],
  
  // Selected place for side panel details
  selectedPlace: null,
  selectedPlaceId: null,
  
  // 3D camera properties
  cameraState: {
    autoOrbitEnabled: true,
    orbitSpeed: 1.0,  // RPM
    orbitRadius: 800, // meters
    orbitPitch: -30,  // degrees (tilt)
    orbitStyle: 'dynamic-orbit', // 'fixed-orbit' (circular) | 'dynamic-orbit' (sine wave)
  },

  // Agentic chat state
  chatState: {
    isOpen: false,
    messages: [
      {
        role: 'system',
        content: 'Hello! I am your Geospatial Operations Assistant. Try asking me:\n\n• "Find nice cafes in Las Vegas"\n• "Plan a walking route from Bellagio to Caesars Palace"\n• "What\'s the weather in Seattle?"',
      }
    ],
    status: 'Ready',
    chatHistory: [],
    activeSearchPlaces: [], // Markers generated from chat function calls
    activeRoutes: [],       // Routes calculated from chat directions function calls
  },

  // Actions
  setOpsMode: (opsMode) => set({ opsMode }),
  
  setCenterCoords: (centerCoords) => set({ centerCoords }),
  
  setNearbyPois: (nearbyPois) => set({ nearbyPois }),
  
  setSelectedPlace: (selectedPlace) => set({ 
    selectedPlace, 
    selectedPlaceId: selectedPlace ? (selectedPlace.id || selectedPlace.placeId || selectedPlace.place_id) : null 
  }),
  
  setSelectedPlaceId: (selectedPlaceId) => set({ selectedPlaceId }),

  updateCameraState: (patch) => set((state) => ({
    cameraState: { ...state.cameraState, ...patch }
  })),

  updateChatState: (patch) => set((state) => ({
    chatState: { ...state.chatState, ...patch }
  })),

  addChatMessage: (msg) => set((state) => ({
    chatState: {
      ...state.chatState,
      messages: [...state.chatState.messages, msg]
    }
  })),

  resetCameraSliders: () => set((state) => ({
    cameraState: {
      ...state.cameraState,
      orbitRadius: 800,
      orbitPitch: -30,
    }
  })),
}));
