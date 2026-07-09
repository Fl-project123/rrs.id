import { Train, SignalBlock, SwitchWesel, PJLCrossing, ChatMessage, UserCareer, CareerRank } from '../types';
import { SIGNALS, SWITCHES, PJLS } from '../data/tracks';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, push, set, onChildAdded, onValue, onDisconnect, remove, get, runTransaction } from 'firebase/database';
import { getFirestore, initializeFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyDFFKzwPV2eRvMe7zQqq0NdW2iDwlxGwJ0",
  authDomain: "rrsid-d28d1.firebaseapp.com",
  databaseURL: "https://rrsid-d28d1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rrsid-d28d1",
  storageBucket: "rrsid-d28d1.firebasestorage.app",
  messagingSenderId: "962361272670",
  appId: "1:962361272670:web:7f5d10b354fe6ed35a87cf",
  measurementId: "G-DK2Y13613K"
};

// Initialize Firebase App, Database & Firestore
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Configure Firebase App Check in DEBUG Mode immediately after app initialization
if (typeof window !== 'undefined') {
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const DebugAppCheckProviderFactory = {
  getInstance: () => ({})
};

try {
  if (typeof window !== 'undefined') {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider('6Ld-DummyKeyForAppCheckDebugMode'),
      isTokenAutoRefreshEnabled: true
    });
    console.log('Firebase App Check successfully initialized in DEBUG mode.');
  }
} catch (appCheckError) {
  console.warn('Firebase App Check debug mode warning:', appCheckError);
}

export const db = getDatabase(firebaseApp);
export const firestore = (() => {
  try {
    return initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch (err) {
    console.warn('initializeFirestore failed, falling back to getFirestore:', err);
    return getFirestore(firebaseApp);
  }
})();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'anonymous_rrsid_user',
      email: 'guest@rrsid.co.id',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Log a penalty or infraction into Firestore automatically
export async function logPenaltyInCloud(userId: string, violationType: string, banned: boolean, pointsDeducted: number) {
  try {
    const penaltyId = 'P-' + Date.now();
    await setDoc(doc(firestore, 'penalties', penaltyId), {
      userId,
      violationType,
      banned,
      bannedUntil: banned ? new Date(Date.now() + 60000).toISOString() : '',
      pointsDeducted,
      timestamp: new Date().toISOString()
    });
    console.log(`Penalty logged to Firestore: ${violationType} for user ${userId}`);
  } catch (error) {
    console.warn('Logging penalty to Firestore failed:', error);
  }
}

// Seed static zones, routes and dummy rooms into Cloud Firestore
export async function seedFirestoreOnce() {
  if (typeof window === 'undefined') return;
  const seeded = localStorage.getItem('rrsid_firestore_seeded_v1');
  if (seeded) return;

  try {
    // Seed map_zones
    await setDoc(doc(firestore, 'map_zones', 'zone_1'), { zoneId: 1, maxSpeedLimit: 90, description: "Manggarai Sektor Utara (UP-LINE)" });
    await setDoc(doc(firestore, 'map_zones', 'zone_2'), { zoneId: 2, maxSpeedLimit: 90, description: "Depok - Citayam Sektor Tengah" });
    await setDoc(doc(firestore, 'map_zones', 'zone_3'), { zoneId: 3, maxSpeedLimit: 90, description: "Bogor Sektor Selatan (DOWN-LINE)" });

    // Seed ai_schedules
    await setDoc(doc(firestore, 'ai_schedules', 'AI-KA-01'), { trainId: 'AI-KA-01', name: 'KRL Commuter Line #1522', path: 'Jakarta Kota ➔ Manggarai ➔ Depok ➔ Bogor (Hilir)' });
    await setDoc(doc(firestore, 'ai_schedules', 'AI-KA-02'), { trainId: 'AI-KA-02', name: 'KA Pangrango CC201 Sektor Bogor', path: 'Bogor ➔ Citayam (Hulu)' });
    await setDoc(doc(firestore, 'ai_schedules', 'AI-KA-03'), { trainId: 'AI-KA-03', name: 'KRL Commuter Line #1344', path: 'Jakarta Kota ➔ Depok ➔ Pasar Minggu (Hilir)' });

    // Seed rooms
    await setDoc(doc(firestore, 'rooms', 'R-4412'), { roomId: 'R-4412', status: 'LIVE', masinis: ['Masinis_Cepat'], ppkas: { zone1: 'PPKA_Jakarta', zone2: 'PPKA_Depok' } });
    await setDoc(doc(firestore, 'rooms', 'R-7801'), { roomId: 'R-7801', status: 'WAITING', masinis: [], ppkas: { zone3: 'PPKA_Bogor' } });

    // Seed some initial penalties for display
    await setDoc(doc(firestore, 'penalties', 'P-9921'), { userId: 'Kru_Pelanggar_Sinyal', violationType: 'Menerobos Sinyal CC Sektor 1', banned: true, bannedUntil: new Date(Date.now() + 600000).toISOString(), pointsDeducted: 100, timestamp: new Date(Date.now() - 3600000).toISOString() });
    await setDoc(doc(firestore, 'penalties', 'P-9922'), { userId: 'Magang_Akurasi', violationType: 'Sempurna Stop Peron Depok Baru', banned: false, bannedUntil: '', pointsDeducted: 0, timestamp: new Date(Date.now() - 1200000).toISOString() });

    localStorage.setItem('rrsid_firestore_seeded_v1', 'true');
    console.log('Firebase Cloud Firestore successfully seeded with static data, zones, and rules!');
  } catch (err) {
    console.warn('Silent Firestore seed skipped (probably offline fallback):', err);
  }
}

const CHANNEL_NAME = 'rrsid_multiplayer_channel';
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined') {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment.', e);
}

