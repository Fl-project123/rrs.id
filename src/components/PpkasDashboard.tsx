import React, { useState } from 'react';
import { SignalBlock, SwitchWesel, PJLCrossing, Train, SignalColor, LineDirection, Role, UserCareer, TrainType } from '../types';
import { STATIONS, getXCoordinateFromKp, getTrackY, getTrackPath } from '../data/tracks';
import { PpkaAuthority } from '../types';
import { AlertCircle, ToggleLeft, Activity, Shield, Users, Radio, HelpCircle, Flame, DoorClosed, MapPin, Zap, RefreshCw, Trash2, Crosshair, Sparkles, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audio } from './AudioEngine';
import RealWorldMap from './RealWorldMap';
import VhfRadioDinas from './VhfRadioDinas';
import RadioKomando from './RadioKomando';
import GameCanvas from './GameCanvas';

interface PpkasDashboardProps {
  signals: SignalBlock[];
  switches: SwitchWesel[];
  pjls: PJLCrossing[];
  activeTrains: Train[];
  career: UserCareer;
  senderId: string;
  ppkaAuthority: PpkaAuthority;
  onToggleSignal: (signalId: string, color: SignalColor) => void;
  onToggleSwitch: (switchId: string, state: 'straight' | 'diverging') => void;
  onTogglePJL: (pjlId: string, isClosed: boolean) => void;
  onSendChatMessage: (message: string, roleLabel: string) => void;
  chatMessages: any[];
  onExit: () => void;
  onSpawnAITrain?: (name: string, type: TrainType, direction: LineDirection, kp: number) => void;
  onClearAllTrains?: () => void;
}

