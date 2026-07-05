import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Train, SignalBlock, PJLCrossing, LineDirection, SignalColor, Station, SwitchWesel, TrainType } from '../types';
import { STATIONS, getLatLngFromKp, getBearingAtKp } from '../data/tracks';
import { Compass, Eye, Maximize2, Layers, MapPin, Radio, EyeOff, Navigation } from 'lucide-react';
import { renderTrains, preloadTrainSprites } from '../utils/trainRenderer';

interface RealWorldMapProps {
  activeTrain?: Train | null; // The train currently driven by this user (if in masinis mode)
  trains: Train[]; // All trains in the world
  signals: SignalBlock[];
  pjls: PJLCrossing[];
  switches?: SwitchWesel[];
  onSignalToggle?: (sigId: string) => void;
  onPjlToggle?: (pjlId: string) => void;
  onSwitchToggle?: (switchId: string, state: 'straight' | 'diverging') => void;
  selectedZone?: number;
  // KP presisi untuk teleport peta (mis. lokasi stasiun otoritas PPKA). Jika diisi, prioritas
  // lebih tinggi daripada pusat zona default dari selectedZone.
  focusKp?: number;
  isPerformanceMode?: boolean;
}

type MapTheme = 'cyber' | 'satellite';
type MapViewMode = 'cabin' | 'north-up' | 'pan';

// Snapshot of a train's last known authoritative kinematics, used to extrapolate
// a smooth visual position on every animation frame in between server/state ticks.
// NOTE: This is a DISPLAY-ONLY smoothing layer. It never touches train.kp itself,
// never feeds back into physics/collision logic, and the server/authoritative tick
// rate (300ms local reckoning / 1s AI tick) is completely untouched.
interface TrainKinematicsSnapshot {
  kp: number;
  speed: number; // km/h
  direction: LineDirection;
  ts: number; // performance.now() timestamp of when this snapshot was captured
}

const MAX_CARS_RENDERED = 4;
// Cap how far we're willing to extrapolate ahead of the last known tick, so that if
// updates stall (tab backgrounded, network hiccup, train stopped/collided) we don't
// let the visual position run away from reality.
const MAX_EXTRAPOLATION_SECONDS = 1.2;

/**
 * Computes the geographic coordinates + bearing for a specific coupled car (idx)
 * given the locomotive's head kp/direction. idx 0 = locomotive/head car.
 * Pure function, no React/DOM dependency, so it can be called every animation frame
 * cheaply for smoothing without re-touching Leaflet icons.
 */
function computeCarPosition(kp: number, direction: LineDirection, idx: number): { coords: [number, number]; bearing: number } {
  if (idx === 0) {
    return { coords: getLatLngFromKp(kp, direction), bearing: getBearingAtKp(kp, direction) };
  }

  // Backward tracing algorithm that maintains absolute geographic distance (~23m physical spacing on Leaflet stage)
  const targetDist = idx * 0.00021; // ~23 meters in degrees equivalent
  const isHilir = direction === LineDirection.Hilir;

  let currentKp = kp;
  let accumulatedDist = 0;
  let lastCoords = getLatLngFromKp(kp, direction);

  const step = 0.0012; // step of about 0.8 meters
  const maxIterations = 80;
  let iterations = 0;

  let coords = getLatLngFromKp(kp, direction); // pre-fallback
  let bearing = getBearingAtKp(kp, direction); // pre-fallback

  while (accumulatedDist < targetDist && iterations < maxIterations) {
    iterations++;
    if (isHilir) {
      currentKp -= step;
    } else {
      currentKp += step;
    }

    if (currentKp < 0 || currentKp > 54.82) {
      break;
    }

    const nextCoords = getLatLngFromKp(currentKp, direction);
    const dy = nextCoords[0] - lastCoords[0];
    const dx = nextCoords[1] - lastCoords[1];
    const stepDist = Math.sqrt(dy * dy + dx * dx);

    accumulatedDist += stepDist;
    if (accumulatedDist >= targetDist) {
      const overshoot = accumulatedDist - targetDist;
      const t = stepDist > 0 ? (stepDist - overshoot) / stepDist : 0;
      coords = [
        lastCoords[0] + dy * t,
        lastCoords[1] + dx * t
      ];
      bearing = getBearingAtKp(currentKp, direction);
      break;
    }
    lastCoords = nextCoords;
  }

  return { coords, bearing };
}

