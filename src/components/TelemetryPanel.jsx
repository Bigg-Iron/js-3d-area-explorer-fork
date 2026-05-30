// Copyright 2026 Google LLC
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { fleetSimulator } from '../utils/fleet-simulator';

export const TelemetryPanel = () => {
  const opsMode = useStore((state) => state.opsMode);
  const [vehicles, setVehicles] = useState([]);

  // Setup live subscription to the fleet simulator ticks when in fleet-operations mode
  useEffect(() => {
    if (opsMode !== 'fleet-operations') return;

    const interval = setInterval(() => {
      setVehicles(fleetSimulator.getVehicles());
    }, 150);

    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setVehicles(fleetSimulator.getVehicles());

    return () => clearInterval(interval);
  }, [opsMode]);

  if (opsMode === 'area-explorer') return null;

  return (
    <div className="absolute top-24 left-4 z-10 w-80 glass-panel p-4 rounded-2xl border border-white/10 flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pointer-events-auto message-appearing">
      {opsMode === 'fleet-operations' && (
        <>
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#39ff14]">local_shipping</span>
              FLEET ENGINE METRICS
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Active Transits</span>
              <span className="text-[#39ff14] text-xs font-semibold">3 Vehicles Online</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Routing SLA</span>
              <span className="text-white text-xs font-semibold">98.4%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Telemetry Feed</span>
              <span className="text-white text-xs font-semibold">Active (Real-time)</span>
            </div>
          </div>

          <div className="h-px bg-white/10 my-1" />

          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">ACTIVE TRACKING</div>
            <div className="flex flex-col gap-3">
              {vehicles.map((v) => (
                <div key={v.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1.5 hover:border-indigo-500/30 transition-colors duration-200">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-white">{v.id} ({v.type})</span>
                    <span className={v.status === 'DELAYED' ? 'text-[#ff2a5f]' : 'text-[#39ff14]'}>{v.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight">Driver: <span className="text-slate-300 font-medium">{v.driver}</span></div>
                  <div className="text-[11px] text-slate-400 leading-tight">Task: <span className="text-slate-300 font-medium">{v.task}</span></div>
                  <div className="flex justify-between items-center text-[10px] text-indigo-400 font-semibold mt-1">
                    <span>ETA: {v.eta} min</span>
                    <span>Fuel: {v.fuel}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {opsMode === 'indoor-venues' && (
        <>
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#00e5ff]">apartment</span>
              ORIIENT INDOOR GPS
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Active Venue</span>
              <span className="text-white text-xs font-semibold">Chelsea Market Retail Hub</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Calibration State</span>
              <span className="text-[#00e5ff] text-xs font-semibold">Geomagnetic (Locked)</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Accuracy (sub-meter)</span>
              <span className="text-white text-xs font-semibold">± 0.45 meters</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Sensor Lock</span>
              <span className="text-white text-xs font-semibold">Smartphone Magnetometer</span>
            </div>
          </div>

          <div className="h-px bg-white/10 my-1" />

          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">INDOOR FLOOR TRACKER</div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-xs">Active Floor Level</span>
              <span className="text-[#00e5ff] text-xs font-black tracking-wider">LEVEL 1</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal mt-1">
              Oriient Geomagnetic Blue Dot matches the Earth's localized magnetic signatures inside this building.
            </p>
          </div>
        </>
      )}

      {opsMode === 'bq-analytics' && (
        <>
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#d500f9]">bar_chart</span>
              BIGQUERY GEOSPATIAL DATA
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Queried Dataset</span>
              <span className="text-white text-xs font-semibold">nyc_logistics.deliveries_3d</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Records Analyzed</span>
              <span className="text-white text-xs font-semibold">1,248,390 rows</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Query Latency</span>
              <span className="text-[#d500f9] text-xs font-semibold">0.34 seconds</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 text-xs">Visualization Cluster</span>
              <span className="text-white text-xs font-semibold">3D Cylinders (Clamped)</span>
            </div>
          </div>

          <div className="h-px bg-white/10 my-1" />

          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">DELIVERY COMPLETED MAP</div>
            <p className="text-[11px] text-slate-300 leading-normal">
              Aggregated completed logistics orders. Length of the cylinders represents historical density of order drop-offs, perfectly clamped to ground level.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
