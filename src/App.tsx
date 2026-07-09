/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Role, 
  CareerRank, 
  UserCareer, 
  Train, 
  SignalBlock, 
  SwitchWesel, 
  PJLCrossing, 
  ChatMessage, 
  SignalColor, 
  LineDirection, 
  TrainType,
  PpkaAuthority
} from './types';
import { 
  SIGNALS, 
  SWITCHES, 
  PJLS, 
  STATIONS, 
  getSpeedLimitAtKp 
} from './data/tracks';
import { 
  loadUserCareer, 
  saveUserCareer, 
  DEFAULT_AI_TRAINS, 
  subscribeToSyncChannel, 
  broadcastStateChange, 
  generateSessionId, 
  SyncPacket,
  syncUserPresence,
  subscribeToOnlinePlayers,
  seedFirestoreOnce,
  logPenaltyInCloud,
  db,
  saveSharedSignal,
  saveSharedSwitch,
  saveSharedPJL,
  saveSharedTrain,
  removeSharedTrain,
  subscribeToSharedState,
  initializeSharedStateOnServer
} from './utils/sync';
import { runTrainAIDriver, updateSignalsAutomaticBlock, updateRouteGraph, MapsJunction } from './utils/engine';
import { audio } from './components/AudioEngine';
import MasinisDashboard from './components/MasinisDashboard';
import PpkasDashboard from './components/PpkasDashboard';
import PpkaAuthorityGate from './components/PpkaAuthorityGate';
import PusdiklatYard from './components/PusdiklatYard';
import CareerCenter from './components/CareerCenter';
import MultiplayerLobby from './components/MultiplayerLobby';
import AuthGateway from './components/AuthGateway';
import TeknisiDashboard from './components/TeknisiDashboard';