export default function PpkasDashboard({
  signals,
  switches,
  pjls,
  activeTrains,
  career,
  senderId,
  ppkaAuthority,
  onToggleSignal,
  onToggleSwitch,
  onTogglePJL,
  onSendChatMessage,
  chatMessages,
  onExit,
  onSpawnAITrain,
  onClearAllTrains
}: PpkasDashboardProps) {
  // Zona terkunci mengikuti otoritas yang sudah dipilih pemain di gerbang penugasan (App.tsx).
  // PK memegang otoritas seluruh zona; PPKA Stasiun tetap terikat zona tempat stasiunnya berada
  // tapi hanya boleh mengoperasikan peralatan milik stasiun tersebut (lihat checkActionPermission).
  const [selectedZone] = useState<1 | 2 | 3 | 4>(ppkaAuthority.zone);
  const [subRole, setSubRole] = useState<string>(ppkaAuthority.type === 'PK' ? 'Dispatcher Terpusat' : 'Operator Stasiun');
  const [hasJoinedCtrlRoom, setHasJoinedCtrlRoom] = useState<boolean>(false);
  const [radioMsg, setRadioMsg] = useState('');
  const [isBrasiActive, setIsBrasiActive] = useState<boolean>(false);
  const [showRadioPanel, setShowRadioPanel] = useState<boolean>(false);
  const [denialNotice, setDenialNotice] = useState<string | null>(null);

  const [clickedTrain, setClickedTrain] = useState<Train | null>(null);
  const [clickedTrainTimeout, setClickedTrainTimeout] = useState<any>(null);

  const handleTrainClick = (tr: Train) => {
    setClickedTrain(tr);
    if (clickedTrainTimeout) clearTimeout(clickedTrainTimeout);
    const timeout = setTimeout(() => {
      setClickedTrain(null);
    }, 5000);
    setClickedTrainTimeout(timeout);
  };

  // Auto clearance for access denial notification banner
  React.useEffect(() => {
    if (denialNotice) {
      const timer = setTimeout(() => {
        setDenialNotice(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [denialNotice]);

  // Derives the owning station id from a signal/PJL id naming convention (e.g.
  // 'S-JYK-Masuk-Hilir' -> 'JYK', 'PJL-PSN-01' -> 'PSN'), or directly from stationId for switches.
  const getItemStationId = (item: { id: string; stationId?: string | null }): string | null => {
    if (item.stationId) return item.stationId;
    const parts = item.id.split('-');
    return parts.length > 1 ? parts[1] : null;
  };

  const checkActionPermission = (type: 'signal' | 'switch' | 'pjl', item: { id: string; zone: number; stationId?: string | null }): boolean => {
    const itemZone = item.zone;
    // 1. Check zone permission matching selectedZone (otoritas zona dari gerbang penugasan)
    if (itemZone !== selectedZone) {
      setDenialNotice(`Peralatan ini terpasang di Sektor/Zona ${itemZone}, sedangkan Anda saat ini mengendalikan Zona ${selectedZone}! Silakan pilih Zona ${itemZone} untuk mengoperasikannya.`);
      if (audio.playPJLBell) {
        audio.playPJLBell(0.12);
      }
      return false;
    }

    // 1b. Sistem role PPKA baru: PPKA Stasiun hanya boleh mengoperasikan peralatan milik
    // stasiunnya sendiri, walaupun peralatan lain berada di zona yang sama. PK tidak terbatas
    // (berwenang atas seluruh stasiun di zonanya).
    if (ppkaAuthority.type === 'Station') {
      const itemStationId = getItemStationId(item);
      if (itemStationId !== ppkaAuthority.stationId) {
        const stationName = STATIONS.find(s => s.id === ppkaAuthority.stationId)?.name || ppkaAuthority.stationId;
        setDenialNotice(`🔒 [DI LUAR OTORITAS]: Peralatan ini milik stasiun lain. Anda hanya berwenang mengatur peralatan di Stasiun ${stationName}!`);
        if (audio.playPJLBell) {
          audio.playPJLBell(0.12);
        }
        return false;
      }
    }

    // 2. Check career job roles permissions
    if (subRole === 'Dispatcher Terpusat') {
      // Allowed to adjust any signaling mechanism in selected zone
      return true;
    }

    if (subRole === 'Operator Sektor') {
      // Sector/Section Operators control only signals and switches, but NOT individual localized street gate crossings (PJLs)
      if (type === 'pjl') {
        setDenialNotice(`🔐 [AKSES DITOLAK]: Jabatan "Operator Sektor" tidak berhak menutup/membuka pintu perlintasan sebidang (PJL)! Silakan ganti jabatan ke "Operator Stasiun" atau "Dispatcher Terpusat".`);
        return false;
      }
      return true;
    }

    if (subRole === 'Operator Stasiun') {
      // Station operators control local track switches and localized gate crossings, but cannot set main signals aspect blocks
      if (type === 'signal') {
        setDenialNotice(`🔐 [AKSES DITOLAK]: Jabatan "Operator Stasiun" tidak memiliki wewenang mengubah aspek visual semboyan Sinyal blok jalur! Sinyal hanya dikendalikan oleh "Operator Sektor" atau "Dispatcher Terpusat".`);
        return false;
      }
      return true;
    }

    return true;
  };

  // PPKA Training Scenario States
  const [trainingScenario, setTrainingScenario] = useState<string | null>(null);
  const [trainingMsg, setTrainingMsg] = useState<string>(
    '🏆 Dashboard PPKA dilengkapi Modul Latihan Kereta AI. Pilih Skenario di panel kanan untuk memulai!'
  );

  const startScenario = (scId: string) => {
    if (!onClearAllTrains || !onSpawnAITrain) {
      setTrainingMsg('Offline: Sistem Lintas tidak mendeteksi handler simulasi.');
      return;
    }
    onClearAllTrains();
    setTrainingScenario(scId);

    if (scId === 'crossing') {
      onSpawnAITrain('KA Argo Anggrek (Crossing)', TrainType.CC206, LineDirection.Hilir, 6.0);
      onSpawnAITrain('KA Parahyangan (Crossing)', TrainType.CC201, LineDirection.Hulu, 13.5);
      setTrainingMsg(
        '⚔️ PERSILANGAN: KA Argo Anggrek (KM 6.0 Hilir) & KA Parahyangan (KM 13.5 Hulu) saling berhadapan! Atur Wesel W-MRI-01 / W-MRI-02 di Manggarai agar keduanya dapat bersilang aman.'
      );
    } else if (scId === 'commuter') {
      onSpawnAITrain('KRL Commuter 101', TrainType.KRL_8, LineDirection.Hilir, 1.0);
      onSpawnAITrain('KRL Commuter 102', TrainType.KRL_8, LineDirection.Hilir, 4.0);
      onSpawnAITrain('KRL Commuter 103', TrainType.KRL_8, LineDirection.Hilir, 7.0);
      setTrainingMsg(
        '🚉 TRANSIT PADAT: 3 KRL Commuter berjalan berjarak sangat dekat! Atur sinyal merah/kuning blok demi blok untuk menjaga jarak aman.'
      );
    } else if (scId === 'pjl') {
      onTogglePJL('PJL-PSM-01', false); // Open it
      onSpawnAITrain('KA Sembrani (Darurat)', TrainType.CC206, LineDirection.Hilir, 14.5);
      setTrainingMsg(
        '⚠️ PJL RUSAK: Palang pintu Pasar Minggu (KM 16.5) terbuka, KA Sembrani meluncur dari KM 14.5 secara cepat! Segera klik AMANKAN/tutup PJL!'
      );
    }
    // play chime
    audio.playPJLBell(1.0);
  };

  // Map mode ('leaflet' real-world vs 'schematic')
  const [mapMode, setMapMode] = useState<'leaflet' | 'schematic'>('leaflet');
  const [bottomTab, setBottomTab] = useState<'trains' | 'ctc'>('ctc');

  // Synoptic map zoom and dragging/panning states
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left-click dragging
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - panX, y: touch.clientY - panY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPanX(touch.clientX - dragStart.x);
    setPanY(touch.clientY - dragStart.y);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Semboyan and formal Indonesian dispatcher radio shortcuts
  const RADIO_SHORTCUTS = [
    { label: 'KA Berangkat', msg: 'PPKA: KA [Nomor] aman, weesel lurus, jalur bebas, silakan berangkat!' },
    { label: 'Tahan di Sinyal', msg: 'PPKA: KA [Nomor] harap tahan di sinyal masuk, ada persilangan!' },
    { label: 'Palang Pintu', msg: 'PPKA: PJL silakan amankan palang pintu perlintasan secepatnya!' },
    { label: 'Selamat Bertugas', msg: 'PPKA: Selamat bertugas rekan masinis, patuhi batas kecepatan!' }
  ];

  const handleSendRadio = (txt: string) => {
    if (!txt.trim()) return;
    onSendChatMessage(txt, `${subRole} Zona ${selectedZone}`);
    setRadioMsg('');
  };

  const handlePlayBellAlert = () => {
    audio.playPJLBell(1.5);
  };

  // Untuk otoritas PPKA Stasiun, peta Leaflet di-teleport presisi ke KP stasiun tersebut.
  // Untuk PK, biarkan RealWorldMap pakai titik tengah zona (focusKp = undefined).
  const focusKp = ppkaAuthority.type === 'Station'
    ? STATIONS.find(s => s.id === ppkaAuthority.stationId)?.kp
    : undefined;
  const focusZone: 1 | 2 | 3 | 4 | undefined = ppkaAuthority.type === 'Station' ? ppkaAuthority.zone : undefined;

  // Filter signals, switches and PJLs based on selected traffic Zone
  const filteredSignals = signals.filter(s => s.zone === selectedZone);
  const filteredSwitches = switches.filter(w => w.zone === selectedZone);
  const filteredPjls = pjls.filter(p => p.zone === selectedZone);
  const zoneStations = STATIONS.filter(st => st.zone === selectedZone);

  if (!hasJoinedCtrlRoom) {
    return (
      <div className="bg-[#030611] min-h-screen text-slate-100 flex flex-col justify-center items-center py-10 px-4 relative overflow-hidden font-sans select-none">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-xl w-full bg-[#0a0f1d] border border-indigo-950/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-indigo-600/10 rounded-full text-indigo-400 border border-indigo-500/20 mb-3 animate-pulse">
              <Shield size={32} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase font-mono">REGISTRASI DINAS PPKA</h1>
            <p className="text-xs text-slate-450 mt-1 pb-4 border-b border-indigo-950/40">
              Sistem Pusat Kendali Otomatis (CTC) • Wilayah Daerah Operasi 1 Jakarta
            </p>
          </div>

          {/* Section 1: Otoritas Dinas (sudah dikunci dari gerbang penugasan) */}
          <div className="mb-6">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 font-mono">
              1. OTORITAS DINAS ANDA (TERKUNCI):
            </h3>
            <div className="p-4 rounded-xl border-2 border-indigo-500 bg-indigo-950/50 text-white shadow-lg flex flex-col gap-1">
              <span className="font-bold text-xs font-mono">
                {ppkaAuthority.type === 'PK'
                  ? `PK (Pusat Kendali) - Zona ${ppkaAuthority.zone}`
                  : `PPKA Stasiun ${STATIONS.find(s => s.id === ppkaAuthority.stationId)?.name || ppkaAuthority.stationId}`}
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                {ppkaAuthority.type === 'PK'
                  ? 'Anda berwenang mengatur seluruh sinyal/wesel/PJL di zona ini.'
                  : 'Anda hanya berwenang mengatur sinyal/wesel/PJL milik stasiun ini. Untuk mengganti otoritas, keluar dan masuk kembali ke dashboard PPKA.'}
              </p>
            </div>
          </div>
          <div className="mb-6 hidden">
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 1 as const, name: 'Sektor 1: Jakarta Kota - Manggarai', desc: 'Sangat Padat. Mengawasi rute utama KRL Commuter Line & stasiun transit.', level: 'KM 0.0 - KM 9.8' },
                { id: 2 as const, name: 'Sektor 2: Tebet - Pasar Minggu - Depok', desc: 'Kepadatan Sedang. Sektor penyangga dengan depot sarana langsir KRL.', level: 'KM 10.0 - KM 19.5' },
                { id: 3 as const, name: 'Sektor 3: Citayam - Bojong Gede - Bogor', desc: 'Kecepatan Tinggi. Sektor pegunungan dengan wesel curam ujung stasiun.', level: 'KM 20.0 - KM 54.8' },
                { id: 4 as const, name: 'Sektor 4: Cikarang Loop Line', desc: 'Sektor Baru Timur. Mengendalikan sirkuit Cikarang Loop Manggarai Timur.', level: 'KM 4.0 - KM 9.0' }
              ].map(zone => (
                <button
                  key={zone.id}
                  type="button"
                  disabled
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    selectedZone === zone.id
                      ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-lg'
                      : 'bg-[#0e1322] border-slate-900 text-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-xs font-mono">{zone.name}</span>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${selectedZone === zone.id ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-500'}`}>
                      {zone.level}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">{zone.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Role Selection */}
          <div className="mb-8">
            <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3 font-mono">
              2. PILIH JABATAN WEWENANG PPKA:
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'Dispatcher Terpusat', desc: 'Kontrol Penuh' },
                { name: 'Operator Sektor', desc: 'Wesel & Sinyal' },
                { name: 'Operator Stasiun', desc: 'Wesel Lokal' }
              ].map(role => (
                <button
                  key={role.name}
                  onClick={() => setSubRole(role.name)}
                  type="button"
                  className={`p-3 rounded-lg border text-center flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                    subRole === role.name
                      ? 'bg-cyan-950/40 border-cyan-500 text-white font-bold'
                      : 'bg-[#0e1322] border-slate-900 text-slate-400 hover:border-cyan-950/60 hover:text-slate-300'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono block leading-tight">{role.name.split(' ')[0]}</span>
                  <span className="text-[9px] font-medium block text-slate-400 font-mono italic">{role.name.split(' ')[1] || ''}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setHasJoinedCtrlRoom(true)}
            type="button"
            className="w-full bg-[#1caf7c] hover:bg-emerald-400 text-slate-950 font-sans font-black text-xs py-3.5 rounded-xl uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Play size={13} />
            <span>BUKA MEJA PELAYANAN CTC SEKARANG</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="ppka-dashboard" className="bg-[#080d1a] border-t-4 border-indigo-600 text-gray-100 min-h-screen p-4 flex flex-col font-sans select-none relative">
      
      {/* Floating Denial Toast Notifications */}
      {denialNotice && (
        <div className="fixed top-6 right-6 z-[99999] max-w-md bg-[#1c0c11] border-2 border-red-500/90 rounded-xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-md transition-all duration-300 transform translate-y-0 shadow-red-950/40">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5 animate-pulse" size={20} />
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-mono font-black text-red-500 leading-none">⚠️ OTORISASI DINAS PPKA DITOLAK</h4>
            <p className="text-xs text-red-200 mt-1.5 font-medium leading-relaxed">{denialNotice}</p>
          </div>
        </div>
      )}
      
      {/* Top CTC Control Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-indigo-950 pb-3 mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white font-black px-3 py-1 rounded text-sm tracking-wider uppercase">
            PPKA Control Room
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-indigo-400 font-mono">CTC CENTRALIZED TRAFFIC CONTROL</h1>
            <p className="text-xs text-slate-400 font-mono">Panel Pengendali Perjalanan Kereta Api • Rute Jakarta - Bogor</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <button
            id="btn-bell-alert"
            onClick={handlePlayBellAlert}
            className="bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded text-xs leading-none flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Radio size={14} className="animate-pulse" />
            <span>Kirim Bel PJL</span>
          </button>

          <button
            onClick={() => setShowRadioPanel(!showRadioPanel)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all uppercase flex items-center gap-1 cursor-pointer ${
              showRadioPanel 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-lg' 
                : 'bg-indigo-950 border border-indigo-800 text-indigo-300 hover:text-white'
            }`}
          >
            <Radio size={11} className={showRadioPanel ? 'animate-pulse' : ''} />
            <span>🎙️ ON-MIC</span>
          </button>

          <button
            id="btn-quit-ppka"
            onClick={onExit}
            className="bg-red-600 hover:bg-red-700 active:translate-y-0.5 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            Keluar Control Room
          </button>
        </div>
      </div>

      {/* Horizontal Status Summary & Brasi Toggle Block */}
      <div className="bg-[#0b101f] border border-indigo-950/80 rounded-xl p-3 mb-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left Side: Dinas Status Info */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-[#070b14] px-2.5 py-1.5 rounded border border-indigo-950">
            <span className="text-[10px] text-slate-500 font-mono uppercase font-black block">📍 Wilayah Sektor:</span>
            <span className="font-bold text-indigo-400 font-mono">
              {selectedZone === 1 ? 'Sektor 1 (Kota - Manggarai)' : selectedZone === 2 ? 'Sektor 2 (Tebet - Depok)' : 'Sektor 3 (Citayam - Bogor)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#070b14] px-2.5 py-1.5 rounded border border-indigo-950">
            <span className="text-[10px] text-slate-500 font-mono uppercase font-black block">👮 Dinas Jabatan:</span>
            <span className="font-bold text-cyan-400 font-mono">{subRole || 'PPKA Dinas'}</span>
          </div>

          <button
            onClick={() => setHasJoinedCtrlRoom(false)}
            className="px-2.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded font-mono font-bold text-[10px] hover:text-white transition-all cursor-pointer"
            title="Klik untuk memilih ulang wilayah sektor maupun jabatan"
          >
            Ubah Dinas Sektor
          </button>
        </div>

        {/* Right Side: Re-positioned Brasi Toggle Button */}
        <div className="w-full md:w-auto flex items-center justify-end">
          <button
            id="btn-toggle-brasi"
            onClick={() => {
              const nextBrasi = !isBrasiActive;
              setIsBrasiActive(nextBrasi);
              if (nextBrasi) {
                onSendChatMessage?.('⚠️ [REKAYASA LINTAS - BRASI]: PPKA mengaktifkan sistem Jalur Tunggal Sementara (Brasi) di lintas! Blok pengaman sepur dibebaskan.', 'PPKA');
                audio.playPJLBell(0.8);
              } else {
                onSendChatMessage?.('✅ [PENCABUTAN BRASI]: PPKA menonaktifkan sistem Jalur Tunggal Sementara. Jalur kembali ke rel ganda normal.', 'PPKA');
              }
            }}
            className={`w-full md:w-auto py-1.5 px-3 rounded font-mono font-black text-[10px] uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
              isBrasiActive 
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse shadow shadow-red-950/50' 
                : 'bg-slate-900 border border-slate-800 text-red-400 hover:bg-[#1a0f18]/30 hover:border-red-950'
            }`}
          >
            <Radio size={11} className={isBrasiActive ? 'animate-pulse' : ''} />
            <span>{isBrasiActive ? '🔴 BRASI JALUR TUNGGAL AKTIF' : '⚠️ AKTIFKAN BRASI (LINTAS TUNGGAL SELEKTIF)'}</span>
          </button>
        </div>

      </div>

      {/* Main Interactive Map & Dispatcher layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
             {/* CTC Synoptic Board Schematic Layout (SVG Graphic) */}
        <div className="lg:col-span-12 flex flex-col gap-4">
          <div className="bg-[#0b0f1a] rounded-xl border border-indigo-950/50 p-4 flex flex-col min-h-[350px] shadow-lg">
            <div className="flex justify-between items-center border-b border-indigo-950/40 pb-2 mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wide text-indigo-300 font-mono">MAIN SYNOPTIC MAP - ZONA {selectedZone}</span>
                {mapMode === 'schematic' && (
                  <span className="text-[10px] bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-900 text-indigo-400 font-mono select-none">
                    Skala: {Math.round(zoom * 100)}%
                  </span>
                )}
              </div>

              {/* MAP TYPE SELECTOR TABS */}
              <div className="flex items-center gap-1 p-0.5 bg-[#080d19] border border-indigo-950 rounded">
                <button
                  type="button"
                  onClick={() => setMapMode('leaflet')}
                  className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase cursor-pointer select-none transition-all active:scale-95 ${
                    mapMode === 'leaflet'
                      ? 'bg-indigo-600 text-white font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🗺️ Peta Dunia Nyata
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('schematic')}
                  className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase cursor-pointer select-none transition-all active:scale-95 ${
                    mapMode === 'schematic'
                      ? 'bg-indigo-600 text-white font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📉 Skematik Gapeka
                </button>
              </div>

              {mapMode === 'schematic' && (
                /* Dynamic Interactive Zoom & Pan Controls requested directly */
                <div className="flex items-center gap-1 font-mono">
                  <button
                    id="btn-zoom-out"
                    title="Perkecil Peta (Zoom Out)"
                    type="button"
                    onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
                    className="bg-[#12192e] hover:bg-slate-850 border border-slate-750 text-slate-300 font-black px-2 py-0.5 rounded text-xs active:scale-90 transition-transform"
                  >
                    -
                  </button>
                  <button
                    id="btn-zoom-reset"
                    title="Reset Posisi & Zoom"
                    type="button"
                    onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
                    className="bg-[#12192e] hover:bg-slate-850 border border-slate-755 text-indigo-400 font-bold px-2.5 py-0.5 rounded text-[10px] active:scale-90 transition-transform uppercase"
                  >
                    Reset
                  </button>
                  <button
                    id="btn-zoom-in"
                    title="Perbesar Peta (Zoom In)"
                    type="button"
                    onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
                    className="bg-[#12192e] hover:bg-slate-850 border border-slate-750 text-slate-300 font-black px-2 py-0.5 rounded text-xs active:scale-90 transition-transform"
                  >
                    +
                  </button>

                  <div className="h-4 w-px bg-indigo-950 mx-1" />

                  <div className="flex gap-2 items-center text-[9px] font-mono text-slate-400 select-none">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Sinyal Merah</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Sinyal Hijau</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-1 bg-amber-500" /> Wesel</span>
                  </div>
                </div>
              )}
            </div>

            {mapMode === 'schematic' ? (
              <div className="bg-[#060a14] rounded-lg border border-slate-900 p-2 flex-1 relative overflow-y-auto flex flex-col justify-start items-center min-h-[220px]">
                <GameCanvas
                  trains={activeTrains}
                  signals={signals}
                  switches={switches}
                  userRole="PPKA"
                  userStationId={selectedZone === 1 ? 'MRI' : selectedZone === 2 ? 'JAKK' : selectedZone === 3 ? 'DPK' : 'BOO'}
                  onSwitchToggle={(switchId, state) => {
                    const sw = switches?.find(w => w.id === switchId);
                    if (!sw) return;
                    if (!checkActionPermission('switch', sw)) return;
                    onToggleSwitch(switchId, state);
                  }}
                  onSignalToggle={(sigId) => {
                    const sig = signals.find(s => s.id === sigId);
                    if (!sig) return;
                    if (!checkActionPermission('signal', sig)) return;
                    let nextColor = SignalColor.Green;
                    if (sig.color === SignalColor.Green) nextColor = SignalColor.Yellow;
                    else if (sig.color === SignalColor.Yellow) nextColor = SignalColor.Red;
                    onToggleSignal(sig.id, nextColor);
                  }}
                />
              </div>
            ) : false ? (
              /* Schematic Board Display SVG */
              <div className="bg-[#060a14] rounded-lg border border-slate-900 p-2 flex-1 relative overflow-hidden flex items-center min-h-[220px]">
                
                {/* 5-second Train Detail Popup */}
                <AnimatePresence>
                  {clickedTrain && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1050] bg-[#090d16]/95 border-2 border-indigo-500/80 rounded-xl p-3 shadow-2xl flex flex-col gap-1.5 max-w-sm w-[90%] font-mono"
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="text-indigo-400 font-extrabold text-[9px] uppercase tracking-wider">Detail Pantauan Lintas KA</span>
                        <button onClick={() => setClickedTrain(null)} className="text-slate-500 hover:text-white font-bold text-xs leading-none">×</button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                        <div>
                          <span className="text-slate-500 block">ID KA:</span>
                          <span className="text-white font-bold">{clickedTrain.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">DINAS KA:</span>
                          <span className="text-white font-bold">{clickedTrain.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">MASINIS:</span>
                          <span className="text-emerald-400 font-bold">{clickedTrain.driverName || 'Autopilot AI'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">KECEPATAN:</span>
                          <span className="text-amber-400 font-bold">{Math.round(clickedTrain.speed)} km/h</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">POSISI (KP):</span>
                          <span className="text-cyan-400 font-bold">KM {clickedTrain.kp.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">LAYANAN:</span>
                          <span className="text-slate-350 font-bold">{clickedTrain.cargoType === 'Freight' ? 'Barang' : 'KRL Penumpang'}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900/50 rounded h-1 overflow-hidden mt-1">
                        <motion.div
                          key={clickedTrain.id}
                          initial={{ width: "100%" }}
                          animate={{ width: "0%" }}
                          transition={{ duration: 5, ease: "linear" }}
                          className="bg-indigo-500 h-full"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              
              <svg 
                className="w-full min-w-[700px] h-[180px] select-none" 
                viewBox="0 0 1000 180"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <g transform={`translate(${panX}, ${panY}) scale(${zoom})`} style={{ transformOrigin: '500px 90px' }} className="transition-transform duration-75 ease-out">
                  {/* Background tracks drawing (Mainline Hulu and Hilir tracks running right to left) */}
                  
                  {/* UP track (Hulu Line) */}
                  <path d={getTrackPath(60)} fill="none" stroke="#101827" strokeWidth="6" />
                  <path d={getTrackPath(60)} fill="none" stroke="#1d2d44" strokeWidth="2.5" strokeDasharray="5,2" />
                  <text x="30" y="32" fill="#475569" className="text-[10px] font-mono font-black uppercase">JALUR HULU (KE JAKARTA KOTA)</text>

                  {/* DOWN track (Hilir Line) */}
                  <path d={getTrackPath(120)} fill="none" stroke="#101827" strokeWidth="6" />
                  <path d={getTrackPath(120)} fill="none" stroke="#1d2d44" strokeWidth="2.5" strokeDasharray="5,2" />
                  <text x="30" y="153" fill="#475569" className="text-[10px] font-mono font-black uppercase">JALUR HILIR (KE BOGOR)</text>

                  {/* Draw stations in the current zone dynamically */}
                  {zoneStations.map((station, idx) => {
                    const percent = getXCoordinateFromKp(station.kp);
                    // Scaled position in SVG coordinate (0..1000 range)
                    const svgX = (percent / 100) * 900 + 50;
                    const trHuluY = getTrackY(station.kp, 60);
                    const trHilirY = getTrackY(station.kp, 120);
                    const stationCenterY = (trHuluY + trHilirY) / 2;
                    
                    return (
                      <g key={station.id} className="cursor-help">
                        {/* Station Peron Box outline */}
                        <rect x={svgX - 35} y={trHuluY - 20} width="70" height={trHilirY - trHuluY + 40} fill="#111827" stroke="#312e81" strokeWidth="1.5" rx="3" className="opacity-25" />
                        
                        {/* Station Line Anchor */}
                        <circle cx={svgX} cy={stationCenterY} r="4" fill="#6366f1" className="animate-pulse" />
                        
                        {/* Labels */}
                        <text x={svgX} y={trHuluY - 25} fill="#e2e8f0" textAnchor="middle" className="text-xs font-mono font-black uppercase">{station.name}</text>
                        <text x={svgX} y={trHilirY + 30} fill="#f59e0b" textAnchor="middle" className="text-[9px] font-mono leading-none">KM {station.kp.toFixed(2)}</text>
                      </g>
                    );
                  })}

                  {/* Interactive Dynamic Switches (Wesel) */}
                  {filteredSwitches.map((sw) => {
                    const percent = getXCoordinateFromKp(sw.kp);
                    const svgX = (percent / 100) * 900 + 50;
                    const baseY = sw.direction === LineDirection.Hilir ? 120 : 60;
                    const swY = getTrackY(sw.kp, baseY);
                    
                    const offsetDirectionSign = sw.direction === LineDirection.Hilir ? -1 : 1;
                    const lineX1 = svgX - 20;
                    const lineY1 = getTrackY(sw.kp - 0.4, baseY);
                    const lineX2 = svgX + 20;
                    const lineY2 = getTrackY(sw.kp + 0.4, baseY);
                    
                    const divEndKP = sw.kp + 0.5;
                    const divEndX = (getXCoordinateFromKp(divEndKP) / 100) * 900 + 50;
                    const divEndY = getTrackY(divEndKP, baseY) + (offsetDirectionSign * 20);
                    
                    return (
                      <g key={sw.id} className="cursor-pointer" onClick={() => {
                        if (!checkActionPermission('switch', sw)) return;
                        const nextState = sw.state === 'straight' ? 'diverging' : 'straight';
                        onToggleSwitch(sw.id, nextState);
                      }}>
                        {/* Straight Switch indicator line */}
                        <line 
                          x1={lineX1} 
                          y1={lineY1} 
                          x2={lineX2} 
                          y2={lineY2} 
                          stroke={sw.state === 'straight' ? '#10b981' : '#f59e0b'} 
                          strokeWidth="3.5" 
                        />
                        
                        {/* Diverging fork representation */}
                        <path 
                          d={`M ${lineX1.toFixed(1)} ${lineY1.toFixed(1)} Q ${svgX.toFixed(1)} ${swY.toFixed(1)} ${divEndX.toFixed(1)} ${divEndY.toFixed(1)}`}
                          fill="none" 
                          stroke={sw.state === 'diverging' ? '#10b981' : '#f59e0b'} 
                          strokeWidth="3" 
                          strokeDasharray="4,2"
                        />

                        <circle cx={svgX} cy={swY} r="5" fill="#f59e0b" stroke="#000" strokeWidth="1.5" />
                        <text x={svgX} y={swY + (offsetDirectionSign * 15)} fill="#fbbf24" textAnchor="middle" className="text-[8px] font-mono font-bold">{sw.id.split('-').pop()}</text>
                      </g>
                    );
                  })}

                  {/* Signal Indicators */}
                  {filteredSignals.map(sig => {
                    const percent = getXCoordinateFromKp(sig.kp);
                    const svgX = (percent / 100) * 900 + 50;
                    const baseY = sig.direction === LineDirection.Hilir ? 120 : 60;
                    const trY = getTrackY(sig.kp, baseY);
                    
                    const offsetSign = sig.direction === LineDirection.Hilir ? -1 : 1;
                    const sigY = trY - (offsetSign * 20);

                    return (
                      <g key={sig.id} className="cursor-pointer" onClick={() => {
                        if (!checkActionPermission('signal', sig)) return;
                        // Cycle color on click: Red -> Yellow -> Green
                        let nextColor = SignalColor.Green;
                        if (sig.color === SignalColor.Green) nextColor = SignalColor.Yellow;
                        else if (sig.color === SignalColor.Yellow) nextColor = SignalColor.Red;
                        onToggleSignal(sig.id, nextColor);
                      }}>
                        {/* Post */}
                        <line x1={svgX} y1={sigY} x2={svgX} y2={trY} stroke="#94a3b8" strokeWidth="1.5" />
                        
                        {/* Light outline */}
                        <circle cx={svgX} cy={sigY} r="7" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
                        <circle 
                          cx={svgX} 
                          cy={sigY} 
                          r="5.5" 
                          fill={
                            sig.color === SignalColor.Red ? '#ef4444' :
                            sig.color === SignalColor.Yellow ? '#fbbf24' :
                            '#10b981'
                          } 
                          className="animate-pulse"
                        />
                        <text x={svgX + 8} y={sigY + 3} fill="#94a3b8" className="text-[8px] font-mono font-bold">{sig.id.replace('S-', '')}</text>
                      </g>
                    );
                  })}

                  {/* Level Crossing PJLs */}
                  {filteredPjls.map(p => {
                    const percent = getXCoordinateFromKp(p.kp);
                    const svgX = (percent / 100) * 900 + 50;
                    const trHuluY = getTrackY(p.kp, 60);
                    const trHilirY = getTrackY(p.kp, 120);
                    const centerBoundaryY = (trHuluY + trHilirY) / 2;

                    return (
                      <g key={p.id} className="cursor-pointer" onClick={() => {
                        if (!checkActionPermission('pjl', p)) return;
                        onTogglePJL(p.id, !p.isClosed);
                      }}>
                        {/* Vertical road block */}
                        <line x1={svgX} y1={trHuluY - 40} x2={svgX} y2={trHilirY + 40} stroke="#334155" strokeWidth="5" opacity="0.45" />
                        {/* Closed / Open barriers draws */}
                        <line 
                          x1={svgX - 10} 
                          y1={centerBoundaryY} 
                          x2={svgX + 10} 
                          y2={centerBoundaryY} 
                          stroke={p.isClosed ? '#10b981' : '#ef4444'} 
                          strokeWidth="3.5" 
                        />
                        <circle cx={svgX} cy={centerBoundaryY} r="4.5" fill="#1e293b" />
                        <text x={svgX - 12} y={centerBoundaryY - 7} fill={p.isClosed ? '#34d399' : '#f87171'} className="text-[7px] font-mono font-bold uppercase">{p.isClosed ? 'Aman' : 'Tutup PJL'}</text>
                      </g>
                    );
                  })}

                  {/* Render live Trains crawl */}
                  {activeTrains.map(tr => {
                    const percent = getXCoordinateFromKp(tr.kp);
                    const svgX = (percent / 100) * 900 + 50;
                    const trYBase = tr.direction === LineDirection.Hilir ? 120 : 60;
                    const trY = getTrackY(tr.kp, trYBase);
 
                     if (tr.hasCollided) {
                       return (
                         <g key={tr.id} className="cursor-pointer" onClick={() => handleTrainClick(tr)}>
                           <text x={svgX} y={trY + 5} fill="#ef4444" textAnchor="middle" className="text-lg font-black tracking-tighter">💥</text>
                           <text x={svgX} y={trY - 14} fill="#ef4444" textAnchor="middle" className="text-[8px] font-mono font-bold uppercase">TABRAKAN</text>
                         </g>
                       );
                     }
 
                     // Draw coupled train!
                     const isHilir = tr.direction === LineDirection.Hilir;
                     const getCarCount = (type: TrainType) => {
                       if (type === TrainType.Langsir) return 3;
                       if (type === TrainType.KRL_8) return 8;
                       if (type === TrainType.KRL_12) return 12;
                       if (type === TrainType.CC201) return 6;
                       if (type === TrainType.CC206) return 8;
                       return 4;
                     };
                     const carCount = getCarCount(tr.type);
                     const offsetSpacing = 22;
                     const coachOffsets = Array.from({ length: carCount }).map((_, idx) => {
                       return isHilir ? -idx * offsetSpacing : idx * offsetSpacing;
                     });
                     const trainColor = tr.isAI ? '#334155' : '#ea580c';
                     const strokeColor = tr.isAI ? '#475569' : '#f97316';
                     const coachColor = tr.isAI ? '#1e293b' : '#1e3a8a';
                     const coachStroke = tr.isAI ? '#334155' : '#3b82f6';
 
                     return (
                       <g key={tr.id} className="cursor-pointer" onClick={() => handleTrainClick(tr)}>
                         {/* Coupler linking lines */}
                         {coachOffsets.slice(1).map((offset, index) => {
                           const prevOffset = coachOffsets[index];
                           
                           const carKp1 = tr.kp + (prevOffset / 900) * 55.0;
                           const carKp2 = tr.kp + (offset / 900) * 55.0;
                           
                           const lineX1 = (getXCoordinateFromKp(carKp1) / 100) * 900 + 50;
                           const lineY1 = getTrackY(carKp1, trYBase);
                           
                           const lineX2 = (getXCoordinateFromKp(carKp2) / 100) * 900 + 50;
                           const lineY2 = getTrackY(carKp2, trYBase);
                           
                           return (
                             <line
                               key={index}
                               x1={lineX1}
                               y1={lineY1}
                               x2={lineX2}
                               y2={lineY2}
                               stroke="#64748b"
                               strokeWidth="1.5"
                             />
                           );
                         })}
 
                         {/* Render individual coupled cars */}
                         {coachOffsets.map((offset, idx) => {
                           const carKp = tr.kp + (offset / 900) * 55.0;
                           const carX = (getXCoordinateFromKp(carKp) / 100) * 900 + 50;
                           const carY = getTrackY(carKp, trYBase);
                           const isLoco = idx === 0 || ((tr.type === TrainType.KRL_8 || tr.type === TrainType.KRL_12) && idx === carCount - 1);
 
                           return (
                             <g key={idx}>
                               {/* Pure Sprite Image rendering without weird wheels or vectors */}
                               <image
                                 href={(() => {
                                   if (tr.type === TrainType.CC201) return idx === 0 ? '/CC 201.png' : '/Gerbong KAJJ.png';
                                   if (tr.type === TrainType.CC206) return idx === 0 ? '/CC 206.png' : '/Gerbong KAJJ.png';
                                   if (tr.type === TrainType.KRL_8 || tr.type === TrainType.KRL_12) return (idx === 0 || idx === carCount - 1) ? '/KRL JR 205.png' : '/Gerbong KRL.png';
                                   if (tr.type === TrainType.Langsir) return idx === 0 ? '/CC 201.png' : '/Gerbong KRL.png';
                                   return idx === 0 ? '/CC 206.png' : '/Gerbong KAJJ.png';
                                 })()}
                                 x={carX - 11}
                                 y={carY - 11}
                                 width="22"
                                 height="22"
                                 transform={`rotate(${isHilir ? 90 : -90}, ${carX}, ${carY})`}
                                 referrerPolicy="no-referrer"
                               />
                               {/* Details are pre-rendered in high quality in the PNG sprite */}
 
                               {/* Roda tidak perlu digambar manual, sudah menyatu dengan sprite */}
                             </g>
                           );
                         })}
 
                         {/* Glowing active headlight on head car */}
                         <circle cx={isHilir ? svgX + 9 : svgX - 9} cy={trY} r="1.5" fill="#fde047" />
                         <circle cx={isHilir ? svgX + 9 : svgX - 9} cy={trY} r="3" fill="#fde047" opacity="0.3" className="animate-ping" />
                         
                         {/* Live Speed labels */}
                         <text x={svgX - 30} y={trY - 10} fill="#ff7849" textAnchor="start" className="text-[8px] font-mono font-bold leading-none">
                           {tr.isAI ? 'AI' : tr.driverName || 'USER'}: {Math.round(tr.speed)} km/h
                         </text>
                         <text x={svgX - 30} y={trY + 16} fill="#94a3b8" textAnchor="start" className="text-[7.5px] font-mono leading-none">
                           {tr.name} {isHilir ? '▶' : '◀'}
                         </text>
                       </g>
                     );
                   })}
                </g>
              </svg>

            </div>
            ) : (
              <RealWorldMap
                trains={activeTrains}
                signals={signals}
                pjls={pjls}
                switches={switches}
                selectedZone={selectedZone}
                focusKp={focusKp}
                focusZone={focusZone}
                onSignalToggle={(sigId) => {
                  const sig = signals.find(s => s.id === sigId);
                  if (!sig) return;
                  if (!checkActionPermission('signal', sig)) return;
                  let nextColor = SignalColor.Green;
                  if (sig.color === SignalColor.Green) nextColor = SignalColor.Yellow;
                  else if (sig.color === SignalColor.Yellow) nextColor = SignalColor.Red;
                  onToggleSignal(sig.id, nextColor);
                }}
                onPjlToggle={(pjlId) => {
                  const p = pjls.find(item => item.id === pjlId);
                  if (!p) return;
                  if (!checkActionPermission('pjl', p)) return;
                  onTogglePJL(p.id, !p.isClosed);
                }}
                onSwitchToggle={(switchId, state) => {
                  const sw = switches?.find(w => w.id === switchId);
                  if (!sw) return;
                  if (!checkActionPermission('switch', sw)) return;
                  onToggleSwitch(switchId, state);
                }}
              />
            )}

            {/* Quick action buttons description */}
            <div className="bg-[#12192c] rounded-lg p-3 border border-indigo-950/40 text-[9px] text-slate-400 font-mono">
              <span className="text-amber-500 font-bold block mb-1">PETUNJUK OPERASI UTAMA:</span>
              - Klik <strong className="text-white">BULAN SINYAL</strong> pada peta synoptic untuk menyiklus aspek cahaya (MERAH ➔ KUNING ➔ HIJAU).<br/>
              - Klik <strong className="text-white">LINGKARAN WESEL (ORANGE)</strong> untuk mengalihkan persimpangan sepur lurus vs sepur belok.<br/>
              - Klik <strong className="text-white">BARIS TRANSISTOR PJL</strong> untuk melarang kendaraan menyeberang saat kereta hendak melintas.
            </div>

          </div>

          {/* Sektor Live Board Log - Tabbed Area */}
          <div className="bg-[#0f1526] rounded-xl border border-indigo-950/60 p-4">
            
            {/* Header Tabs Navigation */}
            <div className="flex items-center justify-between border-b border-indigo-950/50 pb-3 mb-3 gap-2 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                <button
                  id="tab-ctc-service"
                  onClick={() => setBottomTab?.('ctc')}
                  className={`px-3 py-1.5 rounded font-mono font-bold text-[10px] tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer ${
                    bottomTab === 'ctc'
                      ? 'bg-indigo-600 text-white font-black'
                      : 'bg-[#12192e] text-slate-440 border border-slate-800'
                  }`}
                >
                  <RefreshCw size={11} className={bottomTab === 'ctc' ? 'animate-spin-slow' : ''} />
                  <span>1. Meja Pelayanan CTC Stasiun</span>
                </button>
                <button
                  id="tab-trains-list"
                  onClick={() => setBottomTab?.('trains')}
                  className={`px-3 py-1.5 rounded font-mono font-bold text-[10px] tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer ${
                    bottomTab === 'trains'
                      ? 'bg-indigo-600 text-white font-black'
                      : 'bg-[#12192e] text-slate-440 border border-slate-800'
                  }`}
                >
                  <Activity size={11} />
                  <span>2. Daftar Perjalanan KA</span>
                </button>
                <button
                  id="tab-radio-feed"
                  onClick={() => setBottomTab?.('radio')}
                  className={`px-3 py-1.5 rounded font-mono font-bold text-[10px] tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer ${
                    bottomTab === 'radio'
                      ? 'bg-amber-600 text-white font-bold border border-amber-600'
                      : 'bg-[#12192e] text-slate-440 border border-slate-800'
                  }`}
                >
                  <Radio size={11} className={bottomTab === 'radio' ? 'animate-pulse text-amber-400' : ''} />
                  <span>3. Radio Warta Masinis-PPKA</span>
                </button>
              </div>

              <span className="text-[9px] text-indigo-400 font-mono bg-[#0c101d] px-2 py-0.5 rounded border border-indigo-950/30">
                Pusat Kendali Operasi Sektor {selectedZone}
              </span>
            </div>

            {/* TAB CONTENT: STATION-GROUPED CTC CONTROL DESK */}
            {bottomTab === 'ctc' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {zoneStations.map((st) => {
                  const stationSignals = signals.filter(sig => sig.id.includes(`-${st.id}-`) || sig.id.startsWith(`S-${st.id}-`));
                  const stationSwitches = switches.filter(sw => sw.stationId === st.id);
                  const stationPjls = pjls.filter(p => p.id.includes(`-${st.id}-`));

                  return (
                    <div key={st.id} className="bg-[#12192e] border border-indigo-950/55 rounded-lg p-3 flex flex-col justify-between shadow">
                      
                      {/* Station header info block */}
                      <div className="border-b border-indigo-950/40 pb-1.5 mb-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-black text-xs uppercase tracking-wider">{st.name}</h4>
                          <span className="text-[8px] font-mono bg-[#080d1a] text-cyan-400 px-1 py-0.5 rounded font-bold">KM {st.kp.toFixed(1)}</span>
                        </div>
                        <span className="text-[7.5px] text-slate-500 font-mono italic block mt-0.5">Sektor Operasional {st.id} ({st.tracks.length} Jalur)</span>
                      </div>

                      {/* Element Service Blocks */}
                      <div className="flex flex-col gap-2.5 flex-1">
                        
                        {/* 1. Switch Wesel Control Cards */}
                        {stationSwitches.length > 0 && (
                          <div className="bg-[#090d16] p-2 rounded border border-indigo-950/30">
                            <span className="text-[8px] text-slate-450 font-bold uppercase tracking-wide block mb-1 font-mono">🔀 Pelayanan Wesel / Crossover:</span>
                            <div className="flex flex-col gap-1.5">
                              {stationSwitches.map((sw) => {
                                const isStraight = sw.state === 'straight';
                                return (
                                  <div key={sw.id} className="flex items-center justify-between gap-1.5 py-0.5">
                                    <span className="text-[9px] font-mono font-bold text-amber-500">W-${sw.id.split('-').pop()}</span>
                                    <div className="flex gap-1">
                                      <button
                                        id={`btn-${sw.id}-str`}
                                        onClick={() => {
                                          if (!checkActionPermission('switch', sw)) return;
                                          onToggleSwitch(sw.id, 'straight');
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-all uppercase cursor-pointer ${
                                          isStraight
                                            ? 'bg-emerald-950 border border-emerald-500 text-emerald-400 font-black'
                                            : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-400'
                                        }`}
                                      >
                                        Lurus
                                      </button>
                                      <button
                                        id={`btn-${sw.id}-div`}
                                        onClick={() => {
                                          if (!checkActionPermission('switch', sw)) return;
                                          onToggleSwitch(sw.id, 'diverging');
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-all uppercase cursor-pointer ${
                                          !isStraight
                                            ? 'bg-amber-950 border border-amber-500 text-amber-400 font-black'
                                            : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-400'
                                        }`}
                                      >
                                        Belok
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. Signals Control Badge */}
                        {stationSignals.length > 0 && (
                          <div className="bg-[#090d16] p-2 rounded border border-indigo-950/30">
                            <span className="text-[8px] text-slate-450 font-bold uppercase tracking-wide block mb-1 font-mono">🚦 Aspek Sinyal / Semaphor:</span>
                            <div className="flex flex-col gap-1.5">
                              {stationSignals.map((sig) => {
                                return (
                                  <div key={sig.id} className="flex items-center justify-between gap-1.5 py-0.5">
                                    <span className="text-[8px] font-mono text-slate-400 tracking-tighter truncate max-w-[95px]" title={sig.id}>
                                      S-${sig.id.split('-').slice(2).join('-') || sig.id.replace('S-', '')}
                                    </span>
                                    <div className="flex gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800">
                                      {/* Red Aspect */}
                                      <button
                                        onClick={() => {
                                          if (!checkActionPermission('signal', sig)) return;
                                          onToggleSignal(sig.id, SignalColor.Red);
                                        }}
                                        className={`w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                                          sig.color === SignalColor.Red
                                            ? 'bg-red-500 shadow-md shadow-red-500/50 scale-110 border border-white/20'
                                            : 'bg-red-950 opacity-40 hover:opacity-75'
                                        }`}
                                        title="Sinyal Tahan (Red)"
                                      />
                                      {/* Yellow Aspect */}
                                      <button
                                        onClick={() => {
                                          if (!checkActionPermission('signal', sig)) return;
                                          onToggleSignal(sig.id, SignalColor.Yellow);
                                        }}
                                        className={`w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                                          sig.color === SignalColor.Yellow
                                            ? 'bg-yellow-500 shadow-md shadow-yellow-500/50 scale-110 border border-white/20'
                                            : 'bg-amber-950 opacity-40 hover:opacity-75'
                                        }`}
                                        title="Sering Berhati-Hati (Yellow)"
                                      />
                                      {/* Green Aspect */}
                                      <button
                                        onClick={() => {
                                          if (!checkActionPermission('signal', sig)) return;
                                          onToggleSignal(sig.id, SignalColor.Green);
                                        }}
                                        className={`w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                                          sig.color === SignalColor.Green
                                            ? 'bg-emerald-500 shadow-md shadow-emerald-500/50 scale-110 border border-white/20'
                                            : 'bg-emerald-950 opacity-40 hover:opacity-75'
                                        }`}
                                        title="Lintas Bebas Aman (Green)"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. PJL Crossing Doors */}
                        {stationPjls.length > 0 && (
                          <div className="bg-[#090d16] p-2 rounded border border-indigo-950/30">
                            <span className="text-[8px] text-slate-450 font-bold uppercase tracking-wide block mb-1 font-mono">🚧 Perlintasan Sebidang PJL:</span>
                            <div className="flex flex-col gap-1">
                              {stationPjls.map((p) => {
                                return (
                                  <div key={p.id} className="flex items-center justify-between gap-1">
                                    <span className="text-[7.5px] font-mono text-slate-400 block truncate max-w-[100px]">{p.name.replace(/\(.*\)/, '')}</span>
                                    <button
                                      id={`btn-pjl-toggle-${p.id}`}
                                      onClick={() => {
                                        if (!checkActionPermission('pjl', p)) return;
                                        onTogglePJL(p.id, !p.isClosed);
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold transition-all uppercase cursor-pointer ${
                                        p.isClosed
                                          ? 'bg-slate-900 border border-emerald-600/40 text-emerald-400'
                                          : 'bg-red-950 border border-red-500 text-red-400 animate-pulse font-black'
                                      }`}
                                    >
                                      {p.isClosed ? 'Tutup (Aman)' : 'Buka (Rawan!)'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              /* TAB CONTENT: TRAVELING TRAINS LIST (GDR SEKTOR) */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-indigo-950 font-bold text-indigo-400">
                      <th className="pb-2">ID KA</th>
                      <th className="pb-2">Nama Rangkaian</th>
                      <th className="pb-2">Jenis</th>
                      <th className="pb-2">Kemudi</th>
                      <th className="pb-2 text-center">KM Lintas</th>
                      <th className="pb-2 text-right">Kecepatan</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-950/30">
                    {activeTrains.map(tr => (
                      <tr key={tr.id} className={tr.hasCollided ? 'text-red-400' : 'text-slate-300'}>
                        <td className="py-2.5 font-bold text-amber-500">{tr.id}</td>
                        <td className="py-2.5 text-white">{tr.name}</td>
                        <td className="py-2.5 opacity-80">{tr.type}</td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${tr.isAI ? 'bg-slate-800 text-slate-400' : 'bg-orange-950 text-orange-400'}`}>
                            {tr.isAI ? 'AI' : tr.driverName || 'Pemain'}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-bold text-cyan-400">KM {tr.kp.toFixed(3)}</td>
                        <td className="py-2.5 text-right text-emerald-400 font-black">{Math.round(tr.speed)} KM/H</td>
                        <td className="py-2.5 text-right font-bold">
                          {tr.hasCollided ? '💥 TABRAKAN' : tr.speed === 0 ? '🅿️ Berhenti' : '🚂 Melaju'}
                        </td>
                      </tr>
                    ))}
                    {activeTrains.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-500">Tidak ada lalu lintas sarana kereta berjalan saat ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: RADIO COMMUNICATIONS CHANNEL */}
            {bottomTab === 'radio' && (
              <VhfRadioDinas
                role="PPKA"
                username={career.username}
                onSendChatMessage={onSendChatMessage}
                selectedZone={selectedZone}
              />
            )}

          </div>

        {/* ON-MIC VHF RADIO SLIDING DRAWER PANEL */}
        <AnimatePresence>
          {showRadioPanel && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-14 bottom-2 w-64 md:w-72 z-[1050] bg-[#050914]/98 backdrop-blur-lg border-r border-slate-800/80 p-3 md:p-3.5 rounded-r-lg shadow-2xl flex flex-col gap-3 pointer-events-auto"
            >
              <div className="flex justify-between items-center border-b border-indigo-950/45 pb-2">
                <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase font-mono flex items-center gap-1">
                  🎙️ KOMUNIKASI ON-MIC
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
                  activeTrain={{
                    id: `PPKA-${career.username}`,
                    name: ppkaAuthority.type === 'Station'
                      ? `PPKA Stasiun ${STATIONS.find(s => s.id === ppkaAuthority.stationId)?.name || ppkaAuthority.stationId}`
                      : `PK Zona ${ppkaAuthority.zone}`,
                    type: TrainType.Langsir,
                    // Posisi anchor radio mengikuti otoritas sungguhan (bukan hardcode KM 9.5 seperti
                    // sebelumnya), supaya deteksi jarak 5km terhadap masinis/PPKA/teknisi lain akurat.
                    kp: ppkaAuthority.type === 'Station'
                      ? (STATIONS.find(s => s.id === ppkaAuthority.stationId)?.kp ?? 9.5)
                      : (zoneStations.length ? zoneStations[Math.floor(zoneStations.length / 2)].kp : 9.5),
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
                  senderId={senderId}
                />
                <VhfRadioDinas
                  role="PPKA"
                  username={career.username}
                  onSendChatMessage={onSendChatMessage}
                  selectedZone={selectedZone}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>

  </div>
  );
}
