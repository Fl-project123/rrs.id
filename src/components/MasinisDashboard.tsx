import React, { useState, useEffect, useRef } from 'react';
import { Train, SignalBlock, PJLCrossing, SignalColor, LineDirection, TrainType, UserCareer, SwitchWesel } from '../types';
import { getSpeedLimitAtKp, STATIONS, getXCoordinateFromKp, getTrackY, getTrackPath } from '../data/tracks';
import { updateTrainPhysics, TRAIN_SPECS } from '../utils/engine';
import { audio } from './AudioEngine';
import RealWorldMap from './RealWorldMap';
import RadioKomando from './RadioKomando';
import VhfRadioDinas from './VhfRadioDinas';
import GameCanvas from './GameCanvas';
import { 
  AlertTriangle, 
  Disc, 
  Volume2, 
  ShieldCheck, 
  DoorOpen, 
  Compass, 
  Maximize2,
  Navigation,
  LogOut,
  MapPin,
  HelpCircle,
  X,
  Gauge,
  Activity,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MasinisDashboardProps {
  train: Train;
  allTrains: Train[];
  signals: SignalBlock[];
  pjls: PJLCrossing[];
  career: UserCareer;
  switches?: SwitchWesel[];
  onUpdateTrain: (updated: Train, penalties: string[], isBanned: boolean, banReason?: string) => void;
  onToggleSignal?: (id: string, color: SignalColor) => void;
  onTogglePJL?: (id: string, isClosed: boolean) => void;
  onExit: () => void;
  senderId: string;
  onSendChatMessage: (msg: string, sender: string) => void;
}

export default function MasinisDashboard({
  train,
  allTrains,
  signals,
  pjls,
  career,
  switches,
  onUpdateTrain,
  onToggleSignal,
  onTogglePJL,
  onExit,
  senderId,
  onSendChatMessage
}: MasinisDashboardProps) {
  // Local control inputs
  const [throttle, setThrottle] = useState(train.throttle);
  const [brake, setBrake] = useState(train.brake);
  const [reverser, setReverser] = useState(train.reverser);
  const [doorsOpen, setDoorsOpen] = useState(train.doorsOpen);
  const [emergencyBrake, setEmergencyBrake] = useState(train.emergencyBrake);

  // Map mode toggle ('leaflet' = real world Leaflet JS, 'schematic' = original stylised SVG)
  const [mapMode, setMapMode] = useState<'leaflet' | 'schematic'>('leaflet');

  // Toggle Semboyan Signal guide panel overlay
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Toggle Left-side Collapsible Radio Panel
  const [showRadioPanel, setShowRadioPanel] = useState<boolean>(false);

  // Map Navigation states (for schematic mode)
  const [zoom, setZoom] = useState<number>(1.3);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [autoCenter, setAutoCenter] = useState<boolean>(true);

  // Drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const prevSpeedRef = useRef(train.speed);

  // Sync inputs if changed externally (AI takeovers, dispatcher updates)
  useEffect(() => {
    setThrottle(train.throttle);
    setBrake(train.brake);
    setReverser(train.reverser);
    setDoorsOpen(train.doorsOpen);
    setEmergencyBrake(train.emergencyBrake);
  }, [train.id, train.isAI]);

  // Tick physics loop every 100ms
  useEffect(() => {
    if (train.isAI) return;

    const interval = setInterval(() => {
      const currentInputs: Train = {
        ...train,
        throttle,
        brake,
        reverser,
        doorsOpen,
        emergencyBrake
      };

      const { updatedTrain, penalties, kickAndBan, banReason } = updateTrainPhysics(
        currentInputs,
        0.1,
        signals,
        pjls
      );

      if (Math.abs(updatedTrain.speed - prevSpeedRef.current) > 2) {
        audio.startClickClackLoop(updatedTrain.speed);
        prevSpeedRef.current = updatedTrain.speed;
      }

      onUpdateTrain(updatedTrain, penalties, kickAndBan, banReason);
    }, 100);

    return () => {
      clearInterval(interval);
      audio.stopClickClack();
    };
  }, [train, throttle, brake, reverser, doorsOpen, emergencyBrake, signals, pjls]);

  // GPS Auto-centering for schematic mode
  useEffect(() => {
    if (autoCenter && mapMode === 'schematic') {
      const pct = getXCoordinateFromKp(train.kp);
      const trainSvgX = (pct / 100) * 900 + 50;
      setPanX(500 - trainSvgX);
      setPanY(0);
    }
  }, [train.kp, autoCenter, mapMode]);

  // Drag handlers for schematic mode
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panX, y: e.clientY - panY };
    setAutoCenter(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.current.x);
    setPanY(e.clientY - dragStart.current.y);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const toggleHorn = () => {
    audio.playSemboyan35();
  };

  const handleBrakeHiss = (level: number) => {
    setBrake(level);
    if (level > 0) audio.playBrakeHiss();
  };

  const toggleDoors = () => {
    if (train.speed > 0) return;
    const nextDoors = !doorsOpen;
    setDoorsOpen(nextDoors);
    audio.playDoorChime();
  };

  const infoLimit = getSpeedLimitAtKp(train.kp);
  const isSpeeding = train.speed > train.targetSpeedLimit;

  // Nearby signaling indicators
  const facingSignals = signals.filter(s => 
    s.direction === train.direction && 
    (train.direction === LineDirection.Hilir ? s.kp > train.kp : s.kp < train.kp)
  );
  facingSignals.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );
  const activeSignal = facingSignals[0];
  const distSignal = activeSignal ? Math.abs(activeSignal.kp - train.kp) : null;

  // Next Station approach calculations
  const upcomingStations = STATIONS.filter(s => 
    (train.direction === LineDirection.Hilir ? s.kp > train.kp : s.kp < train.kp)
  );
  upcomingStations.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );
  const nextStation = upcomingStations[0];
  const distStation = nextStation ? Math.abs(nextStation.kp - train.kp) : null;

  // Nearby level crossing PJL approach
  const upcomingPJLs = pjls.filter(p => 
    (train.direction === LineDirection.Hilir ? p.kp > train.kp : p.kp < train.kp)
  );
  upcomingPJLs.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );
  const activePJL = upcomingPJLs[0];
  const distPJL = activePJL ? Math.abs(activePJL.kp - train.kp) : null;

  return (
    <div id="masinis-comprehensive-monitor" className="relative w-full h-[calc(100vh-100px)] md:h-[calc(100vh-70px)] overflow-hidden bg-[#070a13] text-gray-100 font-sans select-none flex flex-col">
      
      {/* 1. MAP CANVAS CONTAINER - Absolute Full Screen Background */}
      <div className="absolute inset-0 w-full h-full z-0">
        {mapMode === 'leaflet' ? (
          <RealWorldMap
            activeTrain={train}
            trains={allTrains}
            signals={signals}
            pjls={pjls}
          />
        ) : (
          <div className="w-full h-full bg-[#05070e] relative overflow-y-auto p-4 pt-20 pb-24 flex flex-col justify-start items-center z-10 pointer-events-auto">
            <GameCanvas
              trains={allTrains}
              signals={signals}
              switches={switches || []}
              userRole="Masinis"
              userStationId={train.lastStoppedStationId || 'MRI'}
            />
          </div>
        )}
      </div>

      {/* 2. OVERLAID HUD UPPER BAR - Compact Glass Header */}
      <div className="absolute top-2 left-2 right-2 z-[1010] p-2 bg-[#090e1a]/85 backdrop-blur-md border border-slate-800/80 rounded-lg shadow-2xl flex items-center justify-between gap-2 overflow-hidden pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded text-[8px] md:text-[9px] tracking-wider uppercase font-mono flex items-center gap-1">
            <Compass className="animate-spin-slow w-3 h-3" />
            <span className="hidden xs:inline">KABIN</span>
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wide text-white font-mono leading-none">{train.name}</h1>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
              KM <strong className="text-amber-400">{train.kp.toFixed(3)}</strong> • {train.direction === LineDirection.Hilir ? 'Bogor (Turun)' : 'Jkt Kota (Naik)'}
            </p>
          </div>
        </div>

        {/* Dynamic Urgency Alerts (Flashing HUD indicators) */}
        <div className="hidden sm:flex items-center gap-2 pointer-events-none">
          <AnimatePresence>
            {isSpeeding && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="flex items-center gap-1 bg-red-950/90 border border-red-500 text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono animate-pulse"
              >
                <AlertTriangle size={11} />
                <span>MELEBIHI BATAS SPEED LIMIT (OVERSPEED)</span>
              </motion.div>
            )}
            {activePJL && distPJL !== null && distPJL < 0.8 && !activePJL.isClosed && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="flex items-center gap-1 bg-amber-950/90 border border-amber-500 text-amber-300 px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono"
              >
                <AlertTriangle size={11} className="animate-bounce" />
                <span>PJL DEPAN TERBUKA!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* HUD Navigation Config (Toggle View modes, exit cab) */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Map view selector */}
          <div className="flex bg-[#050811] border border-indigo-950 rounded p-0.5">
            <button
              onClick={() => setMapMode('leaflet')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all ${
                mapMode === 'leaflet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Peta Geografis
            </button>
            <button
              onClick={() => setMapMode('schematic')}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all ${
                mapMode === 'schematic' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Skematik
            </button>
          </div>

          {/* Semboyan rules tutorial */}
          <button 
            onClick={() => setShowGuide(true)}
            className="p-1 rounded bg-[#101726] border border-slate-800 text-indigo-400 hover:text-indigo-300 active:scale-90 transition-all cursor-pointer"
            title="Buka Informasi Semboyan"
          >
            <HelpCircle size={13} />
          </button>

          {/* ON-MIC Collapsible Drawer Button */}
          <button 
            onClick={() => setShowRadioPanel(!showRadioPanel)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black tracking-wider font-mono cursor-pointer transition-all uppercase ${
              showRadioPanel 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg' 
                : 'bg-[#101726] border border-slate-800 text-indigo-400 hover:text-indigo-300'
            }`}
            title="Buka VHF Radio Dinas / Komando"
          >
            <Radio size={11} className={showRadioPanel ? 'animate-pulse text-white' : 'text-indigo-400'} />
            <span>ON-MIC</span>
          </button>

          {/* Exit from cab back to station selection */}
          <button 
            id="btn-return-lobby"
            onClick={onExit}
            className="bg-red-600 hover:bg-red-700 active:scale-95 text-[9px] font-black px-2 py-1 rounded transition-all uppercase tracking-wider font-mono cursor-pointer flex items-center gap-1 shadow-md"
          >
            <LogOut size={10} />
            <span>Kabin</span>
          </button>
        </div>
      </div>

      {/* 3. OVERLAID HUD LEFT SIDE - Digital Performance Instruments (Speed, Limit, Signals) */}
      <div className="absolute top-14 md:top-16 left-1 md:left-2 bottom-1 md:bottom-2 w-44 md:w-52 z-[1010] flex flex-col justify-end gap-1 pointer-events-none sm:scale-100 scale-[0.78] origin-bottom-left">
        
        {/* Dynamic Warning Alert on mobile screen (since middle is hidden) */}
        <AnimatePresence>
          {isSpeeding && (
            <motion.div 
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -10, opacity: 0 }}
              className="sm:hidden pointer-events-auto flex items-center gap-1 bg-red-950/95 border border-red-500 text-red-500 p-1.5 rounded-lg text-[8px] font-black font-mono animate-pulse"
            >
              <AlertTriangle size={11} />
              <span>OVER-SPEED WARNING!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speedometer card readout */}
        <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg shadow-2xl flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex justify-between items-center border-b border-indigo-950/45 pb-1">
            <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase font-mono flex items-center gap-1">
              <Gauge size={10} className="text-amber-400" /> SPEEDOMETER
            </span>
            <Activity size={10} className="text-emerald-500 animate-pulse" />
          </div>

          <div className="flex items-baseline justify-center gap-1 py-1">
            <span className={`text-3xl md:text-4xl font-mono font-black tracking-tighter transition-colors ${isSpeeding ? 'text-red-500 animate-flash' : 'text-emerald-400'}`}>
              {Math.round(train.speed)}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase font-mono">Km/h</span>
          </div>

          {/* Target limits */}
          <div className="grid grid-cols-2 gap-1 font-mono">
            <div className="bg-[#030610] p-1 rounded text-center border border-indigo-950">
              <span className="text-[7.5px] text-slate-500 uppercase block leading-none">Limit Jalur</span>
              <span className="text-pink-400 text-[11px] font-black font-mono mt-0.5 block leading-none">{train.targetSpeedLimit}</span>
            </div>
            <div className="bg-[#030610] p-1 rounded text-center border border-indigo-950">
              <span className="text-[7.5px] text-slate-500 uppercase block leading-none">Max Unit</span>
              <span className="text-slate-400 text-[11px] font-bold font-mono mt-0.5 block leading-none">{TRAIN_SPECS[train.type]?.maxSpeed || 90}</span>
            </div>
          </div>

          <div className="text-[8px] text-slate-400 font-mono mt-0.5 border-t border-indigo-950/30 pt-1 leading-normal truncate" title={infoLimit.desc}>
            Lintas: <span className="text-slate-300 font-bold">{infoLimit.desc}</span>
          </div>
        </div>

        {/* Upstream Route Signals Radar Card */}
        <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
          <div className="text-[8px] font-black tracking-widest text-slate-400 uppercase font-mono border-b border-indigo-950/45 pb-1 mb-1">
            RADAR LINTAS PANTAU
          </div>

          {/* Upcoming Station stop */}
          <div className="flex items-center justify-between text-[8.5px] font-mono leading-relaxed">
            <span className="text-slate-400 flex items-center gap-1">
              <MapPin size={9} className="text-indigo-400" /> Stasiun:
            </span>
            <span className="text-slate-200 font-bold">
              {nextStation ? `${nextStation.name} (${distStation?.toFixed(2)} KM)` : '--'}
            </span>
          </div>

          {/* Upcoming Signal info */}
          <div className="flex items-center justify-between text-[8.5px] font-mono leading-relaxed">
            <span className="text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Sinyal Blok:
            </span>
            {activeSignal ? (
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  activeSignal.color === SignalColor.Red ? 'bg-red-500 animate-pulse' :
                  activeSignal.color === SignalColor.Yellow ? 'bg-yellow-400' : 'bg-emerald-500'
                }`} />
                <span className="text-slate-200 font-bold">
                  {activeSignal.id.substring(4)} ({distSignal?.toFixed(2)} KM)
                </span>
              </div>
            ) : (
              <span className="text-slate-500">Tdk ada</span>
            )}
          </div>

          {/* Upcoming PJL info */}
          <div className="flex items-center justify-between text-[8.5px] font-mono leading-relaxed mt-0.5">
            <span className="text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> PJL Perlintasan:
            </span>
            <span className={`font-bold ${activePJL && !activePJL.isClosed ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
              {activePJL ? `${activePJL.name} (${distPJL?.toFixed(2)} KM)` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. OVERLAID HUD RIGHT SIDE - Engine Master Controls (Levers, Brakes, Throttle) */}
      <div className="absolute top-14 md:top-16 right-1 md:right-2 bottom-1 md:bottom-2 w-48 md:w-56 z-[1010] flex flex-col justify-end gap-1 pointer-events-none sm:scale-100 scale-[0.72] origin-bottom-right">
        
        {/* Air brakes handle controller */}
        <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2 md:p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
          <div className="flex justify-between items-center text-[8px] font-mono leading-none">
            <span className="font-black text-slate-400 uppercase tracking-widest">REM UDARA (AIR BRAKES)</span>
            <span className="font-bold text-cyan-400">NOTCH: B{brake}</span>
          </div>
          <div className="grid grid-cols-6 gap-0.5 bg-[#030610] p-0.5 rounded border border-indigo-950/70 mt-1">
            {Array.from({ length: 6 }).map((_, level) => (
              <button
                key={level}
                onClick={() => handleBrakeHiss(level)}
                className={`py-1.5 rounded font-mono font-black text-[9px] cursor-pointer transition-colors ${
                  brake === level 
                    ? 'bg-cyan-500 text-slate-950 font-black' 
                    : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                B{level}
              </button>
            ))}
          </div>
        </div>

        {/* Throttle Power notched Gas */}
        <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2 md:p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
          <div className="flex justify-between items-center text-[8px] font-mono leading-none">
            <span className="font-black text-slate-400 uppercase tracking-widest">TENAGA GAS (THROTTLE)</span>
            <span className="font-bold text-amber-400">NOTCH: N{throttle}</span>
          </div>
          <div className="grid grid-cols-6 gap-0.5 bg-[#030610] p-0.5 rounded border border-indigo-950/70 mt-1">
            {Array.from({ length: 6 }).map((_, level) => (
              <button
                key={level}
                onClick={() => {
                  setThrottle(level);
                  if (level > 0 && doorsOpen) {
                    setDoorsOpen(false);
                    audio.playDoorChime();
                  }
                }}
                className={`py-1.5 rounded font-mono font-black text-[9px] cursor-pointer transition-colors ${
                  throttle === level 
                    ? 'bg-amber-500 text-slate-950 font-black' 
                    : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                N{level}
              </button>
            ))}
          </div>
        </div>

        {/* Reverser selector */}
        <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2 md:p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">Gagang Reverser (Pembalik)</label>
          <div className="grid grid-cols-3 gap-0.5 bg-[#030610] p-0.5 rounded border border-indigo-950/70 mt-1">
            {(['R', 'N', 'F'] as const).map(dir => (
              <button
                key={dir}
                onClick={() => { if (train.speed === 0) setReverser(dir); }}
                disabled={train.speed > 0}
                className={`py-1 rounded text-[8.5px] font-black font-mono tracking-wider cursor-pointer transition-colors ${
                  reverser === dir 
                    ? 'bg-amber-500 text-slate-950 font-black' 
                    : 'text-slate-400 hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {dir === 'F' ? 'MAJU (F)' : dir === 'R' ? 'MNDR (R)' : 'NTRL (N)'}
              </button>
            ))}
          </div>
        </div>

        {/* Semboyan 35 & Doors Control Buttons inline */}
        <div className="grid grid-cols-2 gap-1.5 pointer-events-auto">
          <button
            onClick={toggleHorn}
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black py-2 rounded-lg text-[9px] flex items-center justify-center gap-1 transition-colors cursor-pointer select-none active:scale-95 shadow-md shadow-amber-900/15 uppercase font-mono"
          >
            <Volume2 size={12} />
            <span>Semboyan 35</span>
          </button>

          <button
            onClick={toggleDoors}
            disabled={train.speed > 0}
            className={`py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer select-none active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed uppercase font-mono ${
              doorsOpen 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'bg-[#0a0f1e]/90 text-indigo-400 border border-indigo-950 hover:bg-[#151c33]'
            }`}
          >
            <DoorOpen size={12} />
            <span>{doorsOpen ? 'Pintu Buka' : 'Pintu Tutup'}</span>
          </button>
        </div>

        {/* Collapsible ON-MIC Radio Trigger Card */}
        <div className="w-full pointer-events-auto">
          <button
            onClick={() => setShowRadioPanel(!showRadioPanel)}
            className={`w-full py-2 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer select-none flex items-center justify-center gap-1.5 border ${
              showRadioPanel
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 animate-pulse'
                : 'bg-[#0a0f1e]/90 border-indigo-950 text-indigo-400 hover:bg-[#151c33]'
            }`}
          >
            <Radio size={11} className={showRadioPanel ? 'animate-bounce' : ''} />
            <span>🎙️ {showRadioPanel ? 'TUTUP RADIO LINTAS' : 'BUKA RADIO LINTAS'}</span>
          </button>
        </div>

        {/* Big Emergency Stop Button */}
        <button
          onClick={() => {
            setEmergencyBrake(!emergencyBrake);
            setThrottle(0);
            if (!emergencyBrake) {
              setBrake(5);
              audio.playBrakeHiss();
            }
          }}
          className={`w-full py-2 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer select-none pointer-events-auto flex items-center justify-center gap-1 ${
            emergencyBrake
              ? 'bg-red-500 text-slate-950 animate-pulse'
              : 'bg-red-950/75 border border-red-800 text-red-400 hover:bg-red-900/20'
          }`}
        >
          <Disc size={11} className={emergencyBrake ? 'animate-spin-slow' : ''} />
          <span>🚨 EMERGENCY STOP {emergencyBrake ? 'AKTIF' : ''}</span>
        </button>
      </div>

      {/* ON-MIC VHF RADIO SLIDING DRAWER PANEL */}
      <AnimatePresence>
        {showRadioPanel && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute left-0 top-14 md:top-16 bottom-1 md:bottom-2 w-64 md:w-72 z-[1050] bg-[#050914]/98 backdrop-blur-lg border-r border-slate-800/80 p-3 md:p-3.5 rounded-r-lg shadow-2xl flex flex-col gap-3 pointer-events-auto"
          >
            <div className="flex justify-between items-center border-b border-indigo-950/45 pb-2">
              <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase font-mono flex items-center gap-1">
                🎙️ KOMUNIKASI ON-MIC
              </span>
              <button 
                onClick={() => setShowRadioPanel(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              <RadioKomando
                activeTrain={train}
                allTrains={allTrains}
                senderId={senderId}
              />
              <VhfRadioDinas
                role="Masinis"
                username={career.username}
                activeTrainName={train.name}
                onSendChatMessage={onSendChatMessage}
                selectedZone={train.kp < 15 ? 1 : train.kp < 35 ? 2 : 3}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. OVERLAID SEMBOYAN SIGNAL GUIDE MODAL - Sleek transparent glass overlay popup */}
      <AnimatePresence>
        {showGuide && (
          <div className="absolute inset-0 z-[2000] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0f1e]/95 border-2 border-slate-800 rounded-xl p-4 max-w-sm w-full font-sans shadow-2xl relative"
            >
              <button 
                onClick={() => setShowGuide(false)}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 active:scale-90 transition-all cursor-pointer"
              >
                <X size={15} />
              </button>

              <div className="flex items-center gap-1.5 border-b border-indigo-950 pb-2 mb-3">
                <ShieldCheck className="text-amber-400" size={16} />
                <h3 className="text-xs font-black text-indigo-300 font-mono uppercase tracking-wider">PANDUAN PERSINYALAN DINAS</h3>
              </div>

              <div className="flex flex-col gap-3 text-[10px] leading-relaxed">
                <div className="flex items-start gap-2.5 bg-[#030610] p-2 rounded border border-indigo-950">
                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white leading-none text-[10px]">Papan Aspek Hijau</h4>
                    <p className="text-[9px] text-slate-400 mt-1">Jalur aman bebas melaju sesuai limit kecepatan dinas.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-[#030610] p-2 rounded border border-indigo-950">
                  <div className="w-4.5 h-4.5 rounded-full bg-yellow-400 shadow-md shadow-yellow-500/30 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white leading-none text-[10px]">Papan Aspek Kuning</h4>
                    <p className="text-[9px] text-slate-400 mt-1">Kurangi laju! Batas 30 km/h untuk antisipasi sinyal merah.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-[#030610] p-2 rounded border border-indigo-950">
                  <div className="w-4.5 h-4.5 rounded-full bg-red-500 shadow-md shadow-red-500/30 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white leading-none text-[10px]">Papan Sinyal Merah</h4>
                    <p className="text-[9px] text-slate-400 mt-1">BERHENTI MUTLAK! Terobos berakibat skorsing kedisiplinan (ban).</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-[#030610] p-2 rounded border border-indigo-950">
                  <div className="w-6 h-4 bg-yellow-500 text-slate-950 flex items-center justify-center font-black rounded text-[9.5px] shrink-0 font-mono mt-0.5">35</div>
                  <div>
                    <h4 className="font-bold text-white leading-none text-[10px]">Semboyan 35</h4>
                    <p className="text-[9px] text-slate-400 mt-1">Bunyikan suling suara lokomotif di tiang S.35 menjelang perlintasan.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowGuide(false)}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-bold py-1.5 rounded text-[10px] uppercase font-mono shadow-md"
              >
                Paham, Tutup Panduan
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