import { 
  Compass, 
  Users, 
  Award, 
  ShieldCheck, 
  ShieldAlert, 
  Server, 
  Clock, 
  AlertTriangle, 
  Volume2, 
  CornerDownRight, 
  Activity, 
  MapPin, 
  MessageSquareCode 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Generate session senderId for this tab
const SENDER_ID = generateSessionId();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionUser, setSessionUser] = useState<string>('');
  const [career, setCareer] = useState<UserCareer>({
    username: '',
    rank: CareerRank.Magang,
    points: 10,
    hasLicense: false,
    stats: {
      tripsCompleted: 0,
      speedInfractions: 0,
      redSignalViolations: 0,
      platformStopsCorrect: 0,
      collisions: 0
    }
  });
  const [activeView, setActiveView] = useState<'lobby' | 'pusdiklat' | 'career' | 'driver' | 'ppka' | 'teknisi'>('lobby');

  // PPKA authority selection (Sistem role PPKA baru): PK memegang 1 zona penuh (maks 5 orang
  // per zona), PPKA Stasiun memegang 1 stasiun (maks 1 orang, kecuali Manggarai maks 3 orang
  // karena punya percabangan). null = belum memilih, wajib pilih sebelum masuk dashboard PPKA.
  const [ppkaAuthority, setPpkaAuthority] = useState<PpkaAuthority | null>(null);
  const ppkaAuthorityRef = useRef<PpkaAuthority | null>(null);
  useEffect(() => {
    ppkaAuthorityRef.current = ppkaAuthority;
  }, [ppkaAuthority]);

  // KETENTUAN: Jika poin PTS pemain mencapai 0, pemain WAJIB mengikuti/mengulang ujian
  // Pusdiklat untuk mendapatkan poin kembali secara legitimate (bukan tombol "isi ulang
  // gratis"). Efek ini memaksa activeView ke 'pusdiklat' begitu poin habis, dari layar
  // manapun pemain sedang berada (kecuali saat sedang login/onboarding).
  useEffect(() => {
    if (!isAuthenticated) return;
    if (career.points <= 0 && activeView !== 'pusdiklat') {
      setActiveView('pusdiklat');
    }
  }, [isAuthenticated, career.points, activeView]);

  // Network synced states
  const [activeTrains, setActiveTrains] = useState<Train[]>([]);
  const [signals, setSignals] = useState<SignalBlock[]>([]);
  const [switches, setSwitches] = useState<SwitchWesel[]>([]);
  const [pjls, setPJLs] = useState<PJLCrossing[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Driving reference
  const [myDriverTrainId, setMyDriverTrainId] = useState<string | null>(null);

  // Time tracker for Gapeka
  const [localTime, setLocalTime] = useState<string>('');

  // Ticker for remote tabs listing
  const [peerSessionIds, setPeerSessionIds] = useState<string[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);

  // Lock status details
  const [banCounter, setBanCounter] = useState<number>(0);
  const [banActive, setBanActive] = useState(false);
  const [banReasonText, setBanReasonText] = useState('');

  // Semboyan and news flash scroll
  const [announceTicker, setAnnounceTicker] = useState(
    'SEMAFOR INFO: KA Pangrango bersiap lepas landas dari Stasiun Bogor • PPKA Manggarai harap waspadai jalur cepat transit di peron satu.'
  );

  // Sync references for stable interval tracking
  const myDriverTrainIdRef = useRef<string | null>(null);
  const activeTrainsRef = useRef<Train[]>([]);
  const signalsRef = useRef<SignalBlock[]>([]);
  const pjlsRef = useRef<PJLCrossing[]>([]);
  const onlinePlayersRef = useRef<any[]>([]);
  // Keeps the latest career (points/rank/etc.) available inside interval closures below,
  // so the presence heartbeat always broadcasts the CURRENT points instead of a stale
  // snapshot from whenever the effect last re-subscribed.
  const careerRef = useRef<UserCareer>(career);

  useEffect(() => {
    myDriverTrainIdRef.current = myDriverTrainId;
  }, [myDriverTrainId]);

  useEffect(() => {
    activeTrainsRef.current = activeTrains;
  }, [activeTrains]);

  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  useEffect(() => {
    pjlsRef.current = pjls;
  }, [pjls]);

  useEffect(() => {
    onlinePlayersRef.current = onlinePlayers;
  }, [onlinePlayers]);

  useEffect(() => {
    careerRef.current = career;
  }, [career]);

  // Initialise sync constants on mount
  useEffect(() => {
    setSignals(JSON.parse(JSON.stringify(SIGNALS)));
    setSwitches(JSON.parse(JSON.stringify(SWITCHES)));
    setPJLs(JSON.parse(JSON.stringify(PJLS)));
    setActiveTrains(JSON.parse(JSON.stringify(DEFAULT_AI_TRAINS)));
    seedFirestoreOnce();

    // Load registered username and active career
    const activeUsername = localStorage.getItem('rrsid_active_username');
    if (activeUsername) {
      setIsAuthenticated(true);
      setSessionUser(activeUsername);

      const syncOnMount = async () => {
        const usernameLower = activeUsername.trim().toLowerCase();
        try {
          const { ref, get } = await import('firebase/database');
          const userRef = ref(db, `user_accounts/${usernameLower}/career`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const liveCareer = snapshot.val() as UserCareer;
            setCareer(liveCareer);
            localStorage.setItem('rrsid_user_career', JSON.stringify(liveCareer));
            return;
          }
        } catch (err) {
          console.warn('Silent live career mount fetch failed:', err);
        }

        const accountsRaw = localStorage.getItem('rrsid_accounts');
        if (accountsRaw) {
          try {
            const accounts = JSON.parse(accountsRaw);
            const match = accounts.find((acc: any) => acc.username.toLowerCase() === activeUsername.toLowerCase());
            if (match && match.career) {
              setCareer(match.career);
            } else {
              const fallback = loadUserCareer();
              fallback.username = activeUsername;
              setCareer(fallback);
            }
          } catch (e) {
            const fallback = loadUserCareer();
            fallback.username = activeUsername;
            setCareer(fallback);
          }
        } else {
          const fallback = loadUserCareer();
          fallback.username = activeUsername;
          setCareer(fallback);
        }
      };
      syncOnMount();
    }

    // Gapeka dynamic timetable time clock
    const clockInterval = setInterval(() => {
      // WIB is UTC+7 timezone
      const now = new Date();
      const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      const hours = String(wibTime.getUTCHours()).padStart(2, '0');
      const minutes = String(wibTime.getUTCMinutes()).padStart(2, '0');
      const seconds = String(wibTime.getUTCSeconds()).padStart(2, '0');
      setLocalTime(`${hours}:${minutes}:${seconds} WIB`);
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Real-time synchronization of signals, switches, level crossings and trains from server
  useEffect(() => {
    // Seed server state if database is empty on start
    initializeSharedStateOnServer();

    const unsubShared = subscribeToSharedState({
      onSignalsUpdate: (serverSignals) => {
        setSignals(prev => prev.map(s => {
          const serverColor = serverSignals[s.id];
          return serverColor ? { ...s, color: serverColor as SignalColor } : s;
        }));
      },
      onSwitchesUpdate: (serverSwitches) => {
         setSwitches(prev => prev.map(sw => {
           const serverState = serverSwitches[sw.id];
           return serverState ? { ...sw, state: serverState as any } : sw;
         }));
      },
      onPJLsUpdate: (serverPjls) => {
         setPJLs(prev => prev.map(p => {
           const serverIsClosed = serverPjls[p.id];
           return serverIsClosed !== undefined ? { ...p, isClosed: serverIsClosed } : p;
         }));
      },
      onTrainsUpdate: (serverTrains) => {
        setActiveTrains(prev => {
          const newTrains = { ...serverTrains };
          // If driving ourselves, keep local states to prevent jitter/rubberlanding
          if (myDriverTrainIdRef.current && newTrains[myDriverTrainIdRef.current]) {
            delete newTrains[myDriverTrainIdRef.current];
          }
          // Merge with current state
          const mapped = prev.map(t => {
            const serverT = newTrains[t.id];
            if (serverT) {
              delete newTrains[t.id];
              return serverT;
            }
            return t;
          });
          const remains = Object.values(newTrains);
          return [...mapped, ...remains];
        });
      }
    });

    return () => {
      unsubShared();
    };
  }, []);

  // Local physics dead reckoning interval for smooth 3.3Hz movement interpolation and low network load
  useEffect(() => {
    const localReckoningInterval = setInterval(() => {
      setActiveTrains(prev => {
        let changed = false;
        const mapped = prev.map(t => {
          // If this train is my driver train, its physics are already driven at high frequency elsewhere
          if (t.id === myDriverTrainIdRef.current) return t;

          // If the train has collided or speed is zero, nothing to advance
          if (t.hasCollided || t.speed === 0) return t;

          // Advance position slowly: speed in km/h -> km per second.
          // Since this runs every 300ms, dt = 0.3
          const dt = 0.3;
          const kmPerSec = t.speed / 3600;
          let nextKp = t.kp;
          if (t.direction === LineDirection.Hilir) {
            nextKp += kmPerSec * dt;
          } else {
            nextKp -= kmPerSec * dt;
          }

          // Boundary turnarounds
          if (nextKp <= 0.2) {
            nextKp = 0.2;
          } else if (nextKp >= 54.6) {
            nextKp = 54.6;
          }

          changed = true;
          return {
            ...t,
            kp: nextKp,
          };
        });
        return changed ? mapped : prev;
      });
    }, 300);

    return () => clearInterval(localReckoningInterval);
  }, []);

  // Listen for Cross-Tab Synced Multiplayers message broadcasts
  useEffect(() => {
    const unsubscribe = subscribeToSyncChannel((packet: SyncPacket) => {
      const { type, payload, senderId } = packet;
      if (senderId === SENDER_ID) return; // skip self

      // Track active peer networks to show online indicator
      setPeerSessionIds(prev => {
        if (!prev.includes(senderId)) return [...prev, senderId];
        return prev;
      });

      switch (type) {
        case 'TRAIN_UPDATE':
          setActiveTrains(prev => {
            // Discard incoming updates for our active driven train to prevent remote-state juddering
            if (payload.id === myDriverTrainIdRef.current) {
              return prev;
            }
            const index = prev.findIndex(t => t.id === payload.id);
            if (index > -1) {
              const copy = [...prev];
              copy[index] = payload;
              return copy;
            }
            return [...prev, payload];
          });
          break;

        case 'SIGNAL_TOGGLE':
          setSignals(prev => prev.map(s => s.id === payload.id ? { ...s, color: payload.color } : s));
          break;

        case 'SWITCH_TOGGLE':
          setSwitches(prev => prev.map(sw => sw.id === payload.id ? { ...sw, state: payload.state } : sw));
          break;

        case 'PJL_TOGGLE':
          setPJLs(prev => prev.map(p => p.id === payload.id ? { ...p, isClosed: payload.isClosed } : p));
          break;

        case 'CHAT_MESSAGE':
          setChatMessages(prev => [payload, ...prev].slice(0, 30));
          break;

        case 'TRAIN_TAKEOVER':
          setActiveTrains(prev => prev.map(t => t.id === payload.trainId ? { ...t, isAI: false, driverName: payload.driverName } : t));
          break;

        case 'TRAIN_REMOVE':
          setActiveTrains(prev => prev.filter(t => t.id !== payload));
          break;

        case 'RESET_STATE':
          setSignals(JSON.parse(JSON.stringify(SIGNALS)));
          setSwitches(JSON.parse(JSON.stringify(SWITCHES)));
          setPJLs(JSON.parse(JSON.stringify(PJLS)));
          setActiveTrains(JSON.parse(JSON.stringify(DEFAULT_AI_TRAINS)));
          break;

        default:
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for Online Players presence updates from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToOnlinePlayers((players) => {
      setOnlinePlayers(players);
    });
    return () => unsubscribe();
  }, []);

  // Periodic player presence registration heartbeat
  useEffect(() => {
    if (!isAuthenticated || !career.username) return;

    // Map active view to user-facing role
    let currentRole = 'Lobby';
    if (activeView === 'driver') currentRole = 'Masinis';
    if (activeView === 'ppka') currentRole = 'PPKA';
    if (activeView === 'pusdiklat') currentRole = 'Pusdiklat';

    // Find if I have a driven train name
    const myTrain = activeTrainsRef.current.find(t => t.id === myDriverTrainId);
    const trainLabel = myTrain ? myTrain.name : null;
    const authorityKey = (a: PpkaAuthority | null) => a ? (a.type === 'PK' ? `PK-${a.zone}` : `STATION-${a.stationId}`) : null;

    // Send initial presence registration
    syncUserPresence(SENDER_ID, careerRef.current, currentRole, trainLabel, authorityKey(ppkaAuthorityRef.current));

    // Heartbeat every 8 seconds
    const interval = setInterval(() => {
      const currentTrain = activeTrainsRef.current.find(t => t.id === myDriverTrainId);
      const currentTrainLabel = currentTrain ? currentTrain.name : null;
      // Always read from careerRef (not the closed-over `career`) so a points change
      // (e.g. after finishing a trip or passing a Pusdiklat exam) is reflected to other
      // players immediately on the next heartbeat tick, instead of waiting for this
      // effect to re-subscribe.
      syncUserPresence(SENDER_ID, careerRef.current, currentRole, currentTrainLabel, authorityKey(ppkaAuthorityRef.current));
    }, 8000);

    return () => clearInterval(interval);
  }, [isAuthenticated, career.username, activeView, myDriverTrainId]);

  // Dynamic Announcement Ticker Generator representing real game states
  useEffect(() => {
    let messageIndex = 0;

    const generateAnnouncement = () => {
      const msgs = [
        'SEMAFOR INFO: Selamat datang di RRSid (Indonesia). Utamakan keselamatan perjalanan kereta api!',
        'INFO GAPEKA: Mengatur kelancaran lintas Commuter Line Jakarta Kota - Bogor. Pastikan aspek sinyal hijau sebelum melintas.',
        'WESEL INFO: PPKA harap mengatur kedudukan wesel pemindah jalur sebelum memberikan aspek hijau pada sinyal masuk.'
      ];

      const currentOnline = onlinePlayersRef.current;
      const currentTrains = activeTrainsRef.current;
      const currentSignals = signalsRef.current;
      const currentPjls = pjlsRef.current;

      // 1. Add active player info
      if (currentOnline && currentOnline.length > 0) {
        currentOnline.forEach(p => {
          if (p.role === 'Masinis' && p.trainName) {
            msgs.push(`KRU AKTIF: Masinis ${p.username} sedang berdinas mengendarai ${p.trainName} arah ${p.role}.`);
          } else if (p.role === 'PPKA') {
            msgs.push(`PPKA ONLINE: PPKA ${p.username} mengamankan pergerakan sinyal wesel lintas komputer.`);
          }
        });
      }

      // 2. Add train station stops & speed info
      currentTrains.forEach(t => {
        const nearStation = STATIONS.find(s => Math.abs(t.kp - s.kp) < 0.155);
        if (nearStation) {
          if (t.speed === 0) {
            msgs.push(`PENGUMUMAN STASIUN: ${t.name} berhenti di peron ${nearStation.name}. Penumpang dipersilakan naik/turun.`);
          } else {
            msgs.push(`INFO LINTAS: ${t.name} melintas langsung / bersiap lepas landas dari Stasiun ${nearStation.name}.`);
          }
        } else {
          if (t.speed > 5) {
            msgs.push(`INFO PERJALANAN: ${t.name} berjalan lancar pada KM ${t.kp.toFixed(2)} dengan kecepatan ${Math.round(t.speed)} km/h.`);
          }
        }

        // Speed infraction warning
        if (t.speed > t.targetSpeedLimit) {
          msgs.push(`⚠️ WARNING LINTAS: Terdeteksi overspeed pada ${t.name} di KM ${t.kp.toFixed(2)}! Batas kecepatan adalah ${t.targetSpeedLimit} km/h.`);
        }
      });

      // 3. Add active signals that are red
      const redSignals = currentSignals.filter(s => s.color === 'Red');
      if (redSignals.length > 0) {
        redSignals.forEach(s => {
          msgs.push(`PERSINYALAN: Sinyal Blok KM ${s.kp.toFixed(1)} menunjukkan aspek MERAH (Berhenti Mutlak).`);
        });
      }

      // 4. Add open level crossings
      const openPJLs = currentPjls.filter(p => !p.isClosed);
      if (openPJLs.length > 0) {
        openPJLs.forEach(p => {
          msgs.push(`⚠️ WARNING SEBIDANG: Perlintasan PJL ${p.name} di KM ${p.kp.toFixed(1)} masih TERBUKA! Harap waspada.`);
        });
      }

      if (msgs.length > 0) {
        const indexToUse = messageIndex % msgs.length;
        setAnnounceTicker(msgs[indexToUse]);
        messageIndex++;
      }
    };

    // Cycle every 10 seconds
    const interval = setInterval(generateAnnouncement, 10000);
    // Trigger once on start
    generateAnnouncement();
    return () => clearInterval(interval);
  }, []);

  // AI Trains background simulation ticks (Runs on the tab with smallest Session ID)
  useEffect(() => {
    const aiInterval = setInterval(() => {
      // Determine if there are active peers and if this SENDER_ID is the "Master" node (lexicographically smallest)
      const onlineIds = (onlinePlayersRef.current || []).map(p => p.id);
      const allIds = Array.from(new Set([SENDER_ID, ...peerSessionIds, ...onlineIds])).sort();
      const isMasterNode = allIds[0] === SENDER_ID;
      
      if (!isMasterNode) return; // let other master tab simulate background AI traffic to prevent jitter!

      // Update automatic block signals based on current train occupancy
      setSignals(prev => {
        const nextSignals = updateSignalsAutomaticBlock(prev, activeTrainsRef.current);
        // Check if any colors changed, if so broadcast and save to server
        nextSignals.forEach(ns => {
          const old = prev.find(p => p.id === ns.id);
          if (old && old.color !== ns.color) {
            broadcastStateChange('SIGNAL_TOGGLE', { id: ns.id, color: ns.color }, SENDER_ID);
            saveSharedSignal(ns.id, ns.color);
          }
        });
        return nextSignals;
      });

      // Update positions of AI Trains
      setActiveTrains(prev => {
        let changed = false;
        const mapped = prev.map(t => {
          if (t.isAI) {
            if (t.hasCollided) {
              return {
                ...t,
                speed: 0,
                throttle: 0,
                brake: 5,
              };
            }
            changed = true;
            const aiInputs = runTrainAIDriver(t, signals, pjls, STATIONS);
            const dt = 1.0; // 1 second AI tick
            
            let currentDir = t.direction;
            let nextKp = t.kp;
            
            // 1. Detect upcoming Signal ahead of the train
            const facSignals = signals.filter(s => s.direction === currentDir && (currentDir === LineDirection.Hilir ? s.kp > t.kp : s.kp < t.kp));
            facSignals.sort((a,b) => currentDir === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp);
            const sigAhead = facSignals[0];
            const distToSig = sigAhead ? Math.abs(sigAhead.kp - t.kp) : 999;

            // 2. Detect upcoming PJL ahead of the train
            const facPjls = pjls.filter(p => (currentDir === LineDirection.Hilir ? p.kp > t.kp : p.kp < t.kp));
            facPjls.sort((a,b) => currentDir === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp);
            const pjlAhead = facPjls[0];
            const distToPjl = pjlAhead ? Math.abs(pjlAhead.kp - t.kp) : 999;

            // 3. Find next station on path
            const nextStations = STATIONS.filter(s => (currentDir === LineDirection.Hilir ? s.kp > t.kp : s.kp < t.kp));
            nextStations.sort((a,b) => currentDir === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp);
            const stationAhead = nextStations[0];
            const distToStn = stationAhead ? Math.abs(stationAhead.kp - t.kp) : 999;

            // Calculate target speed based on local speed limits and circumstances
            let limitVal = getSpeedLimitAtKp(t.kp, t.routeBranch).limit;
            let target = limitVal - 5; // cruise slightly under limit

            // Smoothly slow down for signals
            if (sigAhead) {
              if (sigAhead.color === SignalColor.Yellow && distToSig < 0.8) {
                const isApproachingTerminal = 
                  (t.kp <= 1.5 && currentDir === LineDirection.Hulu) || // Jakarta Kota
                  (t.kp >= 53.0 && currentDir === LineDirection.Hilir) || // Bogor
                  (Math.abs(t.kp - 4.0) <= 1.0); // Pasar Senen
                target = Math.min(target, isApproachingTerminal ? 40 : 25);
              } else if (sigAhead.color === SignalColor.Red && distToSig < 0.8) {
                // Smooth deceleration profile
                const stopProfileSpeed = Math.max(0, (distToSig - 0.02) * 55);
                target = Math.min(target, stopProfileSpeed);
              }
            }

            // Smoothly slow down for open level crossings (dangerous!)
            if (pjlAhead && !pjlAhead.isClosed && distToPjl < 0.6) {
              const stopProfileSpeed = Math.max(0, (distToPjl - 0.02) * 45);
              target = Math.min(target, stopProfileSpeed);
            }

            // Smoothly decelerate for upcoming station and handle passenger boarding doors
            let boardingHold = false;
            let currentStopTimer = t.stopTimer || 0;
            let currentLastStoppedStationId = t.lastStoppedStationId;

            // Reset lastStoppedStationId once we are well past the stn so we can stop there next tour
            if (currentLastStoppedStationId && distToStn > 0.15) {
              currentLastStoppedStationId = null;
            }

            if (stationAhead && distToStn < 0.4) {
              if (distToStn < 0.025 && t.speed < 2) {
                // If we haven't stopped or completed current station's stop yet
                if (currentLastStoppedStationId !== stationAhead.id) {
                  currentStopTimer = 60; // 60 seconds (1 minute) stop
                  currentLastStoppedStationId = stationAhead.id;
                }

                if (currentStopTimer > 0) {
                  currentStopTimer -= 1;
                  target = 0;
                  boardingHold = true;
                } else {
                  // stopTimer expired! Train closes doors and can depart
                  boardingHold = false;
                }
              } else {
                // Decelerate smoothly as we approach the station
                // But only if we aren't bypassing this station stop (e.g. if we already did it)
                if (currentLastStoppedStationId !== stationAhead.id) {
                  const stationStopSpeed = Math.max(0, (distToStn - 0.005) * 45);
                  target = Math.min(target, stationStopSpeed);
                }
              }
            } else {
              // Not approaching near any station, reset stop counter
              currentStopTimer = 0;
            }

            // Realistically adjust speed towards targeted speed (limit acceleration & braking drag)
            let nextSpeed = t.speed;
            let throttle = t.throttle;
            let brake = t.brake;
            let doorsOpen = false;

            if (boardingHold) {
              nextSpeed = 0;
              throttle = 0;
              brake = 5;
              doorsOpen = true;
            } else {
              if (t.speed < target) {
                nextSpeed = Math.min(target, t.speed + 6); // accelerate +6 km/h per sec
                throttle = 3;
                brake = 0;
              } else if (t.speed > target + 2) {
                nextSpeed = Math.max(target, t.speed - 10); // decelerate -10 km/h per sec
                throttle = 0;
                brake = 3;
              } else {
                throttle = 1; // cruise power
                brake = 0;
              }
            }

            // Advance positions
            const kmPerSec = nextSpeed / 3600;
            if (currentDir === LineDirection.Hilir) {
              nextKp += kmPerSec * dt;
            } else {
              nextKp -= kmPerSec * dt;
            }

            // JUNCTION ROUTING: Manggarai hub routing for Sektor 4 / CikarangLoop trains.
            // Diperbaiki: sebelumnya tujuan (Bogor vs Jakarta Kota) ditentukan dari NAMA
            // kereta ("#2041"), yang tidak logis karena tidak bisa diatur PPKA. Sekarang
            // dibaca dari status wesel sungguhan W-MRI-04 (straight = Bogor, diverging =
            // Jakarta Kota), sama seperti wesel lain yang dikendalikan PPKA.
            let currentRouteBranch = t.routeBranch;
            if (currentRouteBranch === 'CikarangLoop' && nextKp >= 9.6 && currentDir === LineDirection.Hilir) {
              const junctionSwitch = switches.find(s => s.id === 'W-MRI-04');
              const targetNode = junctionSwitch?.state === 'diverging' ? 'JakartaKota' : 'Bogor';
              const routingUpdates = MapsJunction(t, targetNode);
              nextKp = routingUpdates.kp ?? nextKp;
              currentDir = routingUpdates.direction ?? currentDir;
              currentRouteBranch = routingUpdates.routeBranch;
              nextSpeed = 15; // slow down for safety transition
            }

            // BOUNDARY TRIPS: Guard turnaround loop at end of track bounds
            let reachedDestination = false;
            if (nextKp <= 0.3 && currentDir === LineDirection.Hulu) {
              if (t.driverName === 'AI Masinis') {
                reachedDestination = true;
              } else {
                nextKp = 0.2;
                currentDir = LineDirection.Hilir;
                nextSpeed = 5;
              }
            } else if (nextKp >= 54.5 && currentDir === LineDirection.Hilir) {
              if (t.driverName === 'AI Masinis') {
                reachedDestination = true;
              } else {
                nextKp = 54.6;
                currentDir = LineDirection.Hulu;
                nextSpeed = 5;
              }
            }

            if (reachedDestination) {
              // Broadcast removal to offline and real-time db
              broadcastStateChange('TRAIN_REMOVE', t.id, SENDER_ID);
              removeSharedTrain(t.id);
              changed = true;
              return null;
            }

            // SAFETY INTERCEPTOR: Rigorous block holding - NEVER cross RED signals
            if (sigAhead && sigAhead.color === SignalColor.Red) {
              if (currentDir === LineDirection.Hilir && nextKp >= sigAhead.kp - 0.01) {
                nextKp = sigAhead.kp - 0.01;
                nextSpeed = 0;
                throttle = 0;
                brake = 5;
              } else if (currentDir === LineDirection.Hulu && nextKp <= sigAhead.kp + 0.01) {
                nextKp = sigAhead.kp + 0.01;
                nextSpeed = 0;
                throttle = 0;
                brake = 5;
              }
            }

            // SAFETY INTERCEPTOR: Rigorous block holding - NEVER cross open PJL crossings
            if (pjlAhead && !pjlAhead.isClosed) {
              if (currentDir === LineDirection.Hilir && nextKp >= pjlAhead.kp - 0.015) {
                nextKp = pjlAhead.kp - 0.015;
                nextSpeed = 0;
                throttle = 0;
                brake = 5;
              } else if (currentDir === LineDirection.Hulu && nextKp <= pjlAhead.kp + 0.015) {
                nextKp = pjlAhead.kp + 0.015;
                nextSpeed = 0;
                throttle = 0;
                brake = 5;
              }
            }

            const activeStation = STATIONS.find(s => Math.abs(s.kp - nextKp) < 0.15);

            const updatedAI: Train = {
              ...t,
              kp: nextKp,
              speed: nextSpeed,
              direction: currentDir,
              throttle: throttle,
              brake: brake,
              doorsOpen: doorsOpen,
              currentPlatformId: activeStation ? activeStation.id : null,
              stopTimer: currentStopTimer,
              lastStoppedStationId: currentLastStoppedStationId,
              routeBranch: currentRouteBranch,
            };

            // Broadcast AI update to peer tabs of other players during driving
            const shouldBroadcast = nextSpeed > 0 || 
                                    t.speed > 0 || 
                                    t.doorsOpen !== doorsOpen || 
                                    t.direction !== currentDir ||
                                    Math.random() < 0.25; // 25% sync heartbeat for idle trains

            if (shouldBroadcast) {
              broadcastStateChange('TRAIN_UPDATE', updatedAI, SENDER_ID);
              saveSharedTrain(updatedAI);
            }
            return updatedAI;
          }
          return t;
        });

        const filtered = mapped.filter((x): x is Train => x !== null);
        return changed ? filtered : prev;
      });
    }, 1000);

    return () => clearInterval(aiInterval);
  }, [peerSessionIds, signals, pjls, switches]);

  // Skorsing Ban timer tick down
  useEffect(() => {
    if (!banActive) return;
    const banSec = setInterval(() => {
      setBanCounter(c => {
        if (c <= 1) {
          setBanActive(false);
          setAnnounceTicker('KA NEWS: Masa skorsing selesai! Anda diperkenankan masuk kembali ke server.');
          clearInterval(banSec);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(banSec);
  }, [banActive]);

  // Action: Spawn a new Train
  const handleSpawnTrain = (name: string, type: TrainType, direction: LineDirection) => {
    const isUpLine = direction === LineDirection.Hulu;
    const startKp = isUpLine ? 54.5 : 0.3; // start close to terminal Bogor or JKT Kota
    const newTrainId = 'KA-' + Math.floor(100 + Math.random() * 900).toString();
    
    const newTrain: Train = {
      id: newTrainId,
      name,
      type,
      isAI: false,
      driverName: sessionUser,
      direction,
      kp: startKp,
      speed: 0,
      maxSpeed: 90,
      targetSpeedLimit: 90,
      currentPlatformId: null,
      doorsOpen: false,
      throttle: 0,
      brake: 5,
      reverser: 'N',
      horn: false,
      emergencyBrake: false,
      currentTrackId: 'Main_Line',
      cargoType: 'Passengers',
      lastStopKp: null,
      hasCollided: false,
      isBanned: false
    };

    setActiveTrains(prev => [...prev, newTrain]);
    setMyDriverTrainId(newTrainId);
    setActiveView('driver');

    // Broadcast spawn
    broadcastStateChange('TRAIN_UPDATE', newTrain, SENDER_ID);
    
    // Add Dispatcher log
    sendChatMessage(`Masinis ${sessionUser} memberangkatkan sepur baru ${name} arah ${direction}!`, 'Sistem Lintas');
  };

  // Action: Ambil Alih (Takeover AI train seamless)
  const handleTakeoverTrain = (trainId: string) => {
    setActiveTrains(prev => prev.map(t => {
      if (t.id === trainId) {
        const updated = {
          ...t,
          isAI: false,
          driverName: sessionUser
        };
        broadcastStateChange('TRAIN_TAKEOVER', { trainId, driverName: sessionUser }, SENDER_ID);
        broadcastStateChange('TRAIN_UPDATE', updated, SENDER_ID);
        return updated;
      }
      return t;
    }));

    setMyDriverTrainId(trainId);
    setActiveView('driver');
    sendChatMessage(`Masinis ${sessionUser} telah mengikat serah terima kemudi ${trainId} menjadi manual!`, 'Sistem Lintas');
  };

  // Dispatch signal toggle PPKA
  const handleToggleSignal = (signalId: string, color: SignalColor) => {
    setSignals(prev => prev.map(s => s.id === signalId ? { ...s, color } : s));
    broadcastStateChange('SIGNAL_TOGGLE', { id: signalId, color }, SENDER_ID);
    saveSharedSignal(signalId, color);
    sendChatMessage(`Mengubah sinyal aspek ${signalId} beralih ke warna ${color}!`, `PPKA`);
  };

  // Dispatch switch toggle PPKA
  const handleToggleSwitch = (switchId: string, state: 'straight' | 'diverging') => {
    setSwitches(prev => prev.map(sw => sw.id === switchId ? { ...sw, state } : sw));
    broadcastStateChange('SWITCH_TOGGLE', { id: switchId, state }, SENDER_ID);
    saveSharedSwitch(switchId, state);
    sendChatMessage(`Mengoperasikan wesel ${switchId} beralih ke posisi ${state === 'straight' ? 'SEP UR LURUS' : 'SEPUR BELOK'}!`, `PPKA`);
  };

  // Dispatch level crossing PJL gate toggle
  const handleTogglePJL = (pjlId: string, isClosed: boolean) => {
    setPJLs(prev => prev.map(p => p.id === pjlId ? { ...p, isClosed } : p));
    broadcastStateChange('PJL_TOGGLE', { id: pjlId, isClosed }, SENDER_ID);
    saveSharedPJL(pjlId, isClosed);
    
    if (isClosed) {
      audio.playPJLBell(1.0);
    }
    sendChatMessage(`Mengamankan pintu perlintasan ${pjlId} menjadi ${isClosed ? 'TERKUNCI AMAN' : 'TERBUKA BEBAS'}!`, `PPKA`);
  };

  // Action: update dynamic driving train stats
  const handleUpdateMyTrain = (
    updated: Train, 
    penalties: string[], 
    isBanned: boolean, 
    banReason?: string,
    coupledTrainIds?: string[]
  ) => {
    // 1. Maintain active trains array
    setActiveTrains(prev => {
      const exists = prev.some(t => t.id === updated.id);
      if (!exists) {
        return [...prev.map(t => {
          if (coupledTrainIds && coupledTrainIds.includes(t.id)) {
            return {
              ...t,
              kp: updated.kp,
              speed: updated.speed,
              hasCollided: true,
              isAI: false,
              driverName: `Kopel Rescue`
            };
          }
          return t;
        }), updated];
      }
      return prev.map(t => {
        if (t.id === updated.id) {
          return updated;
        }
        if (coupledTrainIds && coupledTrainIds.includes(t.id)) {
          return {
            ...t,
            kp: updated.kp,
            speed: updated.speed,
            hasCollided: true,
            isAI: false,
            driverName: `Kopel Rescue`
          };
        }
        return t;
      });
    });
    
    // Broadcast my dynamic physics movement to peer displays
    broadcastStateChange('TRAIN_UPDATE', updated, SENDER_ID);

    // 2. Audit warnings and points balance updates in profile
    if (penalties.length > 0) {
      setAnnounceTicker(`WARNING FLASH: ${penalties[0]}`);
      
      let ptsDiff = 0;
      let updateStats = { ...career.stats };
 
      penalties.forEach(p => {
        if (p.includes('Sempurna')) {
          ptsDiff += 25;
          updateStats.platformStopsCorrect += 1;
          logPenaltyInCloud(sessionUser, 'Sempurna Stop Peron Stasiun', false, 0);
        } else if (p.includes('Kelebihan Kecepatan')) {
          ptsDiff -= 10;
          updateStats.speedInfractions += 1;
          logPenaltyInCloud(sessionUser, 'Kelebihan Kecepatan (Speeding)', false, 10);
        } else if (p.includes('Overrun')) {
          ptsDiff -= 20;
          updateStats.speedInfractions += 1;
          logPenaltyInCloud(sessionUser, 'Overrun Sinyal / Melewati Peron', false, 20);
        } else if (p.includes('Menerobos PJL')) {
          ptsDiff -= 40;
          updateStats.speedInfractions += 1;
          logPenaltyInCloud(sessionUser, 'Menerobos PJL (Perlintasan Sebidang)', false, 40);
        } else if (p.includes('Kecepatan Minimal')) {
          ptsDiff -= 15;
          updateStats.speedInfractions += 1;
          logPenaltyInCloud(sessionUser, 'Melanggar Kecepatan Minimal (Menghambat GAPEKA)', false, 15);
        }
      });
 
      const nextCareer = {
        ...career,
        points: Math.max(0, career.points + ptsDiff),
        stats: updateStats
      };
 
      // Recalculate Rank Level triggers
      if (nextCareer.points >= 600) nextCareer.rank = CareerRank.Utama;
      else if (nextCareer.points >= 300) nextCareer.rank = CareerRank.Madya;
      else if (nextCareer.points >= 100) nextCareer.rank = CareerRank.Muda;
      else nextCareer.rank = CareerRank.Magang;
 
      setCareer(nextCareer);
      saveUserCareer(nextCareer);
    }
 
    // 3. Kick and Kick skorsing automatic ban triggers (Fatal crash / Passing Red lights / Extreme Speed overs)
    if (isBanned) {
      setMyDriverTrainId(null);
      setActiveView('lobby');
 
      // Dismiss her derailed train
      setActiveTrains(prev => prev.filter(t => t.id !== updated.id));
 
      const nextCareer = {
        ...career,
        points: Math.max(0, career.points - 100),
        stats: {
          ...career.stats,
          redSignalViolations: banReason?.includes('Sinyal') ? career.stats.redSignalViolations + 1 : career.stats.redSignalViolations,
          collisions: banReason?.includes('Tabrakan') ? career.stats.collisions + 1 : career.stats.collisions
        }
      };
 
      // Level down if dropped below 0
      nextCareer.rank = CareerRank.Magang; // safety drop
 
      setCareer(nextCareer);
      saveUserCareer(nextCareer);
 
      // Log major ban into Cloud Firestore
      logPenaltyInCloud(sessionUser, banReason || 'Fatal Infraction Ban', true, 100);

      // Lock server gate, client skorsing ban
      setBanActive(true);
      setBanCounter(60); // 1 minute sandbox cooling off ban for review! (GDD suggests 10-30 min, simplified here for testing)
      setBanReasonText(banReason || 'Fatal Infraction Violation');
 
      sendChatMessage(`[SERVER ALERT] Masinis ${sessionUser} di-KICK dan dikenakan skorsing otomatis! Alasan: ${banReason}`, 'Kepala Stasiun');
    }
  };

  // Sync user profile name
  const handleUsernameChange = (newName: string) => {
    if (!newName.trim()) return;
    const nextCareer = { ...career, username: newName };
    setCareer(nextCareer);
    setSessionUser(newName);
    saveUserCareer(nextCareer);
  };

  // License certification Pusdiklat reward
  const handleGrantLicense = (updatedCareer: UserCareer) => {
    setCareer(updatedCareer);
    setSessionUser(updatedCareer.username);
    saveUserCareer(updatedCareer);
    setActiveView('lobby');
    sendChatMessage(`Siswa ${updatedCareer.username} berhasil lulus Pusdiklat dan menyandang Lisensi Masinis!`, 'Sekretariat');
  };

  const handleSpawnAITrain = (name: string, type: TrainType, direction: LineDirection, kp: number) => {
    const newTrainId = 'KA-AI-' + Math.floor(100 + Math.random() * 900).toString();
    const newTrain: Train = {
      id: newTrainId,
      name,
      type,
      isAI: true,
      driverName: 'AI Masinis',
      direction,
      kp,
      speed: 0,
      maxSpeed: type === TrainType.KRL_8 ? 80 : 95,
      targetSpeedLimit: 90,
      throttle: 15, // Put low throttle so it begins crawling when brakes are released
      brake: 100, // Fully braked; will release when signal is yellow/green
      reverser: direction === LineDirection.Hilir ? 'F' : 'R',
      doorsOpen: false,
      currentPlatformId: null,
      isBanned: false,
      horn: false,
      emergencyBrake: false,
      currentTrackId: direction === LineDirection.Hilir ? 'Main-Hilir' : 'Main-Hulu',
      cargoType: type === TrainType.CC206 && name.includes('Barang') ? 'Freight' : 'Passengers',
      lastStopKp: null,
      hasCollided: false
    };
    setActiveTrains(prev => {
      if (prev.some(t => t.id === newTrainId)) return prev;
      return [...prev, newTrain];
    });
    broadcastStateChange('TRAIN_UPDATE', newTrain, SENDER_ID);
    sendChatMessage(`Sistem Lintas: Memunculkan dinasan kereta AI baru ${name} (${newTrainId}) posisi KM ${kp.toFixed(1)}!`, 'Sistem Lintas');
  };

  const handleClearAllTrains = () => {
    setActiveTrains([]);
    broadcastStateChange('RESET_STATE', null, SENDER_ID);
    sendChatMessage(`Sistem Lintas: Membersihkan seluruh armada kereta aktif di jalur!`, 'Sistem Lintas');
  };

  // Sandbox bypass triggers
  const handleBypassLicense = () => {
    const bypassed: UserCareer = {
      username: sessionUser,
      rank: career.points > 0 ? career.rank : CareerRank.Muda,
      points: career.points > 0 ? career.points : 100,
      hasLicense: true,
      stats: { ...career.stats, tripsCompleted: 1 }
    };
    setCareer(bypassed);
    saveUserCareer(bypassed);
    sendChatMessage(`User bypassing Lisensi Pusdiklat dikoordinasikan.`, 'Pusdiklat');
  };

  // Automated Collision Detection Engine
  useEffect(() => {
    const allIds = [SENDER_ID, ...peerSessionIds].sort();
    const isMasterNode = allIds[0] === SENDER_ID;
    if (!isMasterNode) return;

    const checkCollisions = () => {
      const currentTrains = activeTrainsRef.current;
      if (currentTrains.length < 2) return;

      let changed = false;
      const copyTrains = JSON.parse(JSON.stringify(currentTrains)) as Train[];

      for (let i = 0; i < copyTrains.length; i++) {
        for (let j = i + 1; j < copyTrains.length; j++) {
          const t1 = copyTrains[i];
          const t2 = copyTrains[j];

          if (!t1.hasCollided && !t2.hasCollided) {
            const sameTrack = t1.currentTrackId === t2.currentTrackId || 
                              (!t1.currentTrackId && !t2.currentTrackId) || 
                              (t1.currentPlatformId && t1.currentPlatformId === t2.currentPlatformId);
            
            const distance = Math.abs(t1.kp - t2.kp);

            if (sameTrack && distance < 0.12) {
              t1.hasCollided = true;
              t2.hasCollided = true;
              t1.speed = 0;
              t2.speed = 0;
              t1.throttle = 0;
              t2.throttle = 0;
              t1.brake = 5;
              t2.brake = 5;

              changed = true;
              
              const systemMsg = `🚨 [KLB TABRAKAN]: Terjadi kecelakaan sepur hebat di KM ${t1.kp.toFixed(2)} antara ${t1.name} dan ${t2.name}! Lintas diblokir total! Teknisi penolong wajib dikerahkan untuk evakuasi.`;
              
              const newMsg = {
                id: 'sys-msg-' + Math.floor(Math.random() * 1000000),
                sender: 'SISTEM KESELAMATAN',
                text: systemMsg,
                timestamp: new Date().toLocaleTimeString(),
                color: '#ef4444'
              };
              
              setChatMessages(prev => [...prev, newMsg]);
              broadcastStateChange('CHAT_MESSAGE', newMsg, SENDER_ID);
              broadcastStateChange('TRAIN_UPDATE', t1, SENDER_ID);
              broadcastStateChange('TRAIN_UPDATE', t2, SENDER_ID);
            }
          }
        }
      }

      if (changed) {
        setActiveTrains(copyTrains);
      }
    };

    const collisionTimer = setInterval(checkCollisions, 1500);
    return () => clearInterval(collisionTimer);
  }, [peerSessionIds]);

  // Technical Rescue Actions
  const handleClearCollision = (t1Id: string, t2Id: string, stationKp?: number, loriTrainId?: string) => {
    const targetKp = stationKp !== undefined ? stationKp : 9.8;
    setActiveTrains(prev => {
      let filtered = prev;
      if (loriTrainId) {
        filtered = filtered.filter(t => t.id !== loriTrainId);
      }
      return filtered.map(t => {
        if (t1Id && t2Id && (t.id === t1Id || t.id === t2Id)) {
          return {
            ...t,
            kp: targetKp,
            speed: 0,
            throttle: 0,
            brake: 5,
            isAI: true,
            driverName: 'AI Masinis',
            hasCollided: false
          };
        }
        return t;
      });
    });
    
    const awardCareer = {
      ...career,
      points: career.points + 200,
    };
    if (awardCareer.points >= 600) awardCareer.rank = CareerRank.Utama;
    else if (awardCareer.points >= 300) awardCareer.rank = CareerRank.Madya;
    else if (awardCareer.points >= 100) awardCareer.rank = CareerRank.Muda;
    
    setCareer(awardCareer);
    saveUserCareer(awardCareer);

    // Broadcast recovery state updates to other peer nodes
    setTimeout(() => {
      if (t1Id) {
        broadcastStateChange('TRAIN_UPDATE', { id: t1Id, kp: targetKp, speed: 0, hasCollided: false, isAI: true, driverName: 'AI Masinis' }, SENDER_ID);
      }
      if (t2Id) {
        broadcastStateChange('TRAIN_UPDATE', { id: t2Id, kp: targetKp, speed: 0, hasCollided: false, isAI: true, driverName: 'AI Masinis' }, SENDER_ID);
      }
      if (loriTrainId) {
        broadcastStateChange('TRAIN_REMOVE', loriTrainId, SENDER_ID);
      }
    }, 500);
  };

  const handleRepairSignal = (signalId: string) => {
    setSignals(prev => prev.map(s => s.id === signalId ? { ...s, color: SignalColor.Green } : s));
    broadcastStateChange('SIGNAL_TOGGLE', { id: signalId, color: SignalColor.Green }, SENDER_ID);
    saveSharedSignal(signalId, SignalColor.Green);

    const awardCareer = {
      ...career,
      points: career.points + 100,
    };
    if (awardCareer.points >= 600) awardCareer.rank = CareerRank.Utama;
    else if (awardCareer.points >= 300) awardCareer.rank = CareerRank.Madya;
    else if (awardCareer.points >= 100) awardCareer.rank = CareerRank.Muda;
    
    setCareer(awardCareer);
    saveUserCareer(awardCareer);
  };

  // Chat/Radio broadcaster
  const sendChatMessage = (messageText: string, customLabel?: string) => {
    const now = new Date();
    const packet: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      sender: sessionUser,
      role: customLabel || 'Kru KA',
      message: messageText,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setChatMessages(prev => [packet, ...prev].slice(0, 30));
    broadcastStateChange('CHAT_MESSAGE', packet, SENDER_ID);
  };

  const handleResetCareer = () => {
    localStorage.removeItem('rrsid_user_career');
    const fresh = loadUserCareer();
    setCareer(fresh);
    setSessionUser(fresh.username);
  };

  const myTrain = activeTrains.find(t => t.id === myDriverTrainId);

  if (!isAuthenticated) {
    return (
      <AuthGateway 
        onLoginSuccess={(loggedInCareer) => {
          setCareer(loggedInCareer);
          setSessionUser(loggedInCareer.username);
          setIsAuthenticated(true);
          localStorage.setItem('rrsid_user_career', JSON.stringify(loggedInCareer));
        }} 
      />
    );
  }

  return (
    <div id="game-main-canvas" className="bg-[#090d16] text-slate-100 min-h-screen flex flex-col font-sans selection:bg-indigo-505">
      
      {/* Dynamic News Flash announcement banner */}
      <div className="bg-[#12192a] text-[#1dd1a1] py-1.5 px-4 text-[10px] font-mono border-b border-indigo-950 flex justify-between items-center gap-4">
        <div className="flex items-center gap-2 overflow-hidden w-full whitespace-nowrap">
          <span className="bg-[#0b0f19] text-white px-2 py-0.5 rounded text-[8px] tracking-wider uppercase font-black select-all z-10">Semboyan Lintas</span>
          <div className="relative flex-1 overflow-hidden">
            <div 
              key={announceTicker}
              className="animate-marquee-smooth"
            >
              {announceTicker}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center text-slate-400 font-bold shrink-0">
          <Clock size={12} />
          <span>{localTime || '09:00:00 WIB'}</span>
        </div>
      </div>

      {/* Main Indonesian Railway Hub Topbar */}
      <header className="bg-slate-950 border-b border-indigo-950/80 px-4 py-3 flex items-center justify-between shadow-md z-25">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center font-black text-slate-950 text-xl tracking-tighter cursor-crosshair active:scale-95 transition-all">
            KA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white hover:text-indigo-400 cursor-help transition-colors select-word">RRSid (Indonesia)</span>
              <span className="text-[8px] bg-[#1a2035] text-indigo-400 border border-indigo-900 font-mono py-0.5 px-1 rounded uppercase">PROTOTYPE MULTIPLAYER</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block">Rel Kereta Lintas Dua-Role (Masinis + Pengatur Sinyal)</span>
          </div>
        </div>

        {/* Outer navigation tab lists */}
        <nav className="hidden md:flex gap-1 bg-[#101424] p-1 rounded-lg border border-slate-900">
          {[
            { id: 'lobby', label: 'Terminal', icon: Server },
            { id: 'pusdiklat', label: 'Sekolah Pusdiklat', icon: Award },
            { id: 'career', label: 'Surat Kepangkatan', icon: ShieldCheck }
          ].map(tab => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => {
                if (banActive) return;
                setActiveView(tab.id as any);
              }}
              disabled={banActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeView === tab.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40'
              }`}
            >
              <tab.icon size={13} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Server connection nodes status */}
        <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>NODE: {peerSessionIds.length + 1} ONLINE</span>
          </span>
          <span className="hidden sm:inline bg-slate-900 text-[10px] border border-slate-800 px-2 py-0.5 rounded text-amber-500 leading-none">
            ID: {SENDER_ID}
          </span>
          <button
            onClick={() => {
              localStorage.removeItem('rrsid_active_username');
              setIsAuthenticated(false);
            }}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold px-2 py-1 rounded text-[10px] transition-colors cursor-pointer"
          >
            Keluar Akun
          </button>
        </div>
      </header>

      {/* Skorsing automatic client ban blocking popup */}
      <AnimatePresence>
        {banActive && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 z-50 overflow-hidden"
          >
            <div className="bg-[#1a1212] border-2 border-red-500/50 p-8 rounded-2xl max-w-md w-full text-center flex flex-col items-center gap-5 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-500 animate-bounce">
                <ShieldAlert size={36} />
              </div>

              <div>
                <h2 className="text-lg font-black tracking-wide text-red-400 uppercase font-mono">AKUN ANDA DI-KICK / DISKORS</h2>
                <p className="text-xs text-slate-400 leading-relaxed mt-2.5 select-all">
                  Sanksi Kedisiplinan: Pelanggaran peraturan fatal terdeteksi.<br/>
                  Alasan: <strong className="text-white font-mono block mt-1">"{banReasonText}"</strong>
                </p>
              </div>

              <div className="text-2xl font-mono font-black text-red-500 py-2 border-t border-b border-red-900/30 w-full bg-slate-950/40 rounded-lg">
                Sisa Hukuman: {banCounter} Detik
              </div>

              <p className="text-[10px] text-slate-500 leading-normal">
                Sesuai peraturan Gapeka Indonesia RRSid, masinis yang melakukan SPAD (menerobos merah) atau crash ditarik paksa dari jalur dinas demi keselamatan perjalanan. Harap tunggu atau perbanyak latihan di Pusdiklat.
              </p>

              <button
                id="btn-ban-pusdiklat"
                onClick={() => {
                  setBanActive(false);
                  setActiveView('pusdiklat');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl font-mono transition-transform active:scale-95"
              >
                MASUK SEKOLAH LATIHAN SEGERA
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main dynamic routing page viewports */}
      <main className="flex-1 flex flex-col">
        {activeView === 'driver' && myTrain ? (
          <MasinisDashboard
            train={myTrain}
            allTrains={activeTrains}
            signals={signals}
            pjls={pjls}
            career={career}
            switches={switches}
            onUpdateTrain={handleUpdateMyTrain}
            onToggleSignal={handleToggleSignal}
            onTogglePJL={handleTogglePJL}
            senderId={SENDER_ID}
            onSendChatMessage={sendChatMessage}
            onExit={() => {
              // Mark train back as AI so other users can take-over or system sweeps
              if (myDriverTrainId) {
                const targetTrain = activeTrains.find(t => t.id === myDriverTrainId);
                const updatedTarget: Train = targetTrain ? {
                  ...targetTrain,
                  isAI: true,
                  driverName: 'AI Masinis'
                } : {
                  id: myDriverTrainId,
                  name: 'KRL Commuter Line',
                  type: 'KRL_8' as any,
                  isAI: true,
                  driverName: 'AI Masinis',
                  direction: LineDirection.Hilir,
                  kp: 20.0,
                  speed: 0,
                  maxSpeed: 90,
                  targetSpeedLimit: 90,
                  currentPlatformId: null,
                  doorsOpen: false,
                  throttle: 0,
                  brake: 5,
                  reverser: 'N',
                  horn: false,
                  emergencyBrake: false,
                  currentTrackId: 'Main-Hilir',
                  cargoType: 'Passengers',
                  lastStopKp: null,
                  hasCollided: false,
                  isBanned: false
                };
                setActiveTrains(prev => prev.map(t => t.id === myDriverTrainId ? updatedTarget : t));
                broadcastStateChange('TRAIN_TAKEOVER', { trainId: myDriverTrainId, driverName: 'AI Masinis' }, SENDER_ID);
                saveSharedTrain(updatedTarget);
              }
              setMyDriverTrainId(null);
              setActiveView('lobby');
            }}
          />
        ) : activeView === 'ppka' ? (
          !ppkaAuthority ? (
            <PpkaAuthorityGate
              onlinePlayers={onlinePlayers}
              myUsername={career.username}
              onSelect={(authority) => setPpkaAuthority(authority)}
              onCancel={() => setActiveView('lobby')}
            />
          ) : (
          <PpkasDashboard
            signals={signals}
            switches={switches}
            pjls={pjls}
            activeTrains={activeTrains}
            career={career}
            senderId={SENDER_ID}
            ppkaAuthority={ppkaAuthority}
            onToggleSignal={handleToggleSignal}
            onToggleSwitch={handleToggleSwitch}
            onTogglePJL={handleTogglePJL}
            onSendChatMessage={sendChatMessage}
            chatMessages={chatMessages}
            onExit={() => {
              setPpkaAuthority(null);
              setActiveView('lobby');
            }}
            onSpawnAITrain={(name, type, direction, kp) => {
              const newTrainId = 'KA-AI-' + Math.floor(100 + Math.random() * 900).toString();
              const newTrain: Train = {
                id: newTrainId,
                name,
                type,
                isAI: true,
                driverName: 'AI Masinis',
                direction,
                kp,
                speed: 0,
                maxSpeed: type === TrainType.KRL_8 ? 80 : 95,
                targetSpeedLimit: 90,
                throttle: 15, // Put low throttle so it begins crawling when brakes are released
                brake: 100, // Fully braked; will release when signal is yellow/green
                reverser: direction === LineDirection.Hilir ? 'F' : 'R',
                doorsOpen: false,
                currentPlatformId: null,
                isBanned: false,
                horn: false,
                emergencyBrake: false,
                currentTrackId: direction === LineDirection.Hilir ? 'Main-Hilir' : 'Main-Hulu',
                cargoType: type === TrainType.CC206 && name.includes('Barang') ? 'Freight' : 'Passengers',
                lastStopKp: null,
                hasCollided: false
              };
              setActiveTrains(prev => {
                if (prev.some(t => t.id === newTrainId)) return prev;
                return [...prev, newTrain];
              });
              broadcastStateChange('TRAIN_UPDATE', newTrain, SENDER_ID);
              sendChatMessage(`Sistem Lintas: PPKA memunculkan dinasan kereta AI baru ${name} (${newTrainId}) posisi KM ${kp.toFixed(1)}!`, 'Sistem Lintas');
            }}
            onClearAllTrains={() => {
              setActiveTrains([]);
              broadcastStateChange('RESET_STATE', null, SENDER_ID);
              sendChatMessage(`Sistem Lintas: PPKA membersihkan seluruh armada kereta aktif di jalur!`, 'Sistem Lintas');
            }}
          />
          )
        ) : activeView === 'teknisi' ? (
          <TeknisiDashboard
            signals={signals}
            switches={switches}
            activeTrains={activeTrains}
            career={career}
            onUpdateTrain={handleUpdateMyTrain}
            onExit={() => setActiveView('lobby')}
            onSendChatMessage={sendChatMessage}
            onClearCollision={handleClearCollision}
          />
        ) : activeView === 'pusdiklat' ? (
          <PusdiklatYard
            career={career}
            onGrantLicense={handleGrantLicense}
            onExit={() => {
              if (career.points <= 0) {
                // Poin masih 0: tidak boleh kembali ke lobi sebelum lulus salah satu ujian
                // Pusdiklat (Masinis/PPKA/Teknisi) untuk mendapatkan poin kembali.
                sendChatMessage('Sekretariat: Poin PTS Anda 0 - selesaikan minimal satu ujian sertifikasi Pusdiklat terlebih dahulu untuk kembali ke lobi.', 'Sekretariat');
                return;
              }
              setActiveView('lobby');
            }}
            activeTrains={activeTrains}
            onSpawnAITrain={handleSpawnAITrain}
            onClearAllTrains={handleClearAllTrains}
          />
        ) : activeView === 'career' ? (
          <CareerCenter
            career={career}
            onResetCareer={handleResetCareer}
            onExit={() => setActiveView('lobby')}
          />
        ) : (
          <MultiplayerLobby
            career={career}
            activeTrains={activeTrains}
            onSpawnTrain={handleSpawnTrain}
            onTakeoverTrain={handleTakeoverTrain}
            onEnterPpkas={() => setActiveView('ppka')}
            onEnterTeknisi={() => setActiveView('teknisi')}
            onEnterPusdiklat={() => setActiveView('pusdiklat')}
            onBypassLicense={handleBypassLicense}
            onUsernameChange={handleUsernameChange}
            onlinePlayers={onlinePlayers}
          />
        )}
      </main>

      {/* Humble Footer */}
      <footer className="bg-slate-950/40 text-slate-600 text-[10px] text-center py-2.5 border-t border-indigo-950/20 leading-none">
        RRSid Prototype Indonesia • Dikembangkan secara modular menggunakan React, Tailwind, dan real-time Broadcast Sync. Harap tertib melintas.
      </footer>

    </div>
  );
}
