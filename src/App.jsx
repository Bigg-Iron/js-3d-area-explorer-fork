// Copyright 2026 Google LLC
import { MapViewer } from './components/MapViewer';
import { HeaderPanel } from './components/HeaderPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { CameraControlsPanel } from './components/CameraControlsPanel';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { PlacesSidebar } from './components/PlacesSidebar';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020617] font-sans select-none">
      {/* Fixed Background Cesium 3D Globe Viewer */}
      <div className="absolute inset-0 z-0">
        <MapViewer />
      </div>

      {/* Floating Space-Age Overlays Container */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Navigation & Global Search Autocomplete */}
        <HeaderPanel />

        {/* Live Simulator & Database Telemetry Metrics (Left) */}
        <TelemetryPanel />

        {/* High-Fidelity 3D Camera Configuration Sliders (Right Bottom) */}
        <CameraControlsPanel />

        {/* Conversational AI Spatial Chat Agent (Left Bottom) */}
        <AIAssistantPanel />

        {/* Native compact Places Details Sidebar (Right Drawer) */}
        <PlacesSidebar />
      </div>
    </div>
  );
}

export default App;