// Initial state helpers
export const INITIAL_CAREER: UserCareer = {
  username: 'Masinis_Cepat_Indo',
  rank: CareerRank.Magang,
  points: 0,
  hasLicense: false,
  isMasinisCertified: false,
  isPpkaCertified: false,
  isTeknisiCertified: false,
  canJoinMultiplayer: false,
  stats: {
    tripsCompleted: 0,
    speedInfractions: 0,
    redSignalViolations: 0,
    platformStopsCorrect: 0,
    collisions: 0
  }
};

/**
 * Calculates the distance between two coordinates using the Haversine formula
 * used to track proximity of trains, coupling zones, platforms, and track assets.
 * 
 * @param coord1 Array format [lat, lng] or [x, y]
 * @param coord2 Array format [lat, lng] or [x, y]
 * @returns distance in meters
 */
export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  if (!coord1 || !coord2) return Infinity;
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180; // radiant conversion
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

/**
 * Validates player eligibility to join the Multiplayer Server
 * Criteria: Player must be fully certified in ALL required roles (Masinis, PPKA, and Teknisi)
 * Or have earned their general license bypass badge.
 * 
 * @param career UserCareer object
 * @returns true if player is certified and eligible to access multiplayer lobby
 */
export function checkExamEligibility(career: UserCareer): boolean {
  // If user has bypassed or already had a general license, they are eligible
  if (career.hasLicense) return true;
  
  // Strict check: must have all certification exams completed
  return !!(career.isMasinisCertified && career.isPpkaCertified && career.isTeknisiCertified);
}