export default function RealWorldMap({
  activeTrain,
  trains,
  signals,
  pjls,
  switches,
  onSignalToggle,
  onPjlToggle,
  onSwitchToggle,
  selectedZone,
  focusKp,
  isPerformanceMode = false
}: RealWorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // States
  const [theme, setTheme] = useState<MapTheme>('cyber');
  const [viewMode, setViewMode] = useState<MapViewMode>(activeTrain ? 'cabin' : 'north-up');
  const [folowActiveTrain, setFollowActiveTrain] = useState<boolean>(true);
  const [currentZoom, setCurrentZoom] = useState<number>(18);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [perfMode, setPerfMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rrsid_perf_mode') === 'true' || window.innerWidth < 768;
    }
    return false;
  });

  // Preload sprites on mount
  useEffect(() => {
    preloadTrainSprites();
  }, []);

  // Synchronise prop updates to local state
  useEffect(() => {
    if (isPerformanceMode !== undefined) {
      setPerfMode(isPerformanceMode);
    }
  }, [isPerformanceMode]);

  // Redraw tracks and stations dynamically when performance mode changes
  useEffect(() => {
    if (!isMapReady) return;
    drawStaticTracks();
    drawStations();
  }, [perfMode, isMapReady]);

  // Layer groups references for dynamic updates (no full re-creation of leaflet maps)
  const trackGroupRef = useRef<L.FeatureGroup | null>(null);
  const stationGroupRef = useRef<L.FeatureGroup | null>(null);
  const signalGroupRef = useRef<L.FeatureGroup | null>(null);
  const pjlGroupRef = useRef<L.FeatureGroup | null>(null);
  const switchGroupRef = useRef<L.FeatureGroup | null>(null);
  const rambuGroupRef = useRef<L.FeatureGroup | null>(null);
  const trainMarkersRef = useRef<Record<string, L.Marker[]>>({});
  const tilesRef = useRef<L.TileLayer | null>(null);
  // Display-only smoothing state: last known authoritative kp/speed/direction per train,
  // extrapolated every animation frame so movement looks fluid even though the underlying
  // server/state tick only arrives every ~300ms (or 1s for AI trains).
  const kinematicsRef = useRef<Record<string, TrainKinematicsSnapshot>>({});

  // Inject Leaflet CDN CSS on mount
  useEffect(() => {
    const linkId = 'leaflet-cdn-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use Depok or active train as fallback starting coordinate
    const initialCoords: [number, number] = activeTrain 
      ? getLatLngFromKp(activeTrain.kp, activeTrain.direction)
      : [-6.4058, 106.8211]; // Depok Base

    const map = L.map(mapContainerRef.current, {
      center: initialCoords,
      zoom: currentZoom,
      zoomControl: false, // Custom controls
      maxZoom: 20,
      minZoom: 10,
      attributionControl: false
    });

    mapRef.current = map;

    // Add Tile layer
    const tileUrl = theme === 'cyber'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    
    const tileLayer = L.tileLayer(tileUrl, { maxZoom: 20 });
    tileLayer.addTo(map);
    tilesRef.current = tileLayer;

    // Initialize layer groups
    trackGroupRef.current = L.featureGroup().addTo(map);
    stationGroupRef.current = L.featureGroup().addTo(map);
    signalGroupRef.current = L.featureGroup().addTo(map);
    pjlGroupRef.current = L.featureGroup().addTo(map);
    switchGroupRef.current = L.featureGroup().addTo(map);
    rambuGroupRef.current = L.featureGroup().addTo(map);

    // Render geographic tracks polylines
    drawStaticTracks();
    drawStations();

    setIsMapReady(true);

    // Set initial viewmode to cabin if activeTrain exists
    if (activeTrain) {
      setViewMode('cabin');
    }

    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  // Handle Map zoom change
  useEffect(() => {
    if (mapRef.current && isMapReady) {
      mapRef.current.setZoom(currentZoom);
    }
  }, [currentZoom, isMapReady]);

  // Handle Theme Toggle
  useEffect(() => {
    if (!mapRef.current || !tilesRef.current || !isMapReady) return;

    const tileUrl = theme === 'cyber'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    tilesRef.current.setUrl(tileUrl);
    // Redraw static tracks to match the updated background theme contrast
    drawStaticTracks();
  }, [theme, isMapReady]);

  // Handle auto-pan/teleport to the PPKA's assigned authority (station or zone) whenever it
  // changes - e.g. right after picking PK/PPKA Stasiun in the authority gate.
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    if (focusKp !== undefined) {
      // Otoritas PPKA Stasiun: teleport presisi ke KP stasiun, zoom lebih dekat.
      const stationCoords = getLatLngFromKp(focusKp);
      mapRef.current.setView(stationCoords, 15, { animate: true });
      return;
    }

    if (!selectedZone) return;

    // Otoritas PK: teleport ke titik tengah zona (semua stasiun di zona tsb terlihat).
    let targetZoneKp = 5.0; // Zone 1 center (Jakarta Kota - Manggarai)
    if (selectedZone === 2) targetZoneKp = 20.0; // Zone 2 center (Tebet - Depok)
    else if (selectedZone === 3) targetZoneKp = 48.0; // Zone 3 center (Citayam - Bogor)
    else if (selectedZone === 4) targetZoneKp = 6.5; // Zone 4 center (Lingkar Pasar Senen)

    const targetCoords = getLatLngFromKp(targetZoneKp);
    mapRef.current.setView(targetCoords, 14, { animate: true }); // zoom out slightly so they can view the entire sector
  }, [selectedZone, focusKp, isMapReady]);

  // Render static physical tracks polylines matching real world 1:1
  const drawStaticTracks = () => {
    const trackGroup = trackGroupRef.current;
    if (!trackGroup) return;

    trackGroup.clearLayers();

    // Custom tangent-aware offset calculator
    const getOffsetCoords = (kp: number, offsetAmount: number) => {
      const coordBase = getLatLngFromKp(kp);
      const nextKp = Math.min(54.8, kp + 0.01);
      const coordNext = getLatLngFromKp(nextKp);
      
      const dLat = coordNext[0] - coordBase[0];
      const dLng = coordNext[1] - coordBase[1];
      const len = Math.sqrt(dLat * dLat + dLng * dLng);
      
      if (len > 0) {
        const pX = -dLng / len;
        const pY = dLat / len;
        return [
          coordBase[0] + pX * offsetAmount,
          coordBase[1] + pY * offsetAmount
        ] as [number, number];
      }
      return coordBase;
    };

    // Sample coordinates along Hulu & Hilir main rails
    const huluCoords: [number, number][] = [];
    const hilirCoords: [number, number][] = [];

    // Increase sampling resolution for ultra-smooth curves (optimized in performance mode)
    const samplingStep = perfMode ? 0.05 : 0.02;
    for (let kp = 0; kp <= 54.81; kp += samplingStep) {
      huluCoords.push(getOffsetCoords(kp, 0.000045));
      hilirCoords.push(getOffsetCoords(kp, -0.000045));
    }

    // --- Hulu Track (Up Track) drawing layers ---
    if (!perfMode) {
      // 1. Dark ballast backing structure
      L.polyline(huluCoords, {
        color: theme === 'cyber' ? '#1e293b' : '#334155',
        weight: 5.5,
        opacity: 0.85
      }).addTo(trackGroup);

      // 2. Concrete/wooden sleeper ties
      L.polyline(huluCoords, {
        color: theme === 'cyber' ? '#475569' : '#cbd5e1',
        weight: 4,
        opacity: 0.8,
        dashArray: '2, 5'
      }).addTo(trackGroup);
    }

    // 3. Dual steel rails (Hulu - Blue colored accent)
    L.polyline(huluCoords, {
      color: theme === 'cyber' ? '#3b82f6' : '#2563eb',
      weight: perfMode ? 1.8 : 1.2,
      opacity: 1
    }).addTo(trackGroup);


    // --- Hilir Track (Down Track) drawing layers ---
    if (!perfMode) {
      // 1. Dark ballast backing structure
      L.polyline(hilirCoords, {
        color: theme === 'cyber' ? '#1c1917' : '#1c1917',
        weight: 5.5,
        opacity: 0.85
      }).addTo(trackGroup);

      // 2. Concrete/wooden sleeper ties
      L.polyline(hilirCoords, {
        color: theme === 'cyber' ? '#44403c' : '#d6d3d1',
        weight: 4,
        opacity: 0.8,
        dashArray: '2, 5'
      }).addTo(trackGroup);
    }

    // 3. Dual steel rails (Hilir - Amber/Orange colored accent)
    L.polyline(hilirCoords, {
      color: theme === 'cyber' ? '#fbbf24' : '#d97706',
      weight: perfMode ? 1.8 : 1.2,
      opacity: 1
    }).addTo(trackGroup);


    // --- Dynamic Station Siding & Crossover (Switch) Track Overlays ---
    STATIONS.forEach(station => {
      const isTerminalStart = station.kp <= 0.1; // Jakarta Kota range
      const isTerminalEnd = station.kp >= 54.7;   // Bogor range
      
      const kpStart = isTerminalStart ? 0.0 : station.kp - 0.12;
      const kpEnd = isTerminalEnd ? 54.8 : station.kp + 0.12;
      
      const tracksCount = station.tracks.length;
      
      station.tracks.forEach((track, idx) => {
        // Space parallel tracks beautifully & align perfectly with the main lines
        const isHulu = track.direction === LineDirection.Hulu;
        const isHilir = track.direction === LineDirection.Hilir;
        let offsetAmount = 0;

        if (isHulu) {
          const huluTracks = station.tracks.filter(t => t.direction === LineDirection.Hulu);
          const huluIdx = huluTracks.findIndex(t => t.id === track.id);
          offsetAmount = huluTracks.length === 1 ? 0.000045 : 0.000045 + huluIdx * 0.000035;
        } else if (isHilir) {
          const hilirTracks = station.tracks.filter(t => t.direction === LineDirection.Hilir);
          const hilirIdx = hilirTracks.findIndex(t => t.id === track.id);
          offsetAmount = hilirTracks.length === 1 ? -0.000045 : -0.000045 - hilirIdx * 0.000035;
        } else {
          // Terminal stations with direction 'Both'
          const offsetFactor = idx - (tracksCount - 1) / 2;
          offsetAmount = offsetFactor * 0.000045;
        }
        
        // Sample coords specifically for this platform track
        const trackCoords: [number, number][] = [];
        for (let kp = kpStart; kp <= kpEnd; kp += 0.01) {
          trackCoords.push(getOffsetCoords(kp, offsetAmount));
        }
        if (trackCoords.length > 0 && Math.abs(kpEnd - kpEnd) > 0.001) {
          trackCoords.push(getOffsetCoords(kpEnd, offsetAmount));
        }

        // Draw station/siding platform track visual layers
        // Ballast backing
        L.polyline(trackCoords, {
          color: theme === 'cyber' ? '#1e293b' : '#1e3a8a',
          weight: 4.5,
          opacity: 0.9
        }).addTo(trackGroup);

        // Sleepers
        L.polyline(trackCoords, {
          color: theme === 'cyber' ? '#475569' : '#cbd5e1',
          weight: 3.5,
          opacity: 0.85,
          dashArray: '2, 3'
        }).addTo(trackGroup);

        // Steel Rails
        L.polyline(trackCoords, {
          color: theme === 'cyber' ? '#a5b4fc' : '#c7d2fe',
          weight: 1.2,
          opacity: 1
        }).addTo(trackGroup);

        // Crossovers (Diagonal switches connecting siding rails to main Hulu/Hilir rails)
        const mainOffset = offsetAmount >= 0 ? 0.000045 : -0.000045;
        const isSiding = Math.abs(offsetAmount - mainOffset) > 0.00001;

        if (isSiding) {
          // Entry transition
          if (!isTerminalStart) {
            const entryCrossover = [
              getOffsetCoords(kpStart - 0.04, mainOffset),
              getOffsetCoords(kpStart, offsetAmount)
            ];
            L.polyline(entryCrossover, {
              color: theme === 'cyber' ? '#10b981' : '#059669',
              weight: 2,
              opacity: 0.95,
              dashArray: '2, 3'
            }).addTo(trackGroup);
          }

          // Exit transition
          if (!isTerminalEnd) {
            const exitCrossover = [
              getOffsetCoords(kpEnd, offsetAmount),
              getOffsetCoords(kpEnd + 0.04, mainOffset)
            ];
            L.polyline(exitCrossover, {
              color: theme === 'cyber' ? '#10b981' : '#059669',
              weight: 2,
              opacity: 0.95,
              dashArray: '2, 3'
            }).addTo(trackGroup);
          }
        }
      });
    });
  };

  // Draw Station hubs with physical perons (platforms)
  const drawStations = () => {
    const stationGroup = stationGroupRef.current;
    if (!stationGroup) return;

    stationGroup.clearLayers();

    // Helper to get offset coordinate from the centerline tangent
    const getOffsetCoords = (kp: number, offsetAmount: number) => {
      const coordBase = getLatLngFromKp(kp);
      const nextKp = Math.min(54.8, kp + 0.01);
      const coordNext = getLatLngFromKp(nextKp);
      
      const dLat = coordNext[0] - coordBase[0];
      const dLng = coordNext[1] - coordBase[1];
      const len = Math.sqrt(dLat * dLat + dLng * dLng);
      
      if (len > 0) {
        const pX = -dLng / len;
        const pY = dLat / len;
        return [
          coordBase[0] + pX * offsetAmount,
          coordBase[1] + pY * offsetAmount
        ] as [number, number];
      }
      return coordBase;
    };

    STATIONS.forEach(station => {
      const coords = getLatLngFromKp(station.kp);

      // Draw physical platforms (Peron) for the station layout
      // Platforms are typically ~130 meters in length (0.13 km range around station.kp)
      const kpStart = station.kp - 0.055;
      const kpEnd = station.kp + 0.055;

      const platforms = [
        { name: 'Peron Hulu', offset: 0.000085 },
        { name: 'Peron Hilir', offset: -0.000085 }
      ];

      platforms.forEach(plat => {
        const platCoords: [number, number][] = [];
        for (let kp = kpStart; kp <= kpEnd; kp += 0.01) {
          platCoords.push(getOffsetCoords(kp, plat.offset));
        }
        if (platCoords.length > 0) {
          if (!perfMode) {
            // 1. Underlayer: Bright yellow tactile safety line border representing the platform edge
            L.polyline(platCoords, {
              color: '#eab308', // Amber-500
              weight: 7.5,
              opacity: 0.95
            }).addTo(stationGroup);
          }

          // 2. Overlayer: Concrete gray color representing the platform slab itself
          L.polyline(platCoords, {
            color: '#475569', // Slate-600 concrete
            weight: perfMode ? 3.0 : 5.0,
            opacity: 1
          }).addTo(stationGroup);

          if (!perfMode) {
            // 3. Top detail: Dashed dark safety board guidelines on the peron floor
            L.polyline(platCoords, {
              color: '#1e293b',
              weight: 1.0,
              opacity: 0.7,
              dashArray: '3, 5'
            }).addTo(stationGroup);
          }
        }
      });

      // Unique custom station nodes html
      const stationIcon = L.divIcon({
        className: 'custom-station-icon',
        html: `
          <div class="flex flex-col items-center justify-center">
            <div class="w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <div class="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
            </div>
            <div class="absolute top-4 bg-[#0a0f1d]/90 border border-slate-700/60 px-1.5 py-0.5 rounded text-[8px] font-mono font-black text-slate-100 uppercase tracking-tight whitespace-nowrap shadow shadow-black">
              ${station.name}
            </div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      L.marker(coords, { icon: stationIcon })
        .bindTooltip(`<strong>STASIUN ${station.name.toUpperCase()}</strong><br/>KM Post: ${station.kp.toFixed(2)}<br/>Status Peron: TERSEDIA (Aman)`, { direction: 'top' })
        .addTo(stationGroup);
    });
  };

  // Synchronize Signals and Level crossings on active tick updates
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // 1. Render PJL Level barriers
    const pjlGroup = pjlGroupRef.current;
    if (pjlGroup) {
      pjlGroup.clearLayers();
      pjls.forEach(p => {
        const coords = getLatLngFromKp(p.kp);
        const pjlIcon = L.divIcon({
          className: 'pjl-marker',
          html: `
            <div class="flex flex-col items-center">
              <div class="w-4 h-4 rounded border-2 flex items-center justify-center text-[7px] font-black ${
                p.isClosed 
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-400' 
                  : 'bg-red-950 border-red-500 text-red-400 animate-pulse'
              }">
                門
              </div>
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const m = L.marker(coords, { icon: pjlIcon });
        m.bindTooltip(`<strong>PJL: ${p.name}</strong><br/>Status: ${p.isClosed ? 'AMAN (Tertutup)' : 'BAHAYA (Terbuka!)'}`);
        if (onPjlToggle) {
          m.on('click', () => onPjlToggle(p.id));
        }
        m.addTo(pjlGroup);
      });
    }

    // 2. Render Signaling blocks
    const signalGroup = signalGroupRef.current;
    if (signalGroup) {
      signalGroup.clearLayers();
      signals.forEach(sig => {
        // Offset signals slightly based on hulu/hilir direction for legibility
        const coords = getLatLngFromKp(sig.kp, sig.direction);
        const colorHex = sig.color === SignalColor.Red ? '#ef4444' : sig.color === SignalColor.Yellow ? '#f59e0b' : '#10b981';
        
        const signalIcon = L.divIcon({
          className: 'signal-marker',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-2.5 h-2.5 rounded-full ${sig.color === SignalColor.Red ? 'bg-red-950 border-2 border-red-500' : sig.color === SignalColor.Yellow ? 'bg-amber-950 border-2 border-amber-500' : 'bg-emerald-950 border-2 border-emerald-500'} flex items-center justify-center">
                <div class="w-1.5 h-1.5 rounded-full animate-ping" style="background-color: ${colorHex}"></div>
              </div>
              <div class="absolute -top-3.5 bg-slate-900 border border-slate-800 text-[6px] text-slate-400 px-0.5 font-mono uppercase rounded scale-75 whitespace-nowrap">
                ${sig.direction === LineDirection.Hulu ? 'Hulu' : 'Hilir'}
              </div>
            </div>
          `,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const m = L.marker(coords, { icon: signalIcon });
        m.bindTooltip(`Signal: ${sig.id}<br/>Color: ${sig.color}`);
        if (onSignalToggle) {
          m.on('click', () => onSignalToggle(sig.id));
        }
        m.addTo(signalGroup);
      });
    }

    // 3. Render Switches/Wesel on Leaflet map
    const switchGroup = switchGroupRef.current;
    if (switchGroup && switches) {
      switchGroup.clearLayers();
      switches.forEach(sw => {
        const coords = getLatLngFromKp(sw.kp, sw.direction);
        const isActive = sw.state === 'diverging';

        const switchIcon = L.divIcon({
          className: 'switch-marker',
          html: `
            <div class="relative flex flex-col items-center justify-center cursor-pointer">
              <div class="w-4.5 h-4.5 rounded-full border-2 bg-slate-950 flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                isActive ? 'border-amber-500 bg-amber-950 text-amber-400' : 'border-emerald-500 bg-emerald-950 text-emerald-400'
              }">
                <span class="text-[8px] font-black leading-none font-mono tracking-tighter block relative ${isActive ? 'rotate-45' : 'rotate-0'}">
                  ${isActive ? '➔' : '↑'}
                </span>
              </div>
              <div class="absolute -bottom-3 bg-slate-900 border border-slate-700 text-[6px] text-slate-200 px-1 font-mono rounded scale-75 whitespace-nowrap shadow">
                W-${sw.id.split('-').pop()}
              </div>
            </div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        const m = L.marker(coords, { icon: switchIcon });
        m.bindTooltip(`<strong>Wesel: ${sw.id}</strong><br/>Posisi: ${sw.state === 'straight' ? 'Sepur Lurus (Straight)' : 'Sepur Belok (Diverging)'}<br/>KM Post: ${sw.kp.toFixed(2)}`);
        
        if (onSwitchToggle) {
          m.on('click', () => {
            const nextState = sw.state === 'straight' ? 'diverging' : 'straight';
            onSwitchToggle(sw.id, nextState);
          });
        }
        m.addTo(switchGroup);
      });
    }

    // 4. Render Speed Limit Signs (Rambu Batas Kecepatan Semboyan 2A / 2B)
    const rambuGroup = rambuGroupRef.current;
    if (rambuGroup) {
      rambuGroup.clearLayers();
      const RAMBUS = [
        { kp: 0.5, speed: 30, desc: 'Batas Kiri Jakarta Kota' },
        { kp: 9.2, speed: 45, desc: 'Semboyan Manggarai Gwesel' },
        { kp: 10.6, speed: 90, desc: 'Batas Bebas Manggarai' },
        { kp: 31.8, speed: 60, desc: 'Semboyan Depok' },
        { kp: 33.6, speed: 90, desc: 'Batas Lintas Depok' },
        { kp: 39.8, speed: 70, desc: 'Lengkung Sektor Bogor' },
        { kp: 48.2, speed: 90, desc: 'Batas Lintas Bogor' },
        { kp: 53.5, speed: 30, desc: 'Batasan Bogor Terminal' }
      ];

      RAMBUS.forEach(ram => {
        const coords = getLatLngFromKp(ram.kp);
        const rambuIcon = L.divIcon({
          className: 'rambu-marker',
          html: `
            <div class="relative flex flex-col items-center justify-center">
              <div class="w-4 h-4 rounded-full border border-yellow-500 bg-white shadow-md flex items-center justify-center">
                <span class="text-slate-950 font-black text-[8px] font-mono leading-none tracking-tighter">${ram.speed}</span>
              </div>
              <div class="w-0.5 h-1.5 bg-slate-500 shadow"></div>
              <div class="absolute -top-3.5 bg-slate-950 border border-amber-500 text-[5.5px] text-amber-400 px-0.5 font-mono rounded scale-75 whitespace-nowrap shadow">
                R-${ram.speed}
              </div>
            </div>
          `,
          iconSize: [16, 22],
          iconAnchor: [8, 16]
        });

        const m = L.marker(coords, { icon: rambuIcon });
        m.bindTooltip(`<strong>Rambu Batas Kecepatan (Semboyan 2A/2B)</strong><br/>Max Kecepatan: ${ram.speed} KM/H<br/>${ram.desc}`);
        m.addTo(rambuGroup);
      });
    }

  }, [signals, pjls, switches, isMapReady]);

  // Physics update interval: Render top-down coupled train models
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Use a cached dictionary structure for high-performance updates
    const markerCache = trainMarkersRef.current as unknown as Record<string, L.Marker>;
    const activeKeysOnThisTick = new Set<string>();

    // Record the authoritative kinematics snapshot for smooth frame-by-frame extrapolation.
    // This never alters tr.kp/tr.speed themselves - purely a display-side reference point.
    const now = performance.now();
    trains.forEach(tr => {
      kinematicsRef.current[tr.id] = {
        kp: tr.kp,
        speed: tr.speed,
        direction: tr.direction,
        ts: now
      };
    });
    Object.keys(kinematicsRef.current).forEach(id => {
      if (!trains.some(tr => tr.id === id)) {
        delete kinematicsRef.current[id];
      }
    });

    // Reposition all trains (Locomotive + coupled coaches)
    trains.forEach(tr => {
      const coachIndices = [0, 1, 2, 3];

      coachIndices.forEach((idx) => {
        // Precise geographic distance integrator to prevent expanding/telescoping coach distance issues near curves
        const { coords, bearing } = computeCarPosition(tr.kp, tr.direction, idx);
        // Dynamic HTML generator using canvas with pure PNG sprites
        const isLoco = idx === 0;
        const type = tr.type;
        const totalCars = 4;
        const canvasWidth = 24;
        const canvasHeight = 44;

        let carHtml = `
          <div style="transform: rotate(${bearing}deg); transform-origin: center;" class="relative w-10 h-12 flex items-center justify-center">
            <canvas 
              class="train-car-canvas" 
              width="${canvasWidth}" 
              height="${canvasHeight}" 
              data-type="${type}" 
              data-idx="${idx}" 
              data-is-loco="${isLoco}" 
              data-total-cars="${totalCars}"
              style="width: ${canvasWidth}px; height: ${canvasHeight}px;"
            ></canvas>
          </div>
        `;

        // Draw an ultra-detailed Top-Down graphic with pure CSS transforms
        const customIcon = L.divIcon({
          className: 'topdown-train-car',
          html: carHtml,
          iconSize: [28, 40],
          iconAnchor: [14, 20]
        });

        const carKey = `${tr.id}-${idx}`;
        activeKeysOnThisTick.add(carKey);

        let m = markerCache[carKey];
        if (m) {
          // Reposition existing marker and update style icon
          m.setLatLng(coords);
          m.setIcon(customIcon);
        } else {
          // Instantly register new marker node
          m = L.marker(coords, { icon: customIcon });
          m.addTo(mapRef.current!);
          markerCache[carKey] = m;
        }

        if (isLoco) {
          m.unbindTooltip();
          m.bindTooltip(`
            <div class="font-sans text-xs p-1">
              <strong class="text-amber-500 uppercase">${tr.name}</strong><br/>
              Driver: <strong>${tr.driverName || 'AI Autopilot'}</strong><br/>
              Speed: <span class="font-mono font-bold">${Math.round(tr.speed)} km/h</span><br/>
              KP: <span class="font-mono text-[10px]">KM ${tr.kp.toFixed(3)}</span>
            </div>
          `, { permanent: false, direction: 'top' });
        }
      });
    });

    // Remove obsolete markers for decommissioned trains
    Object.keys(markerCache).forEach(key => {
      if (!activeKeysOnThisTick.has(key)) {
        markerCache[key].remove();
        delete markerCache[key];
      }
    });

    // Render the beautiful PNG sprites on all active train canvases
    renderTrains();

    // Update camera centering depending on viewpoint modes
    if (activeTrain) {
      const trainCoords = getLatLngFromKp(activeTrain.kp, activeTrain.direction);

      if (viewMode === 'cabin' || (viewMode === 'north-up' && folowActiveTrain)) {
        // Smoothly pan without interruption
        mapRef.current.setView(trainCoords, currentZoom, { animate: false });
      }
    }
  }, [trains, activeTrain, viewMode, folowActiveTrain, currentZoom, isMapReady]);

  // DISPLAY-ONLY smoothing loop: runs every animation frame (~60fps) and nudges each
  // already-created train marker to an extrapolated position based on its last known
  // speed/direction/kp. This is what makes movement look fluid on the map even though
  // the authoritative game state only ticks every ~300ms (or 1s for AI trains).
  // Bearing/icon/tooltip are intentionally left untouched here (they're refreshed by the
  // authoritative effect above) to keep this loop cheap - only position (setLatLng) moves.
  useEffect(() => {
    if (!isMapReady || perfMode) return; // Skip extrapolation entirely in performance mode to save CPU on low-end devices

    let rafId: number;

    const smoothTick = () => {
      const now = performance.now();
      const markerCache = trainMarkersRef.current as unknown as Record<string, L.Marker>;

      (Object.entries(kinematicsRef.current) as [string, TrainKinematicsSnapshot][]).forEach(([trainId, kin]) => {
        const elapsedSec = Math.min(Math.max((now - kin.ts) / 1000, 0), MAX_EXTRAPOLATION_SECONDS);
        const dirSign = kin.direction === LineDirection.Hilir ? 1 : -1;
        let predictedKp = kin.kp + dirSign * (kin.speed / 3600) * elapsedSec;
        predictedKp = Math.max(0, Math.min(54.8, predictedKp));

        for (let idx = 0; idx < MAX_CARS_RENDERED; idx++) {
          const marker = markerCache[`${trainId}-${idx}`];
          if (!marker) continue;
          const { coords } = computeCarPosition(predictedKp, kin.direction, idx);
          marker.setLatLng(coords);
        }
      });

      rafId = requestAnimationFrame(smoothTick);
    };

    rafId = requestAnimationFrame(smoothTick);
    return () => cancelAnimationFrame(rafId);
  }, [isMapReady, perfMode]);

  // Compute rotation angle for cabin view
  const bearingAngle = activeTrain ? getBearingAtKp(activeTrain.kp, activeTrain.direction) : 0;
  // If in Cabin mode, rotate the entire leaflet container's DOM class, counter-pivot!
  const mapStyle: React.CSSProperties = viewMode === 'cabin'
    ? {
        transform: `rotate(${-bearingAngle}deg) scale(1.4)`, // Scale up to hide rotated empty viewport borders
        transition: 'transform 0.1s linear',
        transformOrigin: 'center'
      }
    : {
        transform: 'none',
        transition: 'transform 0.2s ease-out'
      };

  return (
    <div id="real-world-geographic-map" className="relative flex-1 flex flex-col min-h-[400px] h-full rounded-xl overflow-hidden border border-indigo-950/40 bg-slate-950">
      
      {/* Map Control Top Overlay Hub */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap justify-between items-center bg-[#070b14]/90 backdrop-blur-md border border-indigo-950/60 p-2.5 rounded-lg shadow-2xl gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1 px-2 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center gap-1">
            <Radio className="animate-pulse w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-black tracking-widest font-mono uppercase">REALWORLD LIVE SAT-MAP (LEAFLET JS)</span>
          </div>

          {activeTrain && (
            <div className="text-[10px] font-mono border-l border-indigo-950/60 pl-2.5 text-slate-300">
              Lokasi Aktif: <span className="font-sans font-black text-amber-400 uppercase">{activeTrain.name}</span> • KM {activeTrain.kp.toFixed(3)}
            </div>
          )}
        </div>

        {/* Configurations Controls */}
        <div className="flex items-center gap-2">
          {/* Map theme */}
          <button
            onClick={() => setTheme(t => t === 'cyber' ? 'satellite' : 'cyber')}
            className="bg-[#0e162b] hover:bg-slate-800 border border-indigo-900/60 text-slate-200 p-1.5 px-3 rounded flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase select-none transition-all cursor-pointer active:scale-95"
            title="Ubah Preset Peta"
          >
            <Layers size={10} className="text-amber-400" />
            <span>Tema: {theme === 'cyber' ? 'CYBER GLOW' : 'SATELLITE 1:1'}</span>
          </button>

          {/* Performance battery saver toggle */}
          <button
            onClick={() => {
              setPerfMode(p => {
                const next = !p;
                localStorage.setItem('rrsid_perf_mode', String(next));
                return next;
              });
            }}
            className={`p-1.5 px-3 rounded flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase select-none transition-all cursor-pointer active:scale-95 border ${
              perfMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-[#0e162b] hover:bg-slate-800 border-indigo-900/60 text-slate-300'
            }`}
            title="Mode Hemat Daya: Menyederhanakan jalur & peron untuk performa tinggi & ramah HP"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${perfMode ? 'bg-amber-400 animate-pulse' : 'bg-slate-450'}`}></span>
            <span>Hemat Daya: {perfMode ? 'AKTIF' : 'NONAKTIF'}</span>
          </button>

          {/* View Mode controls */}
          <div className="flex items-center gap-1 bg-[#0b1021] border border-indigo-950/60 p-0.5 rounded">
            <button
              onClick={() => { setViewMode('cabin'); setFollowActiveTrain(true); }}
              disabled={!activeTrain}
              className={`p-1.5 px-3.5 rounded text-[9px] font-black uppercase font-mono flex items-center gap-1 transition-all ${
                viewMode === 'cabin' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-white disabled:opacity-30'
              }`}
              title="Rotate map toward train direction (Cabin windshield up)"
            >
              <Compass size={11} className={viewMode === 'cabin' ? 'animate-spin-slow' : ''} />
              <span>Rotasi Masinis</span>
            </button>

            <button
              onClick={() => { setViewMode('north-up'); setFollowActiveTrain(true); }}
              className={`p-1.5 px-3.5 rounded text-[9px] font-black uppercase font-mono flex items-center gap-1 transition-all ${
                viewMode === 'north-up' && folowActiveTrain
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Camera tracks the train but keeps map North-Up"
            >
              <Navigation size={10} className="rotate-45" />
              <span>Lacak Lintas</span>
            </button>

            <button
              onClick={() => { setViewMode('north-up'); setFollowActiveTrain(false); }}
              className={`p-1.5 px-3.5 rounded text-[9px] font-black uppercase font-mono flex items-center gap-1 transition-all ${
                viewMode === 'north-up' && !folowActiveTrain
                  ? 'bg-slate-800 text-slate-200' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Free roaming camera pan without following model"
            >
              <Maximize2 size={10} />
              <span>Kamera Bebas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leaflet map frame wrapper container bounds to clips rotated styles */}
      <div className="flex-1 w-full relative overflow-hidden bg-[#030509]">
        
        {/* Actual Rotated Map Area */}
        <div 
          ref={mapContainerRef} 
          style={mapStyle}
          className="w-full h-full"
        />

        {/* FIXED top-down Cabin View overlay HUD representation */}
        {viewMode === 'cabin' && activeTrain && (
          <div className="absolute inset-x-0 bottom-4 z-[999] pointer-events-none flex flex-col items-center">
            
            {/* Visual Glass cockpit cabin overlay details */}
            <div className="bg-[#070b14]/90 border-t-2 border-amber-500 p-2 px-4 rounded-xl shadow-2xl flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono">
                <Compass className="animate-spin-slow" size={13} />
                <span>KEPALA ARAH: {Math.round(bearingAngle)}° ({activeTrain.direction === LineDirection.Hilir ? 'SELATAN / BOGOR' : 'UTARA / JAKARTA'})</span>
              </div>
              <div className="w-px h-3.5 bg-indigo-950"></div>
              <div className="text-slate-300">
                Peta otomatis berputar mengikuti kemudi. Atas layar = Depan Kereta.
              </div>
            </div>
          </div>
        )}



        {/* Native absolute zoom overlays */}
        <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 shadow-xl bg-slate-950/90 p-1 border border-indigo-950/60 rounded">
          <button
            onClick={() => setCurrentZoom(z => Math.min(20, z + 1))}
            className="w-7 h-7 bg-[#0b1021] hover:bg-slate-800 border border-indigo-950 text-white rounded font-bold font-mono text-sm cursor-pointer select-none transition-all active:scale-90"
            title="Perbesar Peta"
          >
            +
          </button>
          <button
            onClick={() => setCurrentZoom(z => Math.max(10, z - 1))}
            className="w-7 h-7 bg-[#0b1021] hover:bg-slate-800 border border-indigo-950 text-white rounded font-bold font-mono text-sm cursor-pointer select-none transition-all active:scale-90"
            title="Perkecil Peta"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}
