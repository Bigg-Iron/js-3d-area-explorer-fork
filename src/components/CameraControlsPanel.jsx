// Copyright 2026 Google LLC
import { useStore } from '../store/useStore';

export const CameraControlsPanel = () => {
  const cameraState = useStore((state) => state.cameraState);
  const updateCameraState = useStore((state) => state.updateCameraState);

  const handleToggleOrbit = (e) => {
    updateCameraState({ autoOrbitEnabled: e.target.checked });
  };

  const handleSpeedChange = (e) => {
    updateCameraState({ orbitSpeed: parseFloat(e.target.value) });
  };

  const handleRadiusChange = (e) => {
    updateCameraState({ orbitRadius: parseInt(e.target.value, 10) });
  };

  const handlePitchChange = (e) => {
    updateCameraState({ orbitPitch: parseInt(e.target.value, 10) });
  };

  const handleStyleChange = (e) => {
    updateCameraState({ orbitStyle: e.target.value });
  };

  return (
    <div className="absolute bottom-6 right-6 z-10 w-80 glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-xl pointer-events-auto">
      <div className="text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
        <span className="material-symbols-outlined text-base text-indigo-400">videocam</span>
        CAMERA CONTROLS
      </div>

      {/* Auto Orbit Mode Toggle */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-indigo-400">public</span>
          Auto Orbit Mode
        </span>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            id="auto-orbit-toggle"
            name="auto-orbit-active"
            checked={cameraState.autoOrbitEnabled}
            onChange={handleToggleOrbit}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      {/* Speed Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">speed</span>
            Orbit Speed
          </span>
          <span className="font-bold text-indigo-400">{cameraState.orbitSpeed.toFixed(1)} RPM</span>
        </div>
        <input
          type="range"
          id="orbit-speed-slider"
          name="orbit-speed"
          min="0.1"
          max="4.0"
          step="0.1"
          value={cameraState.orbitSpeed}
          onChange={handleSpeedChange}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* Radius Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">straighten</span>
            Orbit Radius
          </span>
          <span className="font-bold text-indigo-400">{cameraState.orbitRadius} m</span>
        </div>
        <input
          type="range"
          id="orbit-radius-slider"
          name="orbit-radius"
          min="200"
          max="2500"
          step="50"
          value={cameraState.orbitRadius}
          onChange={handleRadiusChange}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* Pitch Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">architecture</span>
            Pitch (Tilt)
          </span>
          <span className="font-bold text-indigo-400">{cameraState.orbitPitch}°</span>
        </div>
        <input
          type="range"
          id="orbit-pitch-slider"
          name="orbit-pitch"
          min="-75"
          max="-15"
          step="1"
          value={cameraState.orbitPitch}
          onChange={handlePitchChange}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* Orbit Style Select */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-slate-300 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-indigo-400">waves</span>
          Orbit Style
        </span>
        <select
          value={cameraState.orbitStyle}
          onChange={handleStyleChange}
          className="w-full bg-slate-900/80 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="fixed-orbit">Fixed (Circular)</option>
          <option value="dynamic-orbit">Dynamic (Sine wave)</option>
        </select>
      </div>
    </div>
  );
};