export const DEFAULT_AI_TRAINS: Train[] = [
  {
    id: 'AI-KA-01',
    name: 'KRL Commuter Line #1522',
    type: 'KRL_8' as any,
    isAI: true,
    driverName: 'AI Masinis',
    direction: 'Hilir' as any,
    kp: 5.0,
    speed: 0,
    maxSpeed: 90,
    targetSpeedLimit: 90,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'F',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Main_Line',
    cargoType: 'Passengers',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  },
  {
    id: 'AI-KA-02',
    name: 'KA Pangrango CC201 Sektor Bogor',
    type: 'CC201' as any,
    isAI: true,
    driverName: 'AI Masinis',
    direction: 'Hulu' as any,
    kp: 42.0,
    speed: 0,
    maxSpeed: 90,
    targetSpeedLimit: 90,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'F',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Main_Line',
    cargoType: 'Passengers',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  },
  {
    id: 'AI-KA-03',
    name: 'KRL Commuter Line #1344',
    type: 'KRL_12' as any,
    isAI: true,
    driverName: 'AI Masinis',
    direction: 'Hilir' as any,
    kp: 21.0,
    speed: 0,
    maxSpeed: 100,
    targetSpeedLimit: 90,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'F',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Main_Line',
    cargoType: 'Passengers',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  },
  {
    id: 'AI-KA-04',
    name: 'KA Jarak Jauh CC206 Argo Parahyangan',
    type: 'CC206' as any,
    isAI: true,
    driverName: 'AI Masinis',
    direction: 'Hulu' as any,
    kp: 11.5,
    speed: 0,
    maxSpeed: 110,
    targetSpeedLimit: 90,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'F',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Main_Line',
    cargoType: 'Passengers',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  },
  {
    id: 'AI-KA-05',
    name: 'KRL Commuter Line #1708 Sektor Depok',
    type: 'KRL_8' as any,
    isAI: true,
    driverName: 'AI Masinis',
    direction: 'Hilir' as any,
    kp: 31.5,
    speed: 0,
    maxSpeed: 90,
    targetSpeedLimit: 90,
    currentPlatformId: null,
    doorsOpen: false,
    throttle: 0,
    brake: 5,
    reverser: 'F',
    horn: false,
    emergencyBrake: false,
    currentTrackId: 'Main_Line',
    cargoType: 'Passengers',
    lastStopKp: null,
    hasCollided: false,
    isBanned: false
  }
];

export interface SyncPacket {
  type: 'TRAIN_UPDATE' | 'SIGNAL_TOGGLE' | 'SWITCH_TOGGLE' | 'PJL_TOGGLE' | 'CHAT_MESSAGE' | 'RESET_STATE' | 'TRAIN_TAKEOVER' | 'TRAIN_REMOVE' | 'VOICE_SIGNAL' | 'RADIO_PRESENCE';
  payload: any;
  senderId: string;
}

export function saveUserCareer(career: UserCareer) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('rrsid_user_career', JSON.stringify(career));
  }
  if (career && career.username) {
    const usernameLower = career.username.trim().toLowerCase();
    
    // 1. RTDB node save via atomic transaction to prevent overwriting/leakage/accidental reset
    const careerRef = ref(db, `user_accounts/${usernameLower}/career`);
    runTransaction(careerRef, (currentData) => {
      if (!currentData) {
        return career;
      }
      return {
        ...currentData,
        username: career.username,
        rank: career.rank,
        points: career.points,
        hasLicense: career.hasLicense,
        isMasinisCertified: career.isMasinisCertified !== undefined ? career.isMasinisCertified : (currentData.isMasinisCertified ?? false),
        isPpkaCertified: career.isPpkaCertified !== undefined ? career.isPpkaCertified : (currentData.isPpkaCertified ?? false),
        isTeknisiCertified: career.isTeknisiCertified !== undefined ? career.isTeknisiCertified : (currentData.isTeknisiCertified ?? false),
        canJoinMultiplayer: career.canJoinMultiplayer !== undefined ? career.canJoinMultiplayer : (currentData.canJoinMultiplayer ?? false),
        stats: {
          tripsCompleted: Math.max(career.stats?.tripsCompleted || 0, currentData.stats?.tripsCompleted || 0),
          speedInfractions: Math.max(career.stats?.speedInfractions || 0, currentData.stats?.speedInfractions || 0),
          redSignalViolations: Math.max(career.stats?.redSignalViolations || 0, currentData.stats?.redSignalViolations || 0),
          platformStopsCorrect: Math.max(career.stats?.platformStopsCorrect || 0, currentData.stats?.platformStopsCorrect || 0),
          collisions: Math.max(career.stats?.collisions || 0, currentData.stats?.collisions || 0),
        }
      };
    }).catch(err => {
      console.warn('Atomic RTDB career save failed:', err);
    });

    // 2. Cloud Firestore document save (Structured Profiles and Career progression)
    setDoc(doc(firestore, 'users', usernameLower), {
      username: career.username,
      rank: career.rank,
      points: career.points,
      hasLicense: career.hasLicense,
      stats: career.stats,
      updatedAt: new Date().toISOString()
    }).catch(err => {
      console.warn('Firestore UserProfile document save failed:', err);
    });
  }
}

