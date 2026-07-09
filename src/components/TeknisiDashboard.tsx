import React, { useState, useEffect } from 'react';
import { SignalBlock, SwitchWesel, Train, LineDirection, UserCareer, TrainType, Station } from '../types';
import { AlertTriangle, LogOut, CheckCircle2, Siren, Wrench, Volume2, Anchor, Radio, X, Gauge, Activity, Disc } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RealWorldMap from './RealWorldMap';
import { STATIONS } from '../data/tracks';
import { audio } from './AudioEngine';
import VhfRadioDinas from './VhfRadioDinas';
import RadioKomando from './RadioKomando';

interface TeknisiDashboardProps {
  signals: SignalBlock[];
  switches: SwitchWesel[];
  activeTrains: Train[];
  career: UserCareer;
  onUpdateTrain: (updated: Train, penalties: string[], isBanned: boolean, banReason?: string, coupledTrainIds?: string[]) => void;
  onExit: () => void;
  onSendChatMessage: (msg: string, sender: string) => void;
  onClearCollision: (trainId1: string, trainId2: string, stationKp: number, loriTrainId?: string) => void;
}

export default function TeknisiDashboard({
  signals,
  switches,
  activeTrains,
  career,
  onUpdateTrain,
  onExit,
  onSendChatMessage,
  onClearCollision,
}: TeknisiDashboardProps) {
  // Rescue train controlled by this technical player
  const [rescueTrain, setRescueTrain] = useState<Train | null>(null);

  // Keep a ref of rescueTrain to use in unmount cleanup
  const rescueTrainRef = React.useRef<Train | null>(null);
  useEffect(() => {
    rescueTrainRef.current = rescueTrain;
  }, [rescueTrain]);

  // Clean up rescue train on unmount
  useEffect(() => {
    return () => {
      if (rescueTrainRef.current) {
        onClearCollision('', '', 0, rescueTrainRef.current.id);
      }
    };
  }, []);

  const handleExit = () => {
    if (rescueTrain) {
      onClearCollision('', '', 0, rescueTrain.id);
    }
    onExit();
  };
  
  // Selected Incident & coupling status
  const [selectedIncident, setSelectedIncident] = useState<{
    id: string;
    type: 'collision';
    kp: number;
    desc: string;
    trainsInvolved: string[];
  } | null>(null);

  const [towing, setTowing] = useState<boolean>(false);
  const [evacSuccess, setEvacSuccess] = useState<boolean>(false);
  const [showRadioPanel, setShowRadioPanel] = useState<boolean>(false);

  // Filter collided pairs from activeTrains
  const collidedTrains = activeTrains.filter(t => t.hasCollided);

  const activeIncidents: any[] = [];
  if (collidedTrains.length > 0) {
    const seen = new Set<string>();
    collidedTrains.forEach(t => {
      if (seen.has(t.id)) return;
      // find another train close to t.kp
      const partner = collidedTrains.find(ot => ot.id !== t.id && Math.abs(ot.kp - t.kp) < 0.45);
      if (partner) {
        seen.add(t.id);
        seen.add(partner.id);
        activeIncidents.push({
          id: `incident-collision-${t.id}-${partner.id}`,
          type: 'collision',
          kp: t.kp,
          desc: `💥 Tabrakan Hebat Sektor: ${t.name} dan ${partner.name}!`,
          trainsInvolved: [t.id, partner.id]
        });
      }
    });
  }

  // Auto-select first incident if none selected
  useEffect(() => {
    if (activeIncidents.length > 0 && !selectedIncident && !towing) {
      setSelectedIncident(activeIncidents[0]);
    }
  }, [activeIncidents, selectedIncident, towing]);

  // Find nearest station to collision point
  const getNearestStationToKp = (kp: number): Station => {
    return [...STATIONS].sort((a, b) => Math.abs(a.kp - kp) - Math.abs(b.kp - kp))[0];
  };

  const nearestStation = selectedIncident ? getNearestStationToKp(selectedIncident.kp) : STATIONS[2]; // MRI

  // Spawning a Rescue Lori at custom depot selectors
  const spawnRescueTrainAt = (kpStart: number, label: string) => {
    const rId = 'NR-LORI-' + Math.floor(100 + Math.random() * 900);
    const newRescue: Train = {
      id: rId,
      name: `Lori Rescue Derek CC 201 NR (${rId})`,
      type: TrainType.Langsir,
      isAI: false,
      driverName: career.username,
      direction: LineDirection.Hilir,
      kp: kpStart,
      speed: 0,
      maxSpeed: 65,
      targetSpeedLimit: 60,
      currentPlatformId: null,
      doorsOpen: false,
      throttle: 0,
      brake: 5,
      reverser: 'N',
      horn: false,
      emergencyBrake: false,
      currentTrackId: 'Main-Hilir',
      cargoType: 'Maintenance',
      lastStopKp: null,
      hasCollided: false,
      isBanned: false
    };

    setRescueTrain(newRescue);
    onUpdateTrain(newRescue, [], false);
    onSendChatMessage(`🛠️ [KREASI]: Teknisi ${career.username} selesai merakit Loko Penyelamat Darurat CC 201 NR (${rId}) di Sektor ${label}!`, 'Sistem Lintas');
  };

  // Click-clack sound effects for lori
  useEffect(() => {
    if (rescueTrain && rescueTrain.speed > 0) {
      audio.startClickClackLoop(rescueTrain.speed);
    } else {
      audio.stopClickClack();
    }
    return () => {
      audio.stopClickClack();
    };
  }, [rescueTrain?.speed]);

  // Physics loop for rescue train
  useEffect(() => {
    if (!rescueTrain) return;

    const interval = setInterval(() => {
      // If fully braked and idle, nothing to do
      if (rescueTrain.brake > 0 && rescueTrain.speed === 0 && rescueTrain.throttle === 0) return;

      let acc = 0;
      if (rescueTrain.throttle > 0 && rescueTrain.reverser !== 'N') {
        const dir = rescueTrain.reverser === 'F' ? 1 : -1;
        // Towing with multi-car wreck slows down the speed
        const weightFactor = towing ? 0.35 : 1.0;
        acc = (rescueTrain.throttle / 5.0) * 4.2 * dir * weightFactor;
      }
      
      const brakeFactor = rescueTrain.brake / 5.0;
      if (rescueTrain.brake > 0) {
        acc -= 6.5 * brakeFactor * (rescueTrain.speed > 0 ? 1 : -1);
      }

      // Train rolling resistance
      if (rescueTrain.speed > 0) {
        acc -= towing ? 0.8 : 0.4;
      } else if (rescueTrain.speed < 0) {
        acc += towing ? 0.8 : 0.4;
      }

      let nextSp = rescueTrain.speed + acc * 0.25;
      if (nextSp < 0.2 && rescueTrain.reverser === 'N') nextSp = 0;
      if (nextSp < 0) nextSp = 0; // Absolute bound
      
      const speedCap = towing ? 40 : rescueTrain.maxSpeed; // Capped speed when towing heavily
      if (nextSp > speedCap) nextSp = speedCap;

      const kmPerSec = nextSp / 3600;
      let nextKp = rescueTrain.kp;
      
      // Drive direction based on reverser (F/R)
      if (rescueTrain.reverser === 'F') {
        nextKp += kmPerSec * 0.25;
      } else if (rescueTrain.reverser === 'R') {
        nextKp -= kmPerSec * 0.25;
      }

      // Hard boundaries of track map
      if (nextKp < 0.1) { nextKp = 0.1; nextSp = 0; }
      if (nextKp > 54.7) { nextKp = 54.7; nextSp = 0; }

      // Update crashed train coords in realtime to simulate dragging them
      const updated = {
        ...rescueTrain,
        speed: nextSp,
        kp: nextKp,
      };

      setRescueTrain(updated);
      
      // Broadcast other connected peers with wreck list if towing
      onUpdateTrain(
        updated, 
        [], 
        false, 
        undefined, 
        towing && selectedIncident ? selectedIncident.trainsInvolved : undefined
      );
    }, 250);

    return () => clearInterval(interval);
  }, [rescueTrain, towing, selectedIncident, onUpdateTrain]);

  const handleCoupleWreck = () => {
    if (!rescueTrain || !selectedIncident) return;
    setTowing(true);
    audio.playBrakeHiss();
    onSendChatMessage(`🔗 [RANTAI KOPEL]: Teknisi ${career.username} berhasil mengunci coupler derek ke badan kereta tabrakan di KM ${selectedIncident.kp.toFixed(2)} Sektor! Mempersiapkan evakuasi ke stasiun terdekat.`, 'Sistem Lintas');
  };

  const handleEvacComplete = () => {
    if (!selectedIncident || !rescueTrain) return;
    const currentNearest = getNearestStationToKp(rescueTrain.kp);
    
    // Clear and repair
    onClearCollision(selectedIncident.trainsInvolved[0], selectedIncident.trainsInvolved[1], currentNearest.kp, rescueTrain.id);
    onSendChatMessage(`✅ [KONDISI PULIH]: Teknisi ${career.username} tuntas mengevakuasi rangkaian sepur ke Stasiun ${currentNearest.name} (KM ${currentNearest.kp.toFixed(2)})! Seluruh sasis kereta dinyatakan prima dan siap meluncur kembali. (+200 PTS)`, 'Sistem Lintas');

    setEvacSuccess(true);
    setTowing(false);
    setSelectedIncident(null);
    setRescueTrain(null); // Despawn lori to clear lines
  };

  const playS35 = () => {
    audio.playSemboyan35();
  };

  const currentDistToIncident = selectedIncident && rescueTrain 
    ? Math.abs(rescueTrain.kp - selectedIncident.kp) 
    : 999;

  const currentDistToStation = rescueTrain
    ? Math.abs(rescueTrain.kp - nearestStation.kp)
    : 999;

  return (
    <div id="teknisi-dashboard" className="relative w-full h-[calc(100vh-100px)] md:h-[calc(100vh-70px)] overflow-hidden bg-[#070a13] text-gray-100 font-sans select-none flex flex-col">

      {/* 1. MAP CANVAS CONTAINER - Absolute Full Screen Background (sama seperti MasinisDashboard) */}
      <div className="absolute inset-0 w-full h-full z-0">
        <RealWorldMap
          signals={signals}
          pjls={[]}
          switches={switches}
          trains={activeTrains}
          activeTrain={rescueTrain}
        />
      </div>

      {/* 2. OVERLAID HUD UPPER BAR - Compact Glass Header */}
      <div className="absolute top-2 left-2 right-2 z-[1010] p-2 bg-[#090e1a]/85 backdrop-blur-md border border-slate-800/80 rounded-lg shadow-2xl flex items-center justify-between gap-2 overflow-hidden pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-rose-500 text-slate-950 font-black px-1.5 py-0.5 rounded text-[8px] md:text-[9px] tracking-wider uppercase font-mono flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            <span className="hidden xs:inline">TEKNISI</span>
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wide text-white font-mono leading-none">{career.username}</h1>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5">
              {career.rank} • <strong className="text-amber-400">{career.points} PTS</strong> {rescueTrain && <>• KM <strong className="text-emerald-400">{rescueTrain.kp.toFixed(3)}</strong></>}
            </p>
          </div>
        </div>

        {/* Dynamic Urgency Alerts */}
        <div className="hidden sm:flex items-center gap-2 pointer-events-none">
          <AnimatePresence>
            {activeIncidents.length > 0 && !rescueTrain && !evacSuccess && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="flex items-center gap-1 bg-red-950/90 border border-red-500 text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase font-mono animate-pulse"
              >
                <Siren size={11} className="animate-bounce" />
                <span>{activeIncidents.length} PLH AKTIF - SEGERA DISPATCH LORI!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
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

          <button
            onClick={handleExit}
            className="bg-red-600 hover:bg-red-700 active:scale-95 text-[9px] font-black px-2 py-1 rounded transition-all uppercase tracking-wider font-mono cursor-pointer flex items-center gap-1 shadow-md"
          >
            <LogOut size={10} />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* 3. OVERLAID HUD LEFT SIDE - Status Insiden & Telemetri */}
      <div className="absolute top-14 md:top-16 left-1 md:left-2 bottom-1 md:bottom-2 w-44 md:w-56 z-[1010] flex flex-col justify-end gap-1 pointer-events-none sm:scale-100 scale-[0.78] origin-bottom-left">

        {/* Sm-screen inline alert (mirrors Masinis pattern) */}
        <AnimatePresence>
          {activeIncidents.length > 0 && !rescueTrain && !evacSuccess && (
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -10, opacity: 0 }}
              className="sm:hidden pointer-events-auto flex items-center gap-1 bg-red-950/95 border border-red-500 text-red-500 p-1.5 rounded-lg text-[8px] font-black font-mono animate-pulse"
            >
              <Siren size={11} />
              <span>{activeIncidents.length} PLH AKTIF!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speedometer readout (jika lori sudah diberangkatkan) */}
        {rescueTrain && (
          <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg shadow-2xl flex flex-col gap-1.5 pointer-events-auto">
            <div className="flex justify-between items-center border-b border-indigo-950/45 pb-1">
              <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase font-mono flex items-center gap-1">
                <Gauge size={10} className="text-amber-400" /> SPEEDOMETER
              </span>
              <Activity size={10} className="text-emerald-500 animate-pulse" />
            </div>
            <div className="flex items-baseline justify-center gap-1 py-1">
              <span className="text-3xl md:text-4xl font-mono font-black tracking-tighter text-emerald-400">
                {Math.round(rescueTrain.speed)}
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase font-mono">Km/h</span>
            </div>
            <div className="grid grid-cols-2 gap-1 font-mono">
              <div className="bg-[#030610] p-1 rounded text-center border border-indigo-950">
                <span className="text-[7.5px] text-slate-500 uppercase block leading-none">Maks Selubung</span>
                <span className="text-pink-400 text-[11px] font-black font-mono mt-0.5 block leading-none">{towing ? '40' : '65'}</span>
              </div>
              <div className="bg-[#030610] p-1 rounded text-center border border-indigo-950">
                <span className="text-[7.5px] text-slate-500 uppercase block leading-none">Tow-Lock</span>
                <span className={`text-[11px] font-bold font-mono mt-0.5 block leading-none ${towing ? 'text-emerald-400' : 'text-slate-500'}`}>{towing ? 'KONEK' : 'LEPAS'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Incident / Telemetry Card */}
        <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
          <div className="text-[8px] font-black tracking-widest text-rose-400 uppercase font-mono border-b border-indigo-950/45 pb-1 mb-1 flex items-center gap-1">
            <Siren size={10} className="animate-pulse" /> TELEMETRI PLH
          </div>

          {selectedIncident ? (
            <>
              <div className="text-[8.5px] font-mono leading-relaxed">
                <span className="text-slate-400">Sektor: </span>
                <span className="text-rose-400 font-bold">KM {selectedIncident.kp.toFixed(2)}</span>
              </div>
              <div className="text-[8.5px] font-mono leading-relaxed truncate" title={selectedIncident.trainsInvolved.join(' & ')}>
                <span className="text-slate-400">Rangkaian: </span>
                <span className="text-white font-bold">{selectedIncident.trainsInvolved.join(' 💥 ')}</span>
              </div>
              {!towing ? (
                rescueTrain ? (
                  <div className={`text-[8.5px] font-mono font-bold ${currentDistToIncident <= 0.25 ? 'text-emerald-400' : 'text-amber-500 animate-pulse'}`}>
                    Jarak: {currentDistToIncident.toFixed(3)} KM {currentDistToIncident <= 0.25 ? '(Siap Kopel)' : ''}
                  </div>
                ) : (
                  <div className="text-[8.5px] font-mono text-red-400 italic">Lori belum berangkat.</div>
                )
              ) : (
                <div className="text-[8.5px] font-mono leading-relaxed">
                  <div className="text-emerald-400 font-black">✓ KOPEL TERKUNCI</div>
                  <div className="text-slate-300">Tujuan: <strong className="text-white">{nearestStation.name}</strong></div>
                  <div className={`font-bold ${currentDistToStation <= 0.15 ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
                    Jarak stasiun: {(currentDistToStation * 1000).toFixed(0)}m
                  </div>
                </div>
              )}
            </>
          ) : evacSuccess ? (
            <div className="text-[8.5px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={11} /> Evakuasi sukses! +200 PTS
            </div>
          ) : (
            <div className="text-[8.5px] font-mono text-emerald-500 flex items-center gap-1">
              <CheckCircle2 size={11} /> Lintas aman, tidak ada PLH.
            </div>
          )}
        </div>
      </div>

      {/* 4. OVERLAID HUD RIGHT SIDE - Kontrol Lori / Depo Deploy */}
      <div className="absolute top-14 md:top-16 right-1 md:right-2 bottom-1 md:bottom-2 w-48 md:w-60 z-[1010] flex flex-col justify-end gap-1 pointer-events-none sm:scale-100 scale-[0.72] origin-bottom-right overflow-y-auto max-h-[calc(100%-3.5rem)]">

        {!rescueTrain ? (
          /* Depot deployment selection (compact, no page scroll needed) */
          <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2.5 rounded-lg shadow-2xl flex flex-col gap-1.5 pointer-events-auto">
            <div className="text-[8px] font-black tracking-widest text-slate-400 uppercase font-mono border-b border-indigo-950/45 pb-1 mb-0.5 flex items-center gap-1">
              <Anchor size={10} className="text-amber-500" /> DEPLOY LORI NR
            </div>
            <button
              onClick={() => spawnRescueTrainAt(9.8, 'Utara (Manggarai)')}
              className="w-full bg-[#101726] hover:bg-slate-800 text-slate-200 border border-slate-800 py-1.5 rounded text-[8.5px] font-mono font-bold text-left px-2 flex justify-between items-center transition-colors"
            >
              <span>UTARA (MANGGARAI)</span>
              <strong className="text-amber-500">9.8</strong>
            </button>
            <button
              onClick={() => spawnRescueTrainAt(31.5, 'Tengah (Depok)')}
              className="w-full bg-[#101726] hover:bg-slate-800 text-slate-200 border border-slate-800 py-1.5 rounded text-[8.5px] font-mono font-bold text-left px-2 flex justify-between items-center transition-colors"
            >
              <span>TENGAH (DEPOK)</span>
              <strong className="text-amber-500">31.5</strong>
            </button>
            <button
              onClick={() => spawnRescueTrainAt(54.3, 'Selatan (Bogor)')}
              className="w-full bg-[#101726] hover:bg-slate-800 text-slate-200 border border-slate-800 py-1.5 rounded text-[8.5px] font-mono font-bold text-left px-2 flex justify-between items-center transition-colors"
            >
              <span>SELATAN (BOGOR)</span>
              <strong className="text-amber-500">54.3</strong>
            </button>
            <button
              onClick={() => spawnRescueTrainAt(4.0, 'Timur (Pasar Senen)')}
              className="w-full bg-[#101726] hover:bg-slate-800 text-slate-200 border border-slate-800 py-1.5 rounded text-[8.5px] font-mono font-bold text-left px-2 flex justify-between items-center transition-colors"
            >
              <span>TIMUR (PSN)</span>
              <strong className="text-amber-500">4.0</strong>
            </button>
          </div>
        ) : (
          <>
            {/* Air brakes handle controller */}
            <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2 md:p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
              <div className="flex justify-between items-center text-[8px] font-mono leading-none">
                <span className="font-black text-slate-400 uppercase tracking-widest">REM UDARA</span>
                <span className="font-bold text-cyan-400">NOTCH: B{rescueTrain.brake}</span>
              </div>
              <div className="grid grid-cols-6 gap-0.5 bg-[#030610] p-0.5 rounded border border-indigo-950/70 mt-1">
                {Array.from({ length: 6 }).map((_, b) => (
                  <button
                    key={b}
                    onClick={() => {
                      setRescueTrain(prev => prev ? { ...prev, brake: b, throttle: b > 0 ? 0 : prev.throttle } : null);
                      if (b > 0) audio.playBrakeHiss();
                    }}
                    className={`py-1.5 rounded font-mono font-black text-[9px] cursor-pointer transition-colors ${
                      rescueTrain.brake === b ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    B{b}
                  </button>
                ))}
              </div>
            </div>

            {/* Throttle */}
            <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2 md:p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
              <div className="flex justify-between items-center text-[8px] font-mono leading-none">
                <span className="font-black text-slate-400 uppercase tracking-widest">TENAGA GAS</span>
                <span className="font-bold text-amber-400">NOTCH: N{rescueTrain.throttle}</span>
              </div>
              <div className="grid grid-cols-6 gap-0.5 bg-[#030610] p-0.5 rounded border border-indigo-950/70 mt-1">
                {Array.from({ length: 6 }).map((_, n) => (
                  <button
                    key={n}
                    onClick={() => setRescueTrain(prev => prev ? { ...prev, throttle: n, brake: n > 0 ? 0 : prev.brake } : null)}
                    className={`py-1.5 rounded font-mono font-black text-[9px] cursor-pointer transition-colors ${
                      rescueTrain.throttle === n ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    N{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Reverser */}
            <div className="bg-[#080d1a]/85 backdrop-blur-md border border-slate-800/80 p-2 md:p-2.5 rounded-lg shadow-2xl flex flex-col gap-1 pointer-events-auto">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">Reverser</label>
              <div className="grid grid-cols-3 gap-0.5 bg-[#030610] p-0.5 rounded border border-indigo-950/70 mt-1">
                {(['R', 'N', 'F'] as const).map(dir => (
                  <button
                    key={dir}
                    onClick={() => setRescueTrain(prev => prev ? { ...prev, reverser: dir } : null)}
                    className={`py-1 rounded text-[8.5px] font-black font-mono tracking-wider cursor-pointer transition-colors ${
                      rescueTrain.reverser === dir ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    {dir === 'F' ? 'MAJU' : dir === 'R' ? 'MNDR' : 'NTRL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Klakson + action buttons */}
            <div className="grid grid-cols-2 gap-1.5 pointer-events-auto">
              <button
                onClick={playS35}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black py-2 rounded-lg text-[9px] flex items-center justify-center gap-1 transition-colors cursor-pointer select-none active:scale-95 shadow-md shadow-amber-900/15 uppercase font-mono"
              >
                <Volume2 size={12} />
                <span>S.35</span>
              </button>
              <button
                onClick={() => {
                  setRescueTrain(prev => prev ? { ...prev, brake: 0 } : null);
                  audio.playBrakeHiss();
                }}
                className="bg-[#0a0f1e]/90 text-cyan-400 border border-indigo-950 hover:bg-[#151c33] py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer select-none active:scale-95 uppercase font-mono"
              >
                <Disc size={12} />
                <span>Rilis B0</span>
              </button>
            </div>

            {/* Kopel / Evakuasi mission action button */}
            {selectedIncident && !towing && (
              <button
                onClick={handleCoupleWreck}
                disabled={currentDistToIncident > 0.25}
                className="w-full py-2 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer select-none pointer-events-auto flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 uppercase font-mono"
              >
                <Wrench size={11} />
                <span>KUNCI KOPEL LORI</span>
              </button>
            )}
            {selectedIncident && towing && (
              <button
                onClick={handleEvacComplete}
                disabled={rescueTrain.speed > 0 || currentDistToStation > 0.15}
                className="w-full py-2 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer select-none pointer-events-auto flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 uppercase font-mono animate-pulse"
              >
                <CheckCircle2 size={11} />
                <span>DEKLARASI EVAKUASI</span>
              </button>
            )}
          </>
        )}

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
                🎙️ KOMUNIKASI ON-MIC (TEKNIS)
              </span>
              <button
                onClick={() => setShowRadioPanel(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              <RadioKomando
                activeTrain={rescueTrain || {
                  id: `TEK-${career.username}`,
                  name: `Lori Teknisi`,
                  type: TrainType.Langsir,
                  kp: 15.0,
                  direction: LineDirection.Hilir,
                  speed: 0,
                  throttle: 0,
                  brake: 0,
                  reverser: 'N',
                  isAI: false,
                  hasCollided: false,
                  isBanned: false,
                  driverName: career.username,
                  maxSpeed: 30,
                  targetSpeedLimit: 30,
                  currentPlatformId: null,
                  doorsOpen: false,
                  horn: false,
                  emergencyBrake: false,
                  currentTrackId: 'Main_Line',
                  cargoType: 'Passengers',
                  lastStopKp: null
                }}
                allTrains={activeTrains}
                senderId={career.username}
              />
              <VhfRadioDinas
                role="Teknisi"
                username={career.username}
                onSendChatMessage={onSendChatMessage}
                selectedZone={rescueTrain ? (rescueTrain.kp < 15 ? 1 : rescueTrain.kp < 35 ? 2 : 3) : 3}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
