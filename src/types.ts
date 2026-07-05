export enum Role {
  Masinis = 'Masinis',
  PPKA_Dispatcher = 'PPKA_Dispatcher',
  PPKA_Operator_Sektor = 'PPKA_Operator_Sektor',
  PPKA_Operator_Stasion = 'PPKA_Operator_Stasion',
  PPKA_PJL = 'PPKA_PJL',
}

export enum CareerRank {
  Magang = 'Magang', // Langsir & small stations, low limits
  Muda = 'Muda',     // KRL 8-car, Zone 2/3
  Madya = 'Madya',   // KRL 10-12 car, Jarak Jauh CC201, Zone 2/3
  Utama = 'Utama',   // Full access (CC206, Manggarai, Chief Dispatcher)
}

export interface UserCareer {
  username: string;
  rank: CareerRank;
  points: number;
  hasLicense: boolean;
  isMasinisCertified?: boolean;
  isPpkaCertified?: boolean;
  isTeknisiCertified?: boolean;
  canJoinMultiplayer?: boolean;
  stats: {
    tripsCompleted: number;
    speedInfractions: number;
    redSignalViolations: number;
    platformStopsCorrect: number;
    collisions: number;
  };
}

export enum TrackType {
  MainLine = 'MainLine',
  Platform = 'Platform',
  SwitchFork = 'SwitchFork',
  Depot = 'Depot',
}

export enum SignalColor {
  Red = 'Red',     // Stop (unauthorized to pass)
  Yellow = 'Yellow',// Caution (prepare to stop at next signal, speed <= 30 km/h)
  Green = 'Green',  // Clear (proceed at line speed)
}

export enum LineDirection {
  Hulu = 'Hulu', // Up-Line heading to Jakarta Kota (North)
  Hilir = 'Hilir', // Down-Line heading to Bogor (South)
}

// Coordinate of a point in our 2D schematic map
export interface Coordinate {
  x: number; // mapped along route (0 = Jakarta, 100 = Bogor)
  y: number; // vertical height for schematic paths
}

export interface Station {
  id: string; // e.g. "JAKK", "MRI"
  name: string; // e.g. "Jakarta Kota"
  kp: number; // Kilometer Post (distance from Jakarta Kota in km)
  zone: 1 | 2 | 3 | 4;
  tracks: {
    id: number; // Track number (e.g. 1, 2, 3)
    type: TrackType;
    isPlatform: boolean;
    occupiedBy: string | null; // Train ID
    direction: LineDirection | 'Both';
  }[];
}

export interface SwitchWesel {
  id: string; // e.g. "W-JAKK-01"
  stationId: string | null;
  zone: 1 | 2 | 3 | 4;
  kp: number;
  direction: LineDirection;
  state: 'straight' | 'diverging';
  coords: {
    start: Coordinate;
    straightEnd: Coordinate;
    divergingEnd: Coordinate;
  };
}

export interface SignalBlock {
  id: string; // e.g. "S-MRI-Hilir-01"
  zone: 1 | 2 | 3 | 4;
  kp: number;
  direction: LineDirection;
  color: SignalColor;
  autoControl: boolean; // Managed by AI block section or manually by PPKA
}

export interface PJLCrossing {
  id: string; // e.g. "PJL-MRI-01"
  zone: 1 | 2 | 3 | 4;
  kp: number;
  name: string; // Road name
  isClosed: boolean; // gate barrier state (lowered = road closed, safe for train)
  sirenPlaying: boolean;
}

export enum TrainType {
  Langsir = 'Langsir',
  KRL_8 = 'KRL_8',
  KRL_12 = 'KRL_12',
  CC201 = 'CC201',
  CC206 = 'CC206',
}

export interface Train {
  id: string;
  name: string;
  type: TrainType;
  isAI: boolean;
  driverName: string | null;
  direction: LineDirection;
  // Position info
  kp: number; // Current Kilometer Post (0.0 to 54.8)
  speed: number; // Current speed in km/h
  maxSpeed: number; // Max allowed by rolling stock
  targetSpeedLimit: number; // Limit dictated by current track block or signal
  currentPlatformId: string | null; // Station platform currently stopped at
  doorsOpen: boolean;
  
  // Controls
  throttle: number; // 0 to 5 (notching)
  brake: number; // 0 to 5
  reverser: 'F' | 'N' | 'R';
  horn: boolean;
  emergencyBrake: boolean;

  // Track status
  currentTrackId: string; // e.g., "Main-Hilir" or "Station-MRI-Track-3"
  cargoType: 'Passengers' | 'Freight' | 'Maintenance';
  lastStopKp: number | null;
  hasCollided: boolean;
  isBanned: boolean;
  banReason?: string;
  lastStoppedStationId?: string | null;
  stopTimer?: number;
  routeBranch?: 'BogorLine' | 'CikarangLoop';
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: string | Role;
  message: string;
  timestamp: string;
}

export interface DispatcherLog {
  id: string;
  event: string;
  timestamp: string;
}

// Sistem role PPKA: sebelum masuk dashboard, pemain wajib memilih salah satu otoritas berikut.
// PK (Pusat Kendali) = memegang otoritas SATU zona penuh (semua stasiun di zona tsb).
// Station (PPKA Stasiun) = memegang otoritas SATU stasiun saja.
export type PpkaAuthority =
  | { type: 'PK'; zone: 1 | 2 | 3 | 4 }
  | { type: 'Station'; stationId: string; zone: 1 | 2 | 3 | 4 };