export function loadUserCareer(): UserCareer {
  if (typeof window === 'undefined') return INITIAL_CAREER;
  const raw = localStorage.getItem('rrsid_user_career');
  if (!raw) {
    saveUserCareer(INITIAL_CAREER);
    return INITIAL_CAREER;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_CAREER;
  }
}

export function subscribeToSyncChannel(onMessage: (packet: SyncPacket) => void): () => void {
  // 1. Listen for local tab BroadcastChannel
  const listener = (event: MessageEvent<SyncPacket>) => {
    onMessage(event.data);
  };
  
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', listener);
  }

  // 2. Listen for network events via Firebase Realtime Database
  const eventsRef = ref(db, 'events');
  const startupTime = Date.now();
  
  const unsubFirebase = onChildAdded(eventsRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.senderId && data.type) {
      // Avoid storming client on old historic packets upon connection by checking timestamp
      if (data.timestamp && data.timestamp >= startupTime - 4000) {
        onMessage({
          type: data.type,
          payload: data.payload,
          senderId: data.senderId
        });
      }
    }
  });
  
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', listener);
    }
    unsubFirebase();
  };
}

export function sanitizeForFirebase(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = sanitizeForFirebase(val);
    }
  }
  return result;
}

export function broadcastStateChange(type: SyncPacket['type'], payload: any, senderId: string) {
  const cleanPayload = sanitizeForFirebase(payload);

  // 1. Broadcast to local tabs
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type,
      payload: cleanPayload,
      senderId
    });
  }

  // 2. Broadcast to Firebase Realtime Database for online multiplayer
  const eventsRef = ref(db, 'events');
  const newEventRef = push(eventsRef);
  set(newEventRef, {
    type,
    payload: cleanPayload,
    senderId,
    timestamp: Date.now()
  }).catch(err => {
    console.warn('Firebase network broadcast failed:', err);
  });

  // Self-cleaning mechanism on reset so the database doesn't expand limits
  if (type === 'RESET_STATE') {
    set(ref(db, 'events'), null).catch(err => {
      console.warn('Firebase clear events failed:', err);
    });
  }
}

