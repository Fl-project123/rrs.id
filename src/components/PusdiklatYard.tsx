import React, { useState, useEffect, useRef } from 'react';
import { Train, SignalBlock, SignalColor, LineDirection, UserCareer, CareerRank, TrainType } from '../types';
import { updateTrainPhysics } from '../utils/engine';
import { audio } from './AudioEngine';
import { calculateDistance } from '../utils/sync';
import { getLatLngFromKp } from '../data/tracks';
import { Award, ShieldCheck, AlertCircle, RefreshCw, Volume2, Key, Wrench, Shield, Play, HelpCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';

interface PusdiklatYardProps {
  career: UserCareer;
  onGrantLicense: (updatedCareer: UserCareer) => void;
  onExit: () => void;
  activeTrains: Train[];
  onSpawnAITrain: (name: string, type: TrainType, direction: LineDirection, kp: number) => void;
  onClearAllTrains: () => void;
}

type TrainingTab = 'masinis' | 'ppka' | 'teknisi';

function getTrainingLatLng(kp: number): [number, number] {
  // Offline-specific training grounds coordinate starting near Manggarai (Jakarta-like)
  const baseLat = -6.150;
  const baseLng = 106.820;
  const latOffset = -0.01 * (kp - 1.0); // 1 km is -0.01 latitude change
  const lngOffset = 0.001 * Math.sin(kp * 2); // subtle snake curve
  return [baseLat + latOffset, baseLng + lngOffset];
}

export default function PusdiklatYard({
  career,
  onGrantLicense,
  onExit,
  activeTrains,
  onSpawnAITrain,
  onClearAllTrains
}: PusdiklatYardProps) {
  const [activeTab, setActiveTab] = useState<TrainingTab>('masinis');

  // Leaflet map refs
  const localMapRef = useRef<L.Map | null>(null);
  const localMapContainerRef = useRef<HTMLDivElement>(null);
  const trainMarkerRef = useRef<L.Marker | null>(null);
  const signalMarkerRef = useRef<L.Marker | null>(null);
  const collisionMarkerRef = useRef<L.Marker | null>(null);
  const ppkaTrainMarkersRef = useRef<Record<string, L.Marker>>({});

  // Clean Leaflet marker caches
  const cleanLocalMarkers = () => {
    if (trainMarkerRef.current) {
      trainMarkerRef.current.remove();
      trainMarkerRef.current = null;
    }
    if (signalMarkerRef.current) {
      signalMarkerRef.current.remove();
      signalMarkerRef.current = null;
    }
    if (collisionMarkerRef.current) {
      collisionMarkerRef.current.remove();
      collisionMarkerRef.current = null;
    }
    Object.values(ppkaTrainMarkersRef.current).forEach((m: any) => m.remove());
    ppkaTrainMarkersRef.current = {};
  };

  // ==========================================
  // 1. STATE FOR MASINIS EXAM
  // ==========================================
  const [masinisState, setMasinisState] = useState<'idle' | 'running' | 'failed' | 'success'>('idle');
  const [masinisPoints, setMasinisPoints] = useState<number>(100);
  const [masinisLogs, setMasinisLogs] = useState<string[]>([]);
  const [masinisSignalColor, setMasinisSignalColor] = useState<SignalColor>(SignalColor.Red);
  const [masinisS35Played, setMasinisS35Played] = useState(false);
  const [pjlHornDeducted, setPjlHornDeducted] = useState(false);
  const [masinisSpeedLimit, setMasinisSpeedLimit] = useState(50); // Speed Limit is 50 km/h

  const [masinisTrain, setMasinisTrain] = useState<Train>({
    id: 'TRAINER-CC201',
    name: 'CC 201 Pusdiklat Trainer',
    type: 'CC201' as any,
    isAI: false,
    driverName: 'Siswa Masinis',
    direction: LineDirection.Hilir,
    kp: 1.0, // starts at Stasiun Latihan A
    speed: 0,
    maxSpeed: 50,
    targetSpeedLimit: 50,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'N',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Latihan-Track',
    cargoType: 'Maintenance',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  });

  // ==========================================
  // 2. STATE FOR PPKA EXAM
  // ==========================================
  const [ppkaState, setPpkaState] = useState<'idle' | 'running' | 'failed' | 'success'>('idle');
  const [ppkaPoints, setPpkaPoints] = useState<number>(100);
  const [ppkaLogs, setPpkaLogs] = useState<string[]>([]);
  const [ppkaTimer, setPpkaTimer] = useState<number>(0);

  // PPKA Switches and Signals
  const [ppkaWesel1, setPpkaWesel1] = useState<'straight' | 'diverging'>('straight'); // KM 1.4
  const [ppkaWesel2, setPpkaWesel2] = useState<'straight' | 'diverging'>('straight'); // KM 2.8
  const [ppkaSignal1, setPpkaSignal1] = useState<SignalColor>(SignalColor.Red); // KM 1.3 (S-LATIHAN-03)
  const [ppkaSignal2, setPpkaSignal2] = useState<SignalColor>(SignalColor.Red); // KM 2.9 (S-LATIHAN-04)
  const [ppkaPjlClosed, setPpkaPjlClosed] = useState<boolean>(true); // local training track PJL at KM 2.0

  // 3 Simulated AI Trains for PPKA single track meeting
  const [ppkaTrains, setPpkaTrains] = useState<Array<{ id: string; name: string; kp: number; speed: number; direction: LineDirection; finished: boolean; stopTime: number; status: string }>>([
    { id: 'KA-AI-1', name: 'KA 1 Argo Latih (Hilir)', kp: 1.0, speed: 0, direction: LineDirection.Hilir, finished: false, stopTime: 0, status: 'SIAP' },
    { id: 'KA-AI-2', name: 'KA 2 Argo Latih (Hulu)', kp: 4.0, speed: 0, direction: LineDirection.Hulu, finished: false, stopTime: 0, status: 'SIAP' },
    { id: 'KA-AI-3', name: 'KA 3 Lokal Latih (Hilir)', kp: 1.0, speed: 0, direction: LineDirection.Hilir, finished: false, stopTime: 0, status: 'SIAP' }
  ]);

  // ==========================================
  // 3. STATE FOR TEKNISI EXAM (RESCUE)
  // ==========================================
  const [teknisiState, setTeknisiState] = useState<'idle' | 'running' | 'coupled' | 'failed' | 'success'>('idle');
  const [teknisiPoints, setTeknisiPoints] = useState<number>(100);
  const [teknisiLogs, setTeknisiLogs] = useState<string[]>([]);
  const [teknisiStartTime, setTeknisiStartTime] = useState<number>(0);
  const [teknisiLori, setTeknisiLori] = useState<Train>({
    id: 'RESCUE-LRT01',
    name: 'NR Rescue Lori LRT-01',
    type: 'Langsir' as any,
    isAI: false,
    driverName: 'Siswa Teknisi',
    direction: LineDirection.Hilir,
    kp: 0.20, // spawns clean at Depot Latihan (KM 0.20)
    speed: 0,
    maxSpeed: 45,
    targetSpeedLimit: 45,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'N',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Latihan-Track',
    cargoType: 'Maintenance',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  });

  const [towingSpeedLimit, setTowingSpeedLimit] = useState(30); // 30 km/h towing limit

  // ==========================================
  // LEAFLET MAP LIFECYCLE
  // ==========================================
  useEffect(() => {
    if (!localMapContainerRef.current) return;

    // Remove any stale Leaflet Map instance
    if (localMapRef.current) {
      localMapRef.current.remove();
      localMapRef.current = null;
    }

    // Centered around the training grounds (KM 2.50 center coord)
    const map = L.map(localMapContainerRef.current, {
      center: getTrainingLatLng(2.5),
      zoom: 14,
      zoomControl: true,
      maxZoom: 18,
      minZoom: 12
    });

    // Dark high contrast tile layers
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(map);

    localMapRef.current = map;

    // Draw static local track layout
    const trackPoints: [number, number][] = [];
    for (let kp = 0.2; kp <= 4.2; kp += 0.05) {
      trackPoints.push(getTrainingLatLng(kp));
    }

    // Main single track (Blue)
    L.polyline(trackPoints, { color: '#3182ce', weight: 6, opacity: 0.9 }).addTo(map);

    // Siding Loop 1 at KM 1.4 (Yellow dashed alternate)
    const sidingPoints1: [number, number][] = [];
    for (let kp = 1.25; kp <= 1.55; kp += 0.05) {
      const [lat, lng] = getTrainingLatLng(kp);
      sidingPoints1.push([lat, lng + 0.0018]);
    }
    L.polyline(sidingPoints1, { color: '#dd6b20', weight: 4, opacity: 0.7, dashArray: '5,5' }).addTo(map);

    // Siding Loop 2 at KM 2.8 (Green dashed alternate)
    const sidingPoints2: [number, number][] = [];
    for (let kp = 2.65; kp <= 2.95; kp += 0.05) {
      const [lat, lng] = getTrainingLatLng(kp);
      sidingPoints2.push([lat, lng + 0.0018]);
    }
    L.polyline(sidingPoints2, { color: '#38a169', weight: 4, opacity: 0.7, dashArray: '5,5' }).addTo(map);

    // Station Labels
    // Stasiun Latihan A (KM 1.0)
    L.marker(getTrainingLatLng(1.0), {
      icon: L.divIcon({
        className: 'local-marker-a',
        html: `<div class="bg-indigo-950/90 border border-indigo-400 text-indigo-300 font-bold font-mono text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">🏫 STN LATIHAN A (KM 1.0)</div>`,
        iconSize: [120, 20],
        iconAnchor: [60, 10]
      })
    }).addTo(map);

    // Stasiun Latihan B (KM 4.0)
    L.marker(getTrainingLatLng(4.0), {
      icon: L.divIcon({
        className: 'local-marker-b',
        html: `<div class="bg-emerald-950/90 border border-emerald-400 text-emerald-300 font-bold font-mono text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap font-extrabold pb-0.5 shadow-md">🏁 STN LATIHAN B (KM 4.0)</div>`,
        iconSize: [120, 20],
        iconAnchor: [60, 10]
      })
    }).addTo(map);

    // Depot Latihan (KM 0.20)
    L.marker(getTrainingLatLng(0.2), {
      icon: L.divIcon({
        className: 'local-marker-depot',
        html: `<div class="bg-amber-950/90 border border-amber-500 text-amber-500 font-bold font-mono text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">🛠️ DEPO LATIHAN (KM 0.2)</div>`,
        iconSize: [110, 20],
        iconAnchor: [55, 10]
      })
    }).addTo(map);

    return () => {
      if (localMapRef.current) {
        localMapRef.current.remove();
        localMapRef.current = null;
      }
    };
  }, [activeTab]);

  // Clean markers representation on component unmount
  useEffect(() => {
    return () => {
      cleanLocalMarkers();
    };
  }, []);

  // ==========================================
  // PHYSICS RECKONING AND VALIDATORS (MASINIS)
  // ==========================================
  useEffect(() => {
    if (activeTab !== 'masinis' || masinisState !== 'running') return;

    const interval = setInterval(() => {
      setMasinisTrain(prev => {
        // Run customized trainer physics
        const t = { ...prev };
        
        // Braking drag and notching acceleration
        let acc = (t.throttle * 1.5) - (t.brake * 2.5);
        if (t.reverser === 'N') acc = -t.speed * 0.5;

        let nextSpeed = t.speed + (acc * 0.1);
        if (nextSpeed < 0) nextSpeed = 0;
        if (nextSpeed > t.maxSpeed) nextSpeed = t.maxSpeed;

        t.speed = nextSpeed;

        // update position
        const deltaKp = ((t.speed / 3600) * (t.reverser === 'F' ? 1 : t.reverser === 'R' ? -1 : 0)) * 0.1;
        t.kp = t.kp + deltaKp;
        if (t.kp < 1.0) { t.kp = 1.0; t.speed = 0; }

        // Batas Kecepatan checking: Over-speed > 5 km/jam dari limit = Kurangi 10 poin per detik (1 poin per 100ms)
        if (t.speed > masinisSpeedLimit + 5) {
          setMasinisPoints(pts => {
            const result = pts - 1;
            if (result <= 0) {
              setMasinisState('failed');
              setMasinisLogs(prevL => [
                `🚨 SIMULASI GAGAL! Poin Anda habis karena over-speed berkepanjangan (> ${masinisSpeedLimit + 5} km/jam)!`,
                ...prevL
              ]);
            }
            return Math.max(0, result);
          });
          setMasinisLogs(prevL => {
            if (prevL[0] && prevL[0].includes('MELEBIHI BATAS KECEPATAN')) return prevL;
            return [
              `⚠️ MELEBIHI BATAS KECEPATAN: Speed ${Math.round(t.speed)} km/h melebihi limit ${masinisSpeedLimit} km/h + 5! Nilai dikurangi (-10 Poin/Detik)`,
              ...prevL
            ];
          });
        }

        // Semboyan 35 (Klakson) Check before PJL at KM 2.5
        // 100-200m before PJL corresponds to kp between 2.3 and 2.4
        if (t.kp >= 2.3 && t.kp <= 2.4 && masinisS35Played) {
          // player blew horn correctly in the 100-200m window
        }

        if (t.kp > 2.4 && !pjlHornDeducted) {
          if (!masinisS35Played) {
            setMasinisPoints(pts => {
              const result = pts - 20;
              if (result <= 0) {
                setMasinisState('failed');
                setMasinisLogs(prevL => [
                  `🚨 SIMULASI GAGAL! Poin Anda habis akibat kelalaian Semboyan 35!`,
                  ...prevL
                ]);
              }
              return Math.max(0, result);
            });
            setMasinisLogs(prevL => [
              `⚠️ INFRAKSI: Anda tidak membunyikan Semboyan 35 (Klakson) pada jarak 100-200m sebelum PJL KM 2.5! (-20 Poin)`,
              ...prevL
            ]);
          } else {
            setMasinisLogs(prevL => [
              `✅ SEMBOYAN 35 PATUH: Semboyan 35 klakson lokomotif berhasil dibunyikan sebelum melintasi sebidang PJL.`,
              ...prevL
            ]);
          }
          setPjlHornDeducted(true);
        }

        // Ketaatan Sinyal: S-LATIHAN-B Sinyal Merah is at KM 3.8
        if (masinisSignalColor === SignalColor.Red && t.kp >= 3.8) {
          audio.playBrakeHiss();
          setMasinisState('failed');
          setMasinisPoints(0);
          setMasinisLogs(prevL => [
            '🚨 GAGAL UTAMA (SPAD): Anda melanggar Sinyal Merah (Semboyan 7 / SPAD)! Ujian otomatis GAGAL instant.',
            ...prevL
          ]);
        }

        // Ketepatan Berhenti stop check at KM 4.0
        if (t.speed === 0 && t.kp >= 3.90) {
          const trainCoords = getTrainingLatLng(t.kp);
          const stopCoords = getTrainingLatLng(4.00);
          
          // Compute real coordinates distance using Haversine
          const distanceMeters = calculateDistance(trainCoords, stopCoords);

          if (distanceMeters <= 5.0) {
            let finalPoints = masinisPoints;
            let stopLog = '';
            if (distanceMeters > 1.0) {
              finalPoints -= 25;
              stopLog = `⚠️ AKURASI BERHENTI KURANG: Jarak berhenti Anda adalah ${distanceMeters.toFixed(2)} Meter (melebihi batas aman 1 meter). Dikurangi 25 Poin!`;
            } else {
              stopLog = `✅ AKURASI BERHENTI SEMPURNA: Berhenti sangat presisi dengan jarak ${distanceMeters.toFixed(2)} Meter (< 1 meter).`;
            }

            if (finalPoints >= 75) {
              setMasinisPoints(finalPoints);
              setMasinisState('success');
              setMasinisLogs(prevL => [
                `🎉 SELAMAT! Ujian Masinis Selesai dan LULUS!`,
                stopLog,
                `Skor Akhir Anda: ${finalPoints} Poin (Minimal kelulusan 75 Poin).`,
                ...prevL
              ]);
              audio.playPJLBell(1.0);
            } else {
              setMasinisPoints(Math.max(0, finalPoints));
              setMasinisState('failed');
              setMasinisLogs(prevL => [
                `🚨 UJIAN GAGAL! Skor akhir Anda ${finalPoints} Poin di bawah batas minimal kelulusan 75 Poin!`,
                stopLog,
                ...prevL
              ]);
            }
          } else {
            // Log near stopping warnings
            setMasinisLogs(prevL => {
              if (prevL[0] && prevL[0].includes('INFORMASI BERHENTI')) return prevL;
              return [
                `ℹ️ INFORMASI BERHENTI: Kereta berhenti di KM ${t.kp.toFixed(4)}. Jarak dari peron adalah ${distanceMeters.toFixed(1)} Meter. Maju perlahan hingga berada di bawah 5.0 Meter!`,
                ...prevL
              ];
            });
          }
        }

        return t;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [masinisState, masinisSignalColor, masinisSpeedLimit, activeTab]);

  // Render Masinis Markers in real-time
  useEffect(() => {
    if (!localMapRef.current || activeTab !== 'masinis') return;
    const map = localMapRef.current;

    const loc = getTrainingLatLng(masinisTrain.kp);
    map.panTo(loc);

    const trainHtml = `
      <div class="flex flex-col items-center">
        <div class="w-6 h-6 rounded-lg bg-indigo-600 border border-white text-white flex items-center justify-center shadow-lg font-black font-sans text-xs animate-pulse">🚂</div>
        <div class="bg-slate-900 text-[8px] border border-indigo-500 font-mono text-white px-1 py-0.5 rounded shadow-lg whitespace-nowrap mt-1">
          CC 201 Trainer (${Math.round(masinisTrain.speed)} km/h)
        </div>
      </div>
    `;

    if (trainMarkerRef.current) {
      trainMarkerRef.current.setLatLng(loc).setIcon(L.divIcon({
        className: 'masinis-map-train',
        html: trainHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      }));
    } else {
      trainMarkerRef.current = L.marker(loc, {
        icon: L.divIcon({
          className: 'masinis-map-train',
          html: trainHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map);
    }

    // Sinyal S-LATIHAN-B at KM 3.8
    const sigLoc = getTrainingLatLng(3.8);
    const sigHtml = `
      <div class="flex flex-col items-center">
        <div class="w-3.5 h-3.5 rounded-full ${masinisSignalColor === SignalColor.Red ? 'bg-red-500 shadow-red-500' : 'bg-green-500 shadow-green-500'} shadow border border-white"></div>
        <span class="text-[7.5px] bg-slate-950 text-slate-400 font-mono px-0.5 rounded border border-slate-700 font-black mt-1">S-LATIHAN-B</span>
      </div>
    `;

    if (signalMarkerRef.current) {
      signalMarkerRef.current.setLatLng(sigLoc).setIcon(L.divIcon({
        className: 'local-sig-marker',
        html: sigHtml,
        iconSize: [40, 30],
        iconAnchor: [20, 15]
      }));
    } else {
      signalMarkerRef.current = L.marker(sigLoc, {
        icon: L.divIcon({
          className: 'local-sig-marker',
          html: sigHtml,
          iconSize: [40, 30],
          iconAnchor: [20, 15]
        })
      }).addTo(map);
    }
  }, [masinisTrain.kp, masinisTrain.speed, masinisSignalColor, activeTab]);

  // ==========================================
  // PHYSICS RECKONING AND VALIDATORS (PPKA)
  // ==========================================
  useEffect(() => {
    if (activeTab !== 'ppka' || ppkaState !== 'running') return;

    const interval = setInterval(() => {
      setPpkaTimer(t => t + 1);

      setPpkaTrains(prevTrains => {
        let changed = false;
        const speedKmh = 40; // trains cruise speed

        const updated = prevTrains.map(tr => {
          if (tr.finished) return tr;
          
          let nextKp = tr.kp;
          const motionSign = tr.direction === LineDirection.Hilir ? 1 : -1;
          let nextSpeed = speedKmh;
          let nextStopTime = tr.stopTime;
          let currentStatus = 'BERJALAN';

          // 1) Stop Signal check for Hilir trains before Siding 1 (KM 1.3)
          if (tr.direction === LineDirection.Hilir && tr.id === 'KA-AI-1' && ppkaSignal1 === SignalColor.Red && tr.kp >= 1.25 && tr.kp <= 1.35) {
            nextSpeed = 0;
            nextStopTime += 1;
            currentStatus = 'TERTAHAN SINYAL (W-1)';
          }

          // 2) Stop Signal check for Hulu trains before Siding 2 (KM 2.9)
          if (tr.direction === LineDirection.Hulu && tr.id === 'KA-AI-2' && ppkaSignal2 === SignalColor.Red && tr.kp <= 2.95 && tr.kp >= 2.85) {
            nextSpeed = 0;
            nextStopTime += 1;
            currentStatus = 'TERTAHAN SINYAL (W-2)';
          }

          // 3) Stop Signal check for AI-3 Hilir train before Siding 1 loop
          if (tr.direction === LineDirection.Hilir && tr.id === 'KA-AI-3' && ppkaSignal1 === SignalColor.Red && tr.kp >= 1.25 && tr.kp <= 1.35) {
            nextSpeed = 0;
            nextStopTime += 1;
            currentStatus = 'TERTAHAN SINYAL';
          }

          // Time limit check: Must not remain stopped for > 45 seconds (450 ticks)
          if (nextStopTime > 450) {
            setPpkaState('failed');
            setPpkaPoints(0);
            setPpkaLogs(prevL => [
              `🚨 UJIAN GAGAL: ${tr.name} tertahan di sinyal masuk melebihi batas 45 detik! Manajemen headway hancur.`,
              ...prevL
            ]);
          }

          // Delay penalty check: Deduct 15 points if signal delay holds a train stopped for > 15 seconds (150 ticks)
          if (nextStopTime === 150) {
            setPpkaPoints(pts => {
              const result = pts - 15;
              if (result <= 0) {
                setPpkaState('failed');
                setPpkaLogs(prevL => [
                  `🚨 UJIAN GAGAL: Kereta ${tr.name} tertahan terlalu lama di sinyal masuk! Headway hancur.`,
                  ...prevL
                ]);
              }
              return Math.max(0, result);
            });
            setPpkaLogs(prevL => [
              `⚠️ PENALTI SINYAL: Kereta ${tr.name} tertahan di sinyal masuk > 15 detik! (-15 Poin)`,
              ...prevL
            ]);
          }

          // Move along track
          nextKp += ((nextSpeed / 3600) * motionSign) * 0.1;

          // Check if destination is reached
          let isDone = false;
          if (tr.direction === LineDirection.Hilir && nextKp >= 4.0) {
            isDone = true;
            nextKp = 4.0;
            nextSpeed = 0;
            currentStatus = 'TIBA DI TUJUAN';
          } else if (tr.direction === LineDirection.Hulu && nextKp <= 1.0) {
            isDone = true;
            nextKp = 1.0;
            nextSpeed = 0;
            currentStatus = 'TIBA DI TUJUAN';
          }

          if (isDone !== tr.finished || nextKp !== tr.kp || nextSpeed !== tr.speed || nextStopTime !== tr.stopTime || currentStatus !== tr.status) {
            changed = true;
          }

          return { ...tr, kp: nextKp, speed: nextSpeed, finished: isDone, stopTime: nextStopTime, status: currentStatus };
        });

        // 3) PJL Gate Crossing Safety Rule: Deduct 15 points per second (1.5 pts per tick) if train is within 500m of PJL (KM 2.0) and PJL is OPEN
        const trainNearPjl = updated.find(u => Math.abs(u.kp - 2.0) <= 0.5 && !u.finished);
        if (trainNearPjl && !ppkaPjlClosed) {
          setPpkaPoints(pts => {
            const result = pts - 1.5;
            if (result <= 0) {
              setPpkaState('failed');
              setPpkaLogs(prevL => [
                `🚨 UJIAN GAGAL: Kereta menerobos perlintasan sebidang KM 2.0 yang terbuka! Kecelakaan fatal lalu lintas sebidang!`,
                ...prevL
              ]);
            }
            return Math.max(0, result);
          });
          setPpkaLogs(prevL => {
            if (prevL[0] && prevL[0].includes('PERINGATAN PJL TERBUKA')) return prevL;
            return [
              `⚠️ PERINGATAN PJL TERBUKA: Kereta mendekati sebidang PJL KM 2.0 pada jarak kurang dari 500 meter sementara pintu perlintasan masih terbuka! (-15 Poin/detik)`,
              ...prevL
            ];
          });
        }

        // Safe check for block conflict / collision
        // Single line exists between KM 1.55 and KM 2.65
        const trainsOnSingleLine = updated.filter(u => u.kp > 1.55 && u.kp < 2.65 && !u.finished);
        if (trainsOnSingleLine.length > 1) {
          // Check if they are traveling in opposite directions
          const hilirExist = trainsOnSingleLine.some(t => t.direction === LineDirection.Hilir);
          const huluExist = trainsOnSingleLine.some(t => t.direction === LineDirection.Hulu);
          if (hilirExist && huluExist) {
            setPpkaState('failed');
            setPpkaPoints(0);
            setPpkaLogs(prevL => [
              `🚨 BENTROK BLOK JALUR TUNGGAL: Dua kereta AI dari arah berlawanan berada di jalur KM ${trainsOnSingleLine[0].kp.toFixed(2)} bersamaan! Tabrakan terjadi!`,
              ...prevL
            ]);
          }
        }

        // Check if all 3 trains reached finished status successfully
        const allFinished = updated.every(u => u.finished);
        if (allFinished && ppkaState === 'running') {
          if (ppkaPoints >= 75) {
            setPpkaState('success');
            setPpkaLogs(prevL => [
              `🎉 SELAMAT! Ujian PPKA Lunas dan LULUS!`,
              `Skor Akhir Anda: ${Math.round(ppkaPoints)} Poin (Minimal kelulusan 75 Poin).`,
              ...prevL
            ]);
            audio.playPJLBell(1.2);
          } else {
            setPpkaState('failed');
            setPpkaLogs(prevL => [
              `🚨 UJIAN GAGAL! Skor akhir Anda ${Math.round(ppkaPoints)} Poin berada di bawah batas kelulusan 75 Poin!`,
              ...prevL
            ]);
          }
        }

        return changed ? updated : prevTrains;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [ppkaState, ppkaSignal1, ppkaSignal2, ppkaWesel1, ppkaWesel2, ppkaPjlClosed, ppkaPoints, activeTab]);

  // Handle PPKA switches (Deadly Movement Prevention check)
  const togglePpkaWesel = (id: 1 | 2) => {
    if (ppkaState === 'failed' || ppkaState === 'success') return;

    if (id === 1) {
      // Check if any train is currently over Switch 1 (KM 1.4 +/- 0.1)
      const isOccupied = ppkaTrains.some(t => Math.abs(t.kp - 1.4) <= 0.1 && !t.finished);
      if (isOccupied) {
        setPpkaState('failed');
        setPpkaPoints(0);
        setPpkaLogs(prev => [
          '🚨 GAGAL INSTANT (Deadly Movement): Memindahkan wesel W-LATIHAN-01 saat ada kereta melintas di atasnya!',
          ...prev
        ]);
        audio.playBrakeHiss();
        return;
      }
      setPpkaWesel1(w => w === 'straight' ? 'diverging' : 'straight');
      setPpkaLogs(prev => [`Wesel W-LATIHAN-01 dipindahkan ke posisi ${ppkaWesel1 === 'straight' ? 'BELOK (Siding 1)' : 'LURUS (Utama)'}.`, ...prev]);
    } else {
      // Check if any train is currently over Switch 2 (KM 2.8 +/- 0.1)
      const isOccupied = ppkaTrains.some(t => Math.abs(t.kp - 2.8) <= 0.1 && !t.finished);
      if (isOccupied) {
        setPpkaState('failed');
        setPpkaPoints(0);
        setPpkaLogs(prev => [
          '🚨 GAGAL INSTANT (Deadly Movement): Memindahkan wesel W-LATIHAN-02 saat ada kereta melintas di atasnya!',
          ...prev
        ]);
        audio.playBrakeHiss();
        return;
      }
      setPpkaWesel2(w => w === 'straight' ? 'diverging' : 'straight');
      setPpkaLogs(prev => [`Wesel W-LATIHAN-02 dipindahkan ke posisi ${ppkaWesel2 === 'straight' ? 'BELOK (Siding 2)' : 'LURUS (Utama)'}.`, ...prev]);
    }
  };

  // Render PPKA Markers in real-time
  useEffect(() => {
    if (!localMapRef.current || activeTab !== 'ppka') return;
    const map = localMapRef.current;

    // Redraw 3 Simulated PPKA Trains
    ppkaTrains.forEach(t => {
      if (t.finished) {
        if (ppkaTrainMarkersRef.current[t.id]) {
          ppkaTrainMarkersRef.current[t.id].remove();
          delete ppkaTrainMarkersRef.current[t.id];
        }
        return;
      }

      // Add alternate siding offset if inside the switches
      let latOffset = 0;
      let lngOffset = 0;
      if (t.id === 'KA-AI-1' && t.kp >= 1.25 && t.kp <= 1.55 && ppkaWesel1 === 'diverging') {
        lngOffset = 0.0018;
      } else if (t.id === 'KA-AI-2' && t.kp >= 2.65 && t.kp <= 2.95 && ppkaWesel2 === 'diverging') {
        lngOffset = 0.0018;
      } else if (t.id === 'KA-AI-3' && t.kp >= 1.25 && t.kp <= 1.55 && ppkaWesel1 === 'diverging') {
        lngOffset = 0.0018;
      }

      const pCoords = getTrainingLatLng(t.kp);
      const loc: [number, number] = [pCoords[0] + latOffset, pCoords[1] + lngOffset];

      const html = `
        <div class="flex flex-col items-center">
          <div class="w-5 h-5 rounded-md bg-amber-500 text-slate-900 border border-black flex items-center justify-center font-bold text-[8px] tracking-tighter">AI</div>
          <div class="bg-indigo-950 text-[7px] border border-slate-700 font-mono text-white px-0.5 rounded whitespace-nowrap leading-none mt-1 shadow">
            ${t.name} (${Math.round(t.speed)} kmh)
          </div>
        </div>
      `;

      if (ppkaTrainMarkersRef.current[t.id]) {
        ppkaTrainMarkersRef.current[t.id].setLatLng(loc).setIcon(L.divIcon({
          className: `ppka-tr-${t.id}`,
          html,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }));
      } else {
        ppkaTrainMarkersRef.current[t.id] = L.marker(loc, {
          icon: L.divIcon({
            className: `ppka-tr-${t.id}`,
            html,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(map);
      }
    });

    // Remove any marker that was removed from active trains state
    Object.keys(ppkaTrainMarkersRef.current).forEach(id => {
      if (!ppkaTrains.some(t => t.id === id && !t.finished)) {
        ppkaTrainMarkersRef.current[id].remove();
        delete ppkaTrainMarkersRef.current[id];
      }
    });

  }, [ppkaTrains, ppkaWesel1, ppkaWesel2, activeTab]);

  // ==========================================
  // PHYSICS RECKONING AND VALIDATORS (TEKNISI)
  // ==========================================
  useEffect(() => {
    if (activeTab !== 'teknisi' || teknisiState === 'idle' || teknisiState === 'failed' || teknisiState === 'success') return;

    const interval = setInterval(() => {
      // 1) Rescue Time Limit Check (120 seconds max)
      const elapsed = Math.floor((Date.now() - teknisiStartTime) / 1000);
      if (elapsed > 120) {
        setTeknisiState('failed');
        setTeknisiPoints(0);
        setTeknisiLogs(prevL => {
          if (prevL[0] && prevL[0].includes('BATAS WAKTU EVAKUASI MELEBIHI')) return prevL;
          return [
            `🚨 UJIAN GAGAL: Batas waktu evakuasi maksimal 120 detik terlampaui! Rangkaian mogok mengalami kerusakan permanen akibat terlalu lama di lintas aktif.`,
            ...prevL
          ];
        });
        audio.playBrakeHiss();
        clearInterval(interval);
        return;
      }

      setTeknisiLori(prev => {
        const t = { ...prev };
        
        // standard braking and power logic
        let acc = (t.throttle * 1.5) - (t.brake * 2.5);
        if (t.reverser === 'N') acc = -t.speed * 0.5;

        let nextSpeed = t.speed + (acc * 0.1);
        if (nextSpeed < 0) nextSpeed = 0;
        if (nextSpeed > t.maxSpeed) nextSpeed = t.maxSpeed;

        t.speed = nextSpeed;

        const deltaKp = ((t.speed / 3600) * (t.reverser === 'F' ? 1 : t.reverser === 'R' ? -1 : 0)) * 0.1;
        t.kp = t.kp + deltaKp;
        if (t.kp < 0.20) { t.kp = 0.20; t.speed = 0; }

        // 2) Safe approach and coupling check: range KM 2.18 - 2.22 (TKP)
        if (t.kp >= 2.18 && t.kp <= 2.22 && teknisiState === 'running') {
          if (t.speed > 10) {
            setTeknisiPoints(pts => {
              const result = pts - 40;
              if (result <= 0) {
                setTeknisiState('failed');
                setTeknisiLogs(prevL => [
                  `🚨 UJIAN GAGAL: Tabrakan keras dengan rangkaian mogok pada kecepatan ${Math.round(t.speed)} km/h! Rangkaian hancur!`,
                  ...prevL
                ]);
              }
              return Math.max(0, result);
            });
            setTeknisiLogs(prevL => {
              if (prevL[0] && prevL[0].includes('TABRAKAN KERAS')) return prevL;
              return [
                `⚠️ TABRAKAN KERAS: Lori menabrak rangkaian mogok di KM 2.20 pada kecepatan ${Math.round(t.speed)} km/h! (-40 Poin)`,
                ...prevL
              ];
            });
            t.speed = 0;
            t.kp = 2.15; // bounce back
            audio.playBrakeHiss();
          } else {
            t.speed = 0;
            t.kp = 2.18; // stop safely
            setTeknisiLogs(prevL => {
              if (prevL[0] && prevL[0].includes('LORI TIBA DI TKP')) return prevL;
              return [
                `ℹ️ LORI TIBA DI TKP: Lori berhasil merapat dengan aman di KM 2.18. Klik tombol "Gandeng Rangkaian" untuk mengunci kopling!`,
                ...prevL
              ];
            });
          }
        }

        // 3) Towing Speed Limit check during active coupled evacuation (Limit: 30 km/h)
        if (teknisiState === 'coupled' && t.speed > 30) {
          setTeknisiPoints(pts => {
            const result = pts - 2.5; // 25 points per second = 2.5 points per 100ms tick
            if (result <= 0) {
              setTeknisiState('failed');
              setTeknisiLogs(prevL => [
                `🚨 UJIAN GAGAL: Rangkaian towing mengalami kecelakaan fatal akibat ditarik terlalu cepat!`,
                ...prevL
              ]);
            }
            return Math.max(0, result);
          });
          setTeknisiLogs(prevL => {
            if (prevL[0] && prevL[0].includes('KECEPATAN TOWING MELEBIHI BATAS')) return prevL;
            return [
              `⚠️ KECEPATAN TOWING MELEBIHI BATAS: Kecepatan penarikan ${Math.round(t.speed)} km/h melebihi batas aman 30 km/h! Nilai dikurangi (-25 Poin/detik)`,
              ...prevL
            ];
          });
        }

        return t;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [teknisiState, towingSpeedLimit, teknisiStartTime, activeTab]);

  // Render Rescue / Teknisi on map
  useEffect(() => {
    if (!localMapRef.current || activeTab !== 'teknisi') return;
    const map = localMapRef.current;

    const loriLoc = getTrainingLatLng(teknisiLori.kp);
    map.panTo(loriLoc);

    const loriHtml = `
      <div id="nr-lori-marker" class="flex flex-col items-center">
        <div class="w-6 h-6 rounded bg-amber-500 border border-slate-900 text-slate-900 flex items-center justify-center shadow-lg font-black font-sans text-xs animate-bounce">🛠️</div>
        <div class="bg-slate-900 border border-amber-500 text-[8px] font-mono text-white px-1 py-0.5 rounded shadow whitespace-nowrap mt-1 leading-none">
          Rescue LRT-01 (${Math.round(teknisiLori.speed)} km/h)
          ${teknisiState === 'coupled' ? '<span class="text-emerald-400 font-bold ml-1 border border-emerald-800 px-0.5 rounded block text-center uppercase">[COUPLED]</span>' : ''}
        </div>
      </div>
    `;

    if (trainMarkerRef.current) {
      trainMarkerRef.current.setLatLng(loriLoc).setIcon(L.divIcon({
        className: 'local-rescue-lori',
        html: loriHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      }));
    } else {
      trainMarkerRef.current = L.marker(loriLoc, {
        icon: L.divIcon({
          className: 'local-rescue-lori',
          html: loriHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map);
    }

    // Stranded collision trains showing at KM 2.20
    const crashLoc = getTrainingLatLng(2.20);
    const crashHtml = `
      <div class="flex flex-col items-center select-none">
        <span class="text-lg">💥</span>
        <div class="bg-red-950 border border-red-500 text-[7px] text-red-200 font-bold px-1 rounded whitespace-nowrap shadow uppercase animate-pulse leading-none py-0.5">TKP Tabrakan (KM 2.20)</div>
      </div>
    `;

    if (collisionMarkerRef.current) {
      collisionMarkerRef.current.setLatLng(crashLoc).setIcon(L.divIcon({
        className: 'local-crash-spot',
        html: crashHtml,
        iconSize: [40, 30],
        iconAnchor: [20, 15]
      }));
    } else {
      collisionMarkerRef.current = L.marker(crashLoc, {
        icon: L.divIcon({
          className: 'local-crash-spot',
          html: crashHtml,
          iconSize: [40, 30],
          iconAnchor: [20, 15]
        })
      }).addTo(map);
    }
  }, [teknisiLori.kp, teknisiLori.speed, teknisiState, activeTab]);

  // Handle manual coupling logic distance check using Haversine
  const handleCouplingDinas = () => {
    const loriCoords = getTrainingLatLng(teknisiLori.kp);
    const crashCoords = getTrainingLatLng(2.20);

    const distanceMeters = calculateDistance(loriCoords, crashCoords);

    if (distanceMeters <= 10.0) {
      if (teknisiLori.speed > 10) {
        setTeknisiPoints(pts => {
          const result = pts - 40;
          if (result <= 0) {
            setTeknisiState('failed');
            setTeknisiLogs(prev => [
              `🚨 UJIAN GAGAL: Tabrakan keras saat mencoba menggandeng rangkaian! Kecepatan ${Math.round(teknisiLori.speed)} km/h melebihi batas aman 10 km/h. Rangkaian hancur!`,
              ...prev
            ]);
          }
          return Math.max(0, result);
        });
        setTeknisiLogs(prev => [
          `⚠️ TABRAKAN KERAS: Menabrak rangkaian mogok dengan kecepatan ${Math.round(teknisiLori.speed)} km/h! (-40 Poin)`,
          ...prev
        ]);
        audio.playBrakeHiss();
        if (teknisiPoints - 40 <= 0) return; // failed
      }

      setTeknisiState('coupled');
      audio.playSemboyan35();
      setTeknisiLogs(prev => [
        `🔗 KOPLING BERHASIL DIKUNCI! Crane & Penyangga Lori terhubung sempurna (Jarak: ${distanceMeters.toFixed(1)} Meter).`,
        '⚠️ PETUNJUK DINAS: Tarik perlahan rangkaian rusak kembali ke STASIUN LATIHAN A (KM 1.0) dengan batas kecepatan dinamis maksimal 30 km/jam!',
        ...prev
      ]);
    } else {
      setTeknisiLogs(prev => [
        `❌ GAGAL KUNCI: Jarak lori penyelamat masih terlalu jauh (${distanceMeters.toFixed(1)} meter). Dekatkan hingga berada di bawah 10 meter (KM 2.20)!`,
        ...prev
      ]);
    }
  };

  // Selesaikan Dinas Teknisi evacuation check at platform KM 1.0 (Stasiun Latihan A)
  const handleDeliverTowedTrain = () => {
    const loriCoords = getTrainingLatLng(teknisiLori.kp);
    const targetCoords = getTrainingLatLng(1.0);

    const distanceMeters = calculateDistance(loriCoords, targetCoords);

    if (teknisiLori.speed === 0 && distanceMeters <= 5.0) {
      if (teknisiPoints >= 80) {
        setTeknisiState('success');
        setTeknisiLogs(prev => [
          `🎉 SELAMAT! Ujian Penyelamatan Rescue Lunas dan LULUS!`,
          `Skor Akhir Anda: ${Math.round(teknisiPoints)} Poin (Minimal kelulusan 80 Poin).`,
          ...prev
        ]);
        audio.playPJLBell(1.2);
      } else {
        setTeknisiState('failed');
        setTeknisiLogs(prev => [
          `🚨 UJIAN GAGAL! Skor akhir Anda ${Math.round(teknisiPoints)} Poin berada di bawah batas kelulusan 80 Poin!`,
          ...prev
        ]);
      }
    } else {
      setTeknisiLogs(prev => [
        `❌ GAGAL SERAH TERIMA: Kereta wajib dihentikan sepenuhnya (0 km/h) di zona peron Stasiun Latihan A (KM 1.0, Jarak saat ini: ${distanceMeters.toFixed(1)} meter).`,
        ...prev
      ]);
    }
  };

  // ==========================================
  // CERTIFICATE AWARD PERSISTENCE CALLS
  // ==========================================
  const claimTabCertificate = (tab: TrainingTab) => {
    const nextCareer = { ...career };
    
    if (tab === 'masinis') {
      nextCareer.isMasinisCertified = true;
      nextCareer.points += 100;
    } else if (tab === 'ppka') {
      nextCareer.isPpkaCertified = true;
      nextCareer.points += 100;
    } else if (tab === 'teknisi') {
      nextCareer.isTeknisiCertified = true;
      nextCareer.points += 100;
    }

    // Evaluate final gate eligibility to unlock "MAIN!" server button
    const eligible = !!(nextCareer.isMasinisCertified && nextCareer.isPpkaCertified && nextCareer.isTeknisiCertified);
    if (eligible) {
      nextCareer.canJoinMultiplayer = true;
      nextCareer.hasLicense = true; // Auto grant final dines standard license
      nextCareer.rank = CareerRank.Muda; // Raise rank automatically
    }

    onGrantLicense(nextCareer);
  };

  return (
    <div id="pusdiklat-panel" className="bg-[#0b0e19] text-gray-100 min-h-screen p-4 flex flex-col justify-between font-sans border-t-4 border-emerald-500">
      
      {/* Academy Title and Overview */}
      <div className="flex flex-wrap justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-slate-950 font-extrabold px-2.5 py-1 rounded text-[10px] tracking-wide font-mono uppercase flex items-center gap-1">
            <Award size={14} />
            <span>Pendidikan Kilat RRSid</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">Sekolah Pendidikan dan Latihan (Diklat) RRSid</h1>
            <p className="text-[10px] text-slate-400 font-mono">Simulasi Standar Kompetensi Awak Sarana & Prasarana Perkeretaapian</p>
          </div>
        </div>

        {/* Dynamic Division Choice */}
        <div className="flex bg-[#070912] p-0.5 rounded-lg border border-slate-800">
          {[
            { id: 'masinis', label: '1. Ujian Masinis' },
            { id: 'ppka', label: '2. Ujian PPKA' },
            { id: 'teknisi', label: '3. Ujian Rescue' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                cleanLocalMarkers();
                setActiveTab(tab.id as any);
              }}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 font-black font-mono shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button 
          id="btn-return"
          onClick={onExit}
          className="bg-slate-800 hover:bg-slate-700 font-mono text-[11px] font-extrabold text-slate-350 px-4 py-1.5 rounded transition-all cursor-pointer"
        >
          KEMBALI KE LOBBY
        </button>
      </div>

      {/* Main Panel Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
        
        {/* Left Side: Specific Module Instructions / Current Status */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Module instructions cards */}
          <div className="bg-[#12192a] rounded-xl border border-slate-800 p-4 font-mono flex-1 flex flex-col justify-between">
            <div>
              <div className="border-b border-indigo-950 pb-2 mb-3">
                <h3 className="text-xs text-indigo-400 uppercase font-black">
                  {activeTab === 'masinis' ? 'SILABUS DINAS MASINIS' : activeTab === 'ppka' ? 'SILABUS DINAS PPKA / dispatcher' : 'SILABUS penyelamatan teknisi'}
                </h3>
                <span className="text-[10px] text-slate-450 mt-1 block">Silabus standar kelaikan jalur baja utama</span>
              </div>

              {activeTab === 'masinis' && (
                <div className="space-y-3.5 text-[11px] text-slate-300">
                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-indigo-400 font-bold block mb-1">1. Batas Kecepatan</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Patuhi batas kecepatan dinamis trainer (<strong className="text-white">kecepatan maksimal {masinisSpeedLimit} km/jam</strong>). Melanggar speed limit akan mendepresiasi poin Anda secara bertahap. Melebihi 55 km/jam membatalkan ujian!
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-indigo-400 font-bold block mb-1">2. Semboyan 7 / Sinyal Merah</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Sinyal Blok KM 3.8 dalam aspek <strong className="text-red-400">MERAH (Berhenti Mutlak)</strong>. Kurangi notch, tekan rem B2-B4. Melintasi lampu merah memicu SPAD dan <strong className="text-red-400 font-bold">GAGAL INSTANT</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-indigo-400 font-bold block mb-1">3. Presisi Berhenti</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Berhenti presisi tepat di marka stasiun <strong className="text-[#10b981]">Stasiun Latihan B (KM 4.0)</strong> dengan toleransi sensitivitas koordinat Leaflet <strong className="text-white">maksimal 5 Meter</strong>.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'ppka' && (
                <div className="space-y-3.5 text-[11px] text-slate-300">
                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold block mb-1">1. No Collision Line Block</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Papaskan Argo Hilir, Argo Hulu, dan Lokal Hilir di 2 daerah siding sela (KM 1.4 dan KM 2.8). Beralihlah ke sepur belok untuk menghindari tabrakan adu banteng.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold block mb-1">2. No Deadly Switch (Kesalahan Wesel)</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Sangat dilarang memindahkan rute lidah wesel saat badan kereta AI sedang berada tepat di atas lidah wesel (KM 1.4 / KM 2.8). Jika melanggar terdeteksi <strong className="text-red-400 font-bold">GAGAL INSTANT</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold block mb-1">3. Headway Antrean (Maks 45s)</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Jangan biarkan kereta AI berhenti tertahan lampu merah di wesel sela melebihi 45 detik untuk menjaga efisiensi dinas lalu-lintas kereta.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'teknisi' && (
                <div className="space-y-3.5 text-[11px] text-slate-300">
                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">1. No Teleportation (Dinas Manual)</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Bergeraklah secara perlahan menyusuri rel dari koordinat Depo Awal (KM 0.20) menuju titik kecelakaan crash site di KM 2.20 menggunakan tuas throttle.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">2. Jarak Kopling Evakuasi (&lt;10 Meter)</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Gunakan tombol "Hubungkan Kopling" sesampainya di dekat tabrakan. Deteksi posisi wajib memiliki jarak berada kurang dari <strong className="text-white">10 Meter</strong> dari bangkai kereta.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#0a0e19] rounded border border-slate-800">
                    <span className="text-amber-400 font-bold block mb-1">3. Speed Limit Towing (Maks 30 km/h)</span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Selama menyambung badan kereta tabrakan, heret dengan kecepatan <strong className="text-[#f59e0b]">tidak melebihi 30 km/jam</strong>. Melanggar akan memutuskan rantai pengait seketika.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Scoreboard and License Unlock check */}
            <div className="bg-[#080d16] border border-slate-800 p-3 rounded-lg text-center mt-3">
              <span className="text-[9px] text-[#10b981] font-black uppercase tracking-wider block">Akumulasi Nilai Ujian</span>
              <div className="text-2xl font-mono font-black text-white mt-1">
                {activeTab === 'masinis' ? masinisPoints : activeTab === 'ppka' ? ppkaPoints : teknisiPoints}
                <span className="text-xs text-slate-500 font-normal"> / 100 PTS</span>
              </div>
              <div className="text-[9.5px] text-slate-400 mt-1 uppercase font-semibold">
                Status Kelulusan: {
                  activeTab === 'masinis' 
                    ? (career.isMasinisCertified ? <span className="text-emerald-400">LULUS (TERSERTIFIKASI)</span> : <span className="text-amber-500">BELUM TERPENUHI</span>)
                    : activeTab === 'ppka'
                      ? (career.isPpkaCertified ? <span className="text-emerald-400">LULUS (TERSERTIFIKASI)</span> : <span className="text-amber-500">BELUM TERPENUHI</span>)
                      : (career.isTeknisiCertified ? <span className="text-emerald-400">LULUS (TERSERTIFIKASI)</span> : <span className="text-amber-500">BELUM TERPENUHI</span>)
                }
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Map and Interactive Cab Controls */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Leaflet map container (Map Latihan Sendiri - sepenuhnya offline client-side) */}
          <div className="bg-[#0e1628] rounded-xl border border-slate-800 flex flex-col overflow-hidden relative" style={{ height: '330px' }}>
            <div className="absolute top-2.5 left-2.5 z-[1000] bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded shadow text-[9.5px] font-mono flex items-center gap-1.5 backdrop-blur">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-400 font-extrabold uppercase">MAP LATIHAN MANDIRI (OFFLINE RECKONING)</span>
            </div>

            {/* Simulated Canvas Map container */}
            <div ref={localMapContainerRef} className="w-full h-full" id="local-training-map" />
          </div>

          {/* Interactive controls and state logs based on current training module */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col justify-between">
            
            <AnimatePresence mode="wait">
              
              {/* MASINIS VIEWPORT */}
              {activeTab === 'masinis' && (
                <motion.div key="masinis-controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 flex-1 justify-between">
                  {masinisState === 'idle' && (
                    <div className="text-center py-6 flex flex-col items-center gap-3">
                      <HelpCircle className="text-[#a5b4fc]" size={36} />
                      <p className="text-xs text-slate-400 max-w-md">
                        Lok CC 201 Trainer parkir di peron Stasiun Latihan A (KM 1.0). Pastikan sinyal rute aman dibuka sebelum melaju kencang ke Stasiun B.
                      </p>
                      <button
                        onClick={() => {
                          setMasinisState('running');
                          setMasinisPoints(100);
                          setMasinisS35Played(false);
                          setPjlHornDeducted(false);
                          setMasinisLogs(['INFO: Ujian Praktik Masinis dimulai! Kencangkan sabuk dinas anda. Setel Reverser ke F (Maju).']);
                          setMasinisTrain(t => ({
                            ...t,
                            kp: 1.0,
                            speed: 0,
                            reverser: 'N',
                            throttle: 0,
                            brake: 5
                          }));
                          setMasinisSignalColor(SignalColor.Red);
                          setMasinisS35Played(false);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black px-6 py-2.5 rounded text-[11px] tracking-wider transition-all"
                      >
                        MULAI PRAKTIK MENGEMUDI
                      </button>
                    </div>
                  )}

                  {masinisState === 'running' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Meter panel */}
                      <div className="md:col-span-4 bg-[#0a0e19] p-3 rounded-lg border border-slate-800 flex flex-col justify-between font-mono">
                        <div className="text-center border-b border-indigo-950 pb-2 mb-2">
                          <span className="text-[9px] text-slate-500 uppercase block">Speedometer</span>
                          <span className="text-xl font-black text-emerald-400">{Math.round(masinisTrain.speed)} KM/H</span>
                          <span className="text-[8px] text-slate-450 block">Batas Speed: {masinisSpeedLimit} km/h</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-500 block">Kilometer Post</span>
                            <span className="text-white font-bold block">KM {masinisTrain.kp.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Sinyal Blok</span>
                            <span className={`font-bold block ${masinisSignalColor === SignalColor.Red ? 'text-red-400' : 'text-emerald-400'}`}>{masinisSignalColor}</span>
                          </div>
                        </div>

                        {/* Request Signal Open once they are cautious near RED */}
                        <div className="mt-2 text-center">
                          <button
                            onClick={() => {
                              if (masinisTrain.kp >= 3.4 && masinisTrain.kp < 3.8 && masinisTrain.speed <= 20) {
                                setMasinisSignalColor(SignalColor.Green);
                                setMasinisLogs(prev => ['✓ BERHASIL MINTA ASPEK: PPKA Lokal mengizinkan rute masuk, Sinyal beralih HIJAU. Silakan melaju masinis!', ...prev]);
                                audio.playPJLBell(1.0);
                              } else {
                                setMasinisLogs(prev => ['❌ ASPEK DITOLAK: Anda wajib melambatkan laju lokomotif (< 20 kmH) di kawasan peringatan sinyal (KM 3.4-3.79) sebelum meminta aspek hijau!', ...prev]);
                              }
                            }}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-[9px] py-1 border border-indigo-800 text-indigo-400 font-bold rounded"
                          >
                            Minta Izin Sinyal Aman
                          </button>
                        </div>
                      </div>

                      {/* Notching tuas controllers */}
                      <div className="md:col-span-8 bg-[#0a0e1a] p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                        <div className="space-y-2 font-mono text-[11px]">
                          <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                            <span className="text-slate-400 text-[10px]">Tuas Reverser:</span>
                            <div className="flex gap-1">
                              {['F', 'N', 'R'].map(rev => (
                                <button
                                  key={rev}
                                  onClick={() => setMasinisTrain(t => ({ ...t, reverser: rev as any }))}
                                  className={`px-3 py-1 rounded text-[10px] font-bold ${
                                    masinisTrain.reverser === rev ? 'bg-indigo-600 text-white' : 'bg-[#0f1424] text-slate-500 hover:text-white'
                                  }`}
                                >
                                  {rev}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                            <span className="text-slate-400 text-[10px]">Tuas Tenaga (Throttle):</span>
                            <div className="flex gap-1.5">
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <button
                                  key={n}
                                  onClick={() => setMasinisTrain(t => ({ ...t, throttle: n }))}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                    masinisTrain.throttle === n ? 'bg-amber-500 text-slate-900' : 'bg-[#0f1424] text-slate-500 hover:text-white'
                                  }`}
                                >
                                  N{n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                            <span className="text-slate-400 text-[10px]">Tuas Rem Udara (Brake):</span>
                            <div className="flex gap-1.5">
                              {[0, 1, 2, 3, 4, 5].map(b => (
                                <button
                                  key={b}
                                  onClick={() => {
                                    setMasinisTrain(t => ({ ...t, brake: b }));
                                    if (b > 0) audio.playBrakeHiss();
                                  }}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                    masinisTrain.brake === b ? 'bg-cyan-500 text-slate-950' : 'bg-[#0f1424] text-slate-500 hover:text-white'
                                  }`}
                                >
                                  B{b}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              audio.playSemboyan35();
                              setMasinisS35Played(true);
                              setMasinisLogs(prev => ['🔊 Semboyan 35 Bergema! Anda telah membunyikan klakson lokomotif dengan sah.', ...prev]);
                            }}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-1.5 px-3 rounded font-mono text-[10.5px] uppercase tracking-wide cursor-pointer text-center"
                          >
                            📢 Bunyikan Semboyan 35
                          </button>

                          <button
                            onClick={() => {
                              setMasinisState('failed');
                              setMasinisLogs(prev => ['🚨 Anda menarik tuas REM DARURAT (Emergency)! Ujian dibatalkan.', ...prev]);
                              audio.playBrakeHiss();
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 px-3 rounded font-mono text-[10.5px] uppercase tracking-wide cursor-pointer"
                          >
                            Rem Darurat
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                  {masinisState === 'failed' && (
                    <div className="bg-red-950/25 border border-red-900 rounded p-4 text-center flex flex-col items-center gap-3">
                      <AlertTriangle className="text-red-500" size={32} />
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest leading-none">UJIAN GAGAL / INFRAKSI BERAT</h4>
                      <p className="text-[11px] text-slate-350 max-w-md">
                        Anda gagal melewati kriteria kemudi masinis diklat. Pastikan mematuhi batas kecepatan dan berhenti sebelum melanggar sinyal merah.
                      </p>
                      <button
                        onClick={() => setMasinisState('idle')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold font-mono px-5 py-2 rounded shadow"
                      >
                        SIAP ULANGI UJIAN
                      </button>
                    </div>
                  )}

                  {masinisState === 'success' && (
                    <div className="bg-emerald-950/25 border border-emerald-900 rounded p-4 text-center flex flex-col items-center gap-3">
                      <Award className="text-emerald-400 animate-bounce" size={36} />
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest leading-none">UJIAN MASINIS SELESAI</h4>
                      <p className="text-[11px] text-slate-350 max-w-md">
                        Sempurna! Anda berhasil membuktikan kecakapan pengereman halus di peron stasiun percontohan dan mematuhi rambu lintasan.
                      </p>
                      <button
                        onClick={() => claimTabCertificate('masinis')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black font-mono text-[11.5px] px-6 py-2.5 rounded shadow-lg flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck size={14} />
                        <span>KLAIM KOMPETENSI MASINIS & SAVE</span>
                      </button>
                    </div>
                  )}

                  {/* Logs tape feed */}
                  <div className="bg-[#070912] p-2.5 rounded border border-slate-900 h-[65px] overflow-y-auto font-mono text-[9px] leading-relaxed select-none">
                    {masinisLogs.map((log, i) => (
                      <div key={i} className={log.includes('✅') || log.includes('✓') ? 'text-emerald-400 font-bold' : log.includes('🚨') || log.includes('⚠️') ? 'text-red-400' : 'text-slate-400'}>
                        [LOG] {log}
                      </div>
                    ))}
                    {masinisLogs.length === 0 && <span className="text-slate-600 italic block">Menunggu inisiasi lokomotif pendorong...</span>}
                  </div>
                </motion.div>
              )}

              {/* PPKA VIEWPORT */}
              {activeTab === 'ppka' && (
                <motion.div key="ppka-controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 flex-1 justify-between">
                  
                  {ppkaState === 'idle' && (
                    <div className="text-center py-6 flex flex-col items-center gap-3">
                      <Shield className="text-[#a5b4fc]" size={36} />
                      <p className="text-xs text-slate-400 max-w-md">
                        Tugas PPKA: Pandu 3 kereta AI lokal berpapasan secara aman di daerah single track dengan wesel percontohan.
                      </p>
                      <button
                        onClick={() => {
                          setPpkaState('running');
                          setPpkaPoints(100);
                          setPpkaPjlClosed(true);
                          setPpkaLogs(['INFO: Skenario PPKA Latihan dimulai! 3 kereta AI lokal sedang bersiap dines...']);
                          setPpkaWesel1('straight');
                          setPpkaWesel2('straight');
                          setPpkaSignal1(SignalColor.Red);
                          setPpkaSignal2(SignalColor.Red);
                          setPpkaTimer(0);
                          setPpkaTrains([
                            { id: 'KA-AI-1', name: 'KA 1 Argo Latih (Hilir)', kp: 1.0, speed: 40, direction: LineDirection.Hilir, finished: false, stopTime: 0, status: 'SIAP' },
                            { id: 'KA-AI-2', name: 'KA 2 Argo Latih (Hulu)', kp: 4.0, speed: 40, direction: LineDirection.Hulu, finished: false, stopTime: 0, status: 'SIAP' },
                            { id: 'KA-AI-3', name: 'KA 3 Lokal Latih (Hilir)', kp: 1.0, speed: 40, direction: LineDirection.Hilir, finished: false, stopTime: 0, status: 'SIAP' }
                          ]);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black px-6 py-2.5 rounded text-[11px] tracking-wider transition-all"
                      >
                        JALANKAN LALU LINTAS SIMULATIVE
                      </button>
                    </div>
                  )}

                  {ppkaState === 'running' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 font-mono">
                      {/* Active dispatch levers */}
                      <div className="md:col-span-6 bg-[#0a0e19] p-3 rounded-lg border border-slate-800 space-y-2.5 text-[11px]">
                        <span className="text-[10px] text-slate-500 uppercase font-black block border-b border-indigo-950 pb-1">PANEL DISPATCH SELA</span>
                        
                        <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                          <div>
                            <span className="font-bold block text-slate-350">WESEL W-1 (KM 1.4)</span>
                            <span className="text-[8.5px] text-slate-500">Rute sepur belok loop</span>
                          </div>
                          <button
                            onClick={() => togglePpkaWesel(1)}
                            className={`px-3 py-1.5 text-[10px] font-black rounded ${
                              ppkaWesel1 === 'diverging' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ppkaWesel1 === 'straight' ? 'LURUS (Utama)' : 'BELOK (Siding 1)'}
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                          <div>
                            <span className="font-bold block text-slate-350">WESEL W-2 (KM 2.8)</span>
                            <span className="text-[8.5px] text-slate-500">Rute sepur belok loop</span>
                          </div>
                          <button
                            onClick={() => togglePpkaWesel(2)}
                            className={`px-3 py-1.5 text-[10px] font-black rounded ${
                              ppkaWesel2 === 'diverging' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {ppkaWesel2 === 'straight' ? 'LURUS (Utama)' : 'BELOK (Siding 2)'}
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                          <div>
                            <span className="font-bold block text-slate-350">SINYAL S-3 (KM 1.3)</span>
                            <span className="text-[8.5px] text-slate-500">Izin rute hilir arah selatan</span>
                          </div>
                          <button
                            onClick={() => {
                              const nextColor = ppkaSignal1 === SignalColor.Red ? SignalColor.Green : SignalColor.Red;
                              setPpkaSignal1(nextColor);
                              setPpkaLogs(l => [`Sinyal S-LATIHAN-03 beralih aspek ${nextColor}.`, ...l]);
                            }}
                            className={`px-3 py-1.5 text-[10px] font-black rounded ${
                              ppkaSignal1 === SignalColor.Green ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
                            }`}
                          >
                            {ppkaSignal1}
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                          <div>
                            <span className="font-bold block text-slate-350">SINYAL S-4 (KM 2.9)</span>
                            <span className="text-[8.5px] text-slate-500">Izin rute hulu arah utara</span>
                          </div>
                          <button
                            onClick={() => {
                              const nextColor = ppkaSignal2 === SignalColor.Red ? SignalColor.Green : SignalColor.Red;
                              setPpkaSignal2(nextColor);
                              setPpkaLogs(l => [`Sinyal S-LATIHAN-04 beralih aspek ${nextColor}.`, ...l]);
                            }}
                            className={`px-3 py-1.5 text-[10px] font-black rounded ${
                              ppkaSignal2 === SignalColor.Green ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
                            }`}
                          >
                            {ppkaSignal2}
                          </button>
                        </div>

                        <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                          <div>
                            <span className="font-bold block text-slate-350">PJL PALANG KM 2.0</span>
                            <span className="text-[8.5px] text-slate-500">Pintu sebidang jalan raya</span>
                          </div>
                          <button
                            onClick={() => {
                              const nextState = !ppkaPjlClosed;
                              setPpkaPjlClosed(nextState);
                              setPpkaLogs(l => [`Pintu perlintasan sebidang PJL KM 2.0 ${nextState ? 'DITUTUP AMAN 🔒' : 'DIBUKA BEBAS 🔓'}.`, ...l]);
                              if (nextState) {
                                audio.playPJLBell(1.0);
                              }
                            }}
                            className={`px-3 py-1.5 text-[10px] font-black rounded ${
                              ppkaPjlClosed ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
                            }`}
                          >
                            {ppkaPjlClosed ? 'TERTUTUP (AMAN)' : 'TERBUKA (BAHAYA)'}
                          </button>
                        </div>
                      </div>

                      {/* Tracks queue monitor */}
                      <div className="md:col-span-6 bg-[#0a0e1a] p-3 rounded-lg border border-slate-800 flex flex-col justify-between font-mono text-[10.5px]">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-black block border-b border-indigo-950 pb-1 mb-2">HEADWAY MONITOR</span>
                          <div className="space-y-2">
                            {ppkaTrains.map(t => (
                              <div key={t.id} className="p-1.5 bg-[#070912] rounded flex justify-between items-center border border-slate-900">
                                <div>
                                  <span className="font-bold text-white leading-none block">{t.name}</span>
                                  <span className="text-[8.5px] text-slate-500 block leading-none mt-1">KM {t.kp.toFixed(2)} • Speed: {t.speed} Kph</span>
                                </div>
                                <div className="text-right">
                                  <span className={`text-[8px] font-black px-1 rounded uppercase block leading-none ${
                                    t.finished ? 'bg-emerald-950 text-emerald-400' : t.speed === 0 ? 'bg-red-950 text-red-400 animate-pulse' : 'bg-indigo-950 text-indigo-400'
                                  }`}>{t.status}</span>
                                  {t.speed === 0 && !t.finished && <span className="text-[8.5px] text-amber-500 block">Pause: {t.stopTime}s</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-center text-[10px] text-slate-550 border-t border-indigo-950 pt-2 mt-2">
                          Timer Dines: <span className="text-white font-bold">{ppkaTimer} Seconds</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {ppkaState === 'failed' && (
                    <div className="bg-red-950/25 border border-red-900 rounded p-4 text-center flex flex-col items-center gap-3">
                      <AlertTriangle className="text-red-500" size={32} />
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest leading-none">UJIAN GAGAL / ACCIDENT</h4>
                      <p className="text-[11px] text-slate-350 max-w-sm">
                        Anda gagal mengurai antrean kereta AI di jalur tunggal. Wesel dilarang dipindahkan saat kereta melintas di atasnya (Deadly Movement).
                      </p>
                      <button
                        onClick={() => setPpkaState('idle')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold font-mono px-5 py-2 rounded shadow"
                      >
                        ULANGI SIMULASI PPKA
                      </button>
                    </div>
                  )}

                  {ppkaState === 'success' && (
                    <div className="bg-emerald-950/25 border border-emerald-900 rounded p-4 text-center flex flex-col items-center gap-3">
                      <Award className="text-emerald-400 animate-bounce" size={36} />
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest leading-none">UJIAN PPKA SELESAI</h4>
                      <p className="text-[11px] text-slate-350 max-w-md">
                        Sempurna! Anda berhasil memapaskan 3 kereta AI lokal dengan aman, melindungi wesel dari gerakan maut dan meloloskan uji kompetensi PPKA Utama.
                      </p>
                      <button
                        onClick={() => claimTabCertificate('ppka')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black font-mono text-[11.5px] px-6 py-2.5 rounded shadow-lg flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck size={14} />
                        <span>KLAIM KOMPETENSI PPKA & SAVE</span>
                      </button>
                    </div>
                  )}

                  {/* Logs tape feed */}
                  <div className="bg-[#070912] p-2.5 rounded border border-slate-900 h-[65px] overflow-y-auto font-mono text-[9px] leading-relaxed select-none">
                    {ppkaLogs.map((log, i) => (
                      <div key={i} className={log.includes('✅') || log.includes('✓') ? 'text-emerald-400 font-bold' : log.includes('🚨') ? 'text-red-400' : 'text-sky-400'}>
                        [PPKA] {log}
                      </div>
                    ))}
                    {ppkaLogs.length === 0 && <span className="text-slate-650 italic block">Menunggu PPKA menyalakan sinyal keberangkatan...</span>}
                  </div>

                </motion.div>
              )}

              {/* TEKNISI VIEWPORT */}
              {activeTab === 'teknisi' && (
                <motion.div key="teknisi-controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 flex-1 justify-between">
                  
                  {teknisiState === 'idle' && (
                    <div className="text-center py-6 flex flex-col items-center gap-3">
                      <Wrench className="text-[#a5b4fc]" size={36} />
                      <p className="text-xs text-slate-450 max-w-sm">
                        Sebuah rangkaian tabrakan simulative terjadi di KM 2.20. Kendarai Lori LRT-01 dari Depot Latihan (KM 0.20), lakukan kopling jarak dekat, dan kembalikan ke Stasiun A.
                      </p>
                      <button
                        onClick={() => {
                          setTeknisiState('running');
                          setTeknisiPoints(100);
                          setTeknisiStartTime(Date.now());
                          setTeknisiLogs(['INFO: Ujian Rescue & Towing dimulai! Nyalakan Throttle F Maju, kendarai Lori ke lokasi KM 2.20.']);
                          setTeknisiLori(t => ({
                            ...t,
                            kp: 0.20,
                            speed: 0,
                            reverser: 'N',
                            throttle: 0,
                            brake: 5
                          }));
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black px-6 py-2.5 rounded text-[11px] tracking-wider transition-all"
                      >
                        MULAI EVAKUASI KOMPETENSI
                      </button>
                    </div>
                  )}

                  {(teknisiState === 'running' || teknisiState === 'coupled') && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 font-mono">
                      {/* Controls and telemetry */}
                      <div className="md:col-span-5 bg-[#0a0e19] p-3 rounded-lg border border-slate-800 text-[10.5px]">
                        <span className="text-[10px] text-slate-500 block border-b border-indigo-950 pb-1 mb-2 font-black uppercase">TELEMETRI LORI RESCUE</span>
                        <div className="space-y-1">
                          <div className="flex justify-between border-b border-slate-900 py-1 font-bold">
                            <span>Posisi Lori:</span>
                            <span className="text-white">KM {teknisiLori.kp.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900 py-1 font-bold">
                            <span>Speedometer:</span>
                            <span className="text-amber-500">{Math.round(teknisiLori.speed)} KM/H</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900 py-1 font-bold">
                            <span>Jarak ke KM 2.20:</span>
                            <span className="text-white">{(Math.abs(teknisiLori.kp - 2.20) * 1000).toFixed(0)} Meter</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-900 py-1 font-bold font-extrabold text-blue-300">
                            <span>Kabel Pengait:</span>
                            <span>{teknisiState === 'coupled' ? 'TERKUNCI (Coupled)' : 'TERLEPAS (Decoupled)'}</span>
                          </div>
                        </div>

                        {/* Tactical control actions */}
                        <div className="mt-4 flex flex-col gap-2">
                          {teknisiState === 'running' ? (
                            <button
                              onClick={handleCouplingDinas}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2 rounded text-center text-[10.5px] uppercase cursor-pointer"
                            >
                              🔗 Hubungkan Kopling (&lt;10 M)
                            </button>
                          ) : (
                            <button
                              onClick={handleDeliverTowedTrain}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2 rounded text-center text-[10.5px] uppercase cursor-pointer"
                            >
                              🎁 Selesaikan Dinas Evakuasi (Stn A)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notching tuas */}
                      <div className="md:col-span-7 bg-[#0a0e19] p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                        <div className="space-y-2 text-[11px]">
                          <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                            <span className="text-slate-400 text-[10px]">Tuas Reverser:</span>
                            <div className="flex gap-1">
                              {['F', 'N', 'R'].map(rev => (
                                <button
                                  key={rev}
                                  onClick={() => setTeknisiLori(t => ({ ...t, reverser: rev as any }))}
                                  className={`px-3 py-1 rounded text-[10px] font-bold ${
                                    teknisiLori.reverser === rev ? 'bg-indigo-600 text-white' : 'bg-[#0f1424] text-slate-500 hover:text-white'
                                  }`}
                                >
                                  {rev}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                            <span className="text-slate-400 text-[10px]">Tuas Tenaga (Throttle):</span>
                            <div className="flex gap-1">
                              {[0, 1, 2, 3, 4, 5].map(n => (
                                <button
                                  key={n}
                                  onClick={() => setTeknisiLori(t => ({ ...t, throttle: n }))}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                    teknisiLori.throttle === n ? 'bg-amber-500 text-slate-900' : 'bg-[#0f1424] text-slate-500 hover:text-white'
                                  }`}
                                >
                                  N{n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-[#070912] p-1.5 rounded">
                            <span className="text-slate-400 text-[10px]">Tuas Rem:</span>
                            <div className="flex gap-1">
                              {[0, 1, 2, 3, 4, 5].map(b => (
                                <button
                                  key={b}
                                  onClick={() => {
                                    setTeknisiLori(t => ({ ...t, brake: b }));
                                    if (b > 0) audio.playBrakeHiss();
                                  }}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                    teknisiLori.brake === b ? 'bg-cyan-500 text-slate-950' : 'bg-[#0f1424] text-slate-500 hover:text-white'
                                  }`}
                                >
                                  B{b}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="text-center mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              audio.playSemboyan35();
                            }}
                            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wide cursor-pointer flex-1 text-center"
                          >
                            Bunyikan S-35
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                  {teknisiState === 'failed' && (
                    <div className="bg-red-950/25 border border-red-900 rounded p-4 text-center flex flex-col items-center gap-3">
                      <AlertTriangle className="text-red-500" size={32} />
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest leading-none">UJIAN GAGAL</h4>
                      <p className="text-[11px] text-slate-350 max-w-sm">
                        Anda gagal mengemudikan lori penyelamat secara tertib. Kopling dilarang diikat kencang melebihi batas 30 km/jam saat evakuasi.
                      </p>
                      <button
                        onClick={() => setTeknisiState('idle')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold font-mono px-5 py-2 rounded shadow"
                      >
                        SIAP ULANGI TEKNISI EXAM
                      </button>
                    </div>
                  )}

                  {teknisiState === 'success' && (
                    <div className="bg-emerald-950/25 border border-emerald-950 rounded p-4 text-center flex flex-col items-center gap-3">
                      <Award className="text-emerald-400 animate-bounce" size={36} />
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest leading-none">UJIAN EVAKUASI SELESAI</h4>
                      <p className="text-[11px] text-slate-350 max-w-sm font-sans">
                        Sempurna! Anda lolos sertifikasi rescue towing, menunjuk presisi lori pengait dan batas towing kecepatan evakuasi yang sah.
                      </p>
                      <button
                        onClick={() => claimTabCertificate('teknisi')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black font-mono text-[11.5px] px-6 py-2.5 rounded shadow-lg flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck size={14} />
                        <span>KLAIM KOMPETENSI RESCUE & SAVE</span>
                      </button>
                    </div>
                  )}

                  {/* Logs tape feed */}
                  <div className="bg-[#070912] p-2.5 rounded border border-slate-900 h-[65px] overflow-y-auto font-mono text-[9px] leading-relaxed select-none">
                    {teknisiLogs.map((log, i) => (
                      <div key={i} className={log.includes('✅') || log.includes('🔗') ? 'text-emerald-400 font-bold' : log.includes('💥') || log.includes('❌') ? 'text-red-400 font-bold' : 'text-slate-400'}>
                        [LOG] {log}
                      </div>
                    ))}
                    {teknisiLogs.length === 0 && <span className="text-slate-650 italic block">Menunggu mobilisasi lori penyelamat...</span>}
                  </div>

                </motion.div>
              )}

            </AnimatePresence>

          </div>

        </div>

      </div>

    </div>
  );
}