// Generate unique session sender ID
export function generateSessionId(): string {
  return 'RRSID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Presence and Online Players Syncing helpers
export function syncUserPresence(
  senderId: string,
  career: UserCareer,
  role: string,
  trainName: string | null,
  ppkaAuthorityKey?: string | null
) {
  const playerRef = ref(db, `players/${senderId}`);
  onDisconnect(playerRef).remove().catch(err => {
    console.warn('onDisconnect registration failed:', err);
  });
  
  set(playerRef, {
    username: career.username,
    rank: career.rank,
    points: career.points,
    role,
    trainNameByDriver: trainName || null,
    // Contoh nilai: "PK-2" (PK memegang otoritas Zona 2) atau "STATION-MRI" (PPKA Stasiun Manggarai).
    // Dipakai untuk menghitung kapasitas kursi PPKA per zona/stasiun secara live lintas pemain.
    ppkaAuthorityKey: ppkaAuthorityKey || null,
    lastActive: Date.now()
  }).catch(err => {
    console.warn('Presence sync failed:', err);
  });
}

export function subscribeToOnlinePlayers(onPlayersUpdate: (players: any[]) => void): () => void {
  const playersRef = ref(db, 'players');
  return onValue(playersRef, (snapshot) => {
    const data = snapshot.val();
    const playersList: any[] = [];
    if (data) {
      Object.keys(data).forEach(id => {
        // filter out old/inactive ones if they didn't disconnect cleanly (older than 30s)
        if (Date.now() - data[id].lastActive < 30000) {
          playersList.push({
            id,
            username: data[id].username || 'Anonim',
            rank: data[id].rank || 'Magang',
            points: data[id].points || 0,
            role: data[id].role || 'Lobby',
            trainName: data[id].trainNameByDriver || null,
            ppkaAuthorityKey: data[id].ppkaAuthorityKey || null
          });
        }
      });
    }
    onPlayersUpdate(playersList);
  });
}

export function saveSharedSignal(signalId: string, color: string) {
  set(ref(db, `shared_state/signals/${signalId}`), color).catch(err => {
    console.warn('Realtime sync signal failed:', err);
  });
}

export function saveSharedSwitch(switchId: string, state: string) {
  set(ref(db, `shared_state/switches/${switchId}`), state).catch(err => {
    console.warn('Realtime sync switch failed:', err);
  });
}

export function saveSharedPJL(pjlId: string, isClosed: boolean) {
  set(ref(db, `shared_state/pjls/${pjlId}`), isClosed).catch(err => {
    console.warn('Realtime sync pjl failed:', err);
  });
}

export function saveSharedTrain(train: Train) {
  const cleanTrain = sanitizeForFirebase(train);
  set(ref(db, `shared_state/trains/${train.id}`), cleanTrain).catch(err => {
    console.warn('Realtime sync train failed:', err);
  });
}

export function removeSharedTrain(trainId: string) {
  remove(ref(db, `shared_state/trains/${trainId}`)).catch(err => {
    console.warn('Realtime remove train failed:', err);
  });
}

export function subscribeToSharedState(callbacks: {
  onSignalsUpdate?: (signals: Record<string, string>) => void;
  onSwitchesUpdate?: (switches: Record<string, string>) => void;
  onPJLsUpdate?: (pjls: Record<string, boolean>) => void;
  onTrainsUpdate?: (trains: Record<string, Train>) => void;
}) {
  const unsubs: (() => void)[] = [];

  if (callbacks.onSignalsUpdate) {
    unsubs.push(
      onValue(ref(db, 'shared_state/signals'), (snapshot) => {
        if (snapshot.exists()) {
          callbacks.onSignalsUpdate!(snapshot.val() as Record<string, string>);
        }
      })
    );
  }

  if (callbacks.onSwitchesUpdate) {
    unsubs.push(
      onValue(ref(db, 'shared_state/switches'), (snapshot) => {
        if (snapshot.exists()) {
          callbacks.onSwitchesUpdate!(snapshot.val() as Record<string, string>);
        }
      })
    );
  }

  if (callbacks.onPJLsUpdate) {
    unsubs.push(
      onValue(ref(db, 'shared_state/pjls'), (snapshot) => {
        if (snapshot.exists()) {
          callbacks.onPJLsUpdate!(snapshot.val() as Record<string, boolean>);
        }
      })
    );
  }

  if (callbacks.onTrainsUpdate) {
    unsubs.push(
      onValue(ref(db, 'shared_state/trains'), (snapshot) => {
        if (snapshot.exists()) {
          callbacks.onTrainsUpdate!(snapshot.val() as Record<string, Train>);
        }
      })
    );
  }

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}

export function initializeSharedStateOnServer() {
  get(ref(db, 'shared_state/signals')).then(snap => {
    if (!snap.exists()) {
      const initSigs: Record<string, string> = {};
      SIGNALS.forEach(s => {
        initSigs[s.id] = s.color;
      });
      set(ref(db, 'shared_state/signals'), initSigs);
    }
  });

  get(ref(db, 'shared_state/switches')).then(snap => {
    if (!snap.exists()) {
      const initSws: Record<string, string> = {};
      SWITCHES.forEach(s => {
        initSws[s.id] = s.state;
      });
      set(ref(db, 'shared_state/switches'), initSws);
    }
  });

  get(ref(db, 'shared_state/pjls')).then(snap => {
    if (!snap.exists()) {
      const initPjls: Record<string, boolean> = {};
      PJLS.forEach(p => {
        initPjls[p.id] = p.isClosed;
      });
      set(ref(db, 'shared_state/pjls'), initPjls);
    }
  });

  get(ref(db, 'shared_state/trains')).then(snap => {
    if (!snap.exists()) {
      const initTrs: Record<string, any> = {};
      DEFAULT_AI_TRAINS.forEach(t => {
        initTrs[t.id] = t;
      });
      set(ref(db, 'shared_state/trains'), initTrs);
    }
  });
}
