import { Coordinate, Station, SwitchWesel, SignalBlock, SignalColor, LineDirection, TrackType } from '../types';

// Schematic Map Data for GameCanvas and RealWorldMap aligning with KAI specifications (Update RRSid.png)
// Double track layout: Jalur Hulu (DOWNwards/Up-line towards Jakarta Kota/North), Jalur Hilir (UPwards/Down-line towards Bogor/South)
export const TRACK_SPACING = 30; // vertical distance between parallel tracks in pixels

export interface MappedStation {
  id: string;
  name: string;
  kp: number;
  branch: 'Utara' | 'Selatan' | 'Timur';
  x: number;
  yHilir: number;
  yHulu: number;
}

export interface MappedSwitch {
  id: string;
  stationId: string;
  kp: number;
  x: number; // X coordinate of switch point
  y: number; // Y coordinate of switch point
  direction: LineDirection;
  state: 'straight' | 'diverging';
  targetY: number; // Target Y coordinate when diverging
  type: 'diverge' | 'merge'; // diverge (splitting) or merge (joining back)
}

export interface MappedSignal {
  id: string;
  stationId: string;
  kp: number;
  x: number;
  y: number;
  direction: LineDirection;
  color: SignalColor;
  autoControl: boolean;
}

// 1. KOREKSI GEOGRAFIS JALUR (Pasar Senen BUKAN di Jalur Jakarta Kota!)
// Sektor 4 / Timur branch (Pasar Senen) is fully separated from the Manggarai - Jakarta Kota line.
// We define 3 branches from the Manggarai Hub (x=400):
// - Utara Branch (Manggarai -> Cikini -> Gondangdia -> Gambir -> Juanda -> Jakarta Kota)
// - Selatan Branch (Manggarai -> Tebet -> ... -> Depok -> Bogor)
// - Timur Branch (Manggarai -> Matraman -> Pondok Jati -> Kramat -> Gang Sentiong -> Pasar Senen)
export const SCHEMATIC_STATIONS: MappedStation[] = [
  // Utara Branch (Left side of hub)
  { id: 'JAKK', name: 'Jakarta Kota', kp: 0.0, branch: 'Utara', x: 80, yHilir: 90, yHulu: 150 },
  { id: 'CIK', name: 'Cikini', kp: 8.0, branch: 'Utara', x: 280, yHilir: 90, yHulu: 150 },

  // Hub Center Junction
  { id: 'MRI', name: 'Manggarai', kp: 9.8, branch: 'Utara', x: 400, yHilir: 150, yHulu: 210 },

  // Timur Branch (Sektor 4 / Pasar Senen - Upper Right side)
  { id: 'MTR', name: 'Matraman', kp: 9.0, branch: 'Timur', x: 500, yHilir: 30, yHulu: 60 },
  { id: 'PJT', name: 'Pondok Jati', kp: 7.9, branch: 'Timur', x: 620, yHilir: 30, yHulu: 60 },
  { id: 'KRT', name: 'Kramat', kp: 6.6, branch: 'Timur', x: 740, yHilir: 30, yHulu: 60 },
  { id: 'GST', name: 'Gang Sentiong', kp: 5.4, branch: 'Timur', x: 860, yHilir: 30, yHulu: 60 },
  { id: 'PSN', name: 'Pasar Senen', kp: 4.0, branch: 'Timur', x: 980, yHilir: 30, yHulu: 60 },

  // Selatan Branch (Lower Right side)
  { id: 'DPK', name: 'Depok', kp: 32.0, branch: 'Selatan', x: 780, yHilir: 250, yHulu: 310 },
  { id: 'BOO', name: 'Bogor', kp: 54.8, branch: 'Selatan', x: 1120, yHilir: 250, yHulu: 310 }
];

// Helper to determine active branch based on KP and routeBranch
export function getActiveBranch(kp: number, routeBranch?: 'BogorLine' | 'CikarangLoop'): 'Utara' | 'Selatan' | 'Timur' {
  if (routeBranch === 'CikarangLoop') {
    return 'Timur';
  }
  if (kp <= 9.8) {
    return 'Utara';
  }
  return 'Selatan';
}

// Convert KM Post (kp) and branch to X and Y base coordinates on schematic canvas
export function getCoordinatesAtKp(kp: number, direction: LineDirection, routeBranch?: 'BogorLine' | 'CikarangLoop'): { x: number; y: number } {
  const branch = getActiveBranch(kp, routeBranch);
  let x = 400;
  let y = 150;

  if (branch === 'Utara') {
    // Manggarai (9.8, x=400) to Jakarta Kota (0.0, x=80)
    const ratio = Math.max(0, Math.min(1, kp / 9.8));
    x = 80 + ratio * 320;
    y = direction === LineDirection.Hulu ? 150 : 90;
  } else if (branch === 'Timur') {
    // Manggarai (9.8, x=400) to Pasar Senen (4.0, x=980)
    // As KP decreases on Timur line, the train moves to the right towards Pasar Senen
    const ratio = Math.max(0, Math.min(1, (9.8 - kp) / 5.8));
    x = 400 + ratio * 580;
    y = direction === LineDirection.Hulu ? 60 : 30;
  } else {
    // Selatan: Manggarai (9.8, x=400) to Bogor (54.8, x=1120)
    const ratio = Math.max(0, Math.min(1, (kp - 9.8) / 45.0));
    x = 400 + ratio * 720;
    y = direction === LineDirection.Hulu ? 310 : 250;
  }

  return { x, y };
}

// Dynamic switches mapping at the boundaries of each station to support double track looping
export const SCHEMATIC_SWITCHES: MappedSwitch[] = [];
SCHEMATIC_STATIONS.forEach((st) => {
  // Hilir track (Left-to-Right entry)
  SCHEMATIC_SWITCHES.push({
    id: `W-${st.id}-Hilir-In`,
    stationId: st.id,
    kp: st.kp - 0.1,
    x: st.x - 60,
    y: st.yHilir,
    direction: LineDirection.Hilir,
    state: 'straight',
    targetY: st.yHilir - 15,
    type: 'diverge'
  });
  // Hilir track (Left-to-Right exit merge)
  SCHEMATIC_SWITCHES.push({
    id: `W-${st.id}-Hilir-Out`,
    stationId: st.id,
    kp: st.kp + 0.1,
    x: st.x + 60,
    y: st.yHilir - 15,
    direction: LineDirection.Hilir,
    state: 'straight',
    targetY: st.yHilir,
    type: 'merge'
  });

  // Hulu track (Right-to-Left entry)
  SCHEMATIC_SWITCHES.push({
    id: `W-${st.id}-Hulu-In`,
    stationId: st.id,
    kp: st.kp + 0.1,
    x: st.x + 60,
    y: st.yHulu,
    direction: LineDirection.Hulu,
    state: 'straight',
    targetY: st.yHulu + 15,
    type: 'diverge'
  });
  // Hulu track (Right-to-Left exit merge)
  SCHEMATIC_SWITCHES.push({
    id: `W-${st.id}-Hulu-Out`,
    stationId: st.id,
    kp: st.kp - 0.1,
    x: st.x - 60,
    y: st.yHulu + 15,
    direction: LineDirection.Hulu,
    state: 'straight',
    targetY: st.yHulu,
    type: 'merge'
  });

  // Crossover Tracks (Wesel Penyeberangan Ganda) for Stasiun Besar (JAKK, MRI, PSN, DPK, BOO)
  if (['JAKK', 'MRI', 'PSN', 'DPK', 'BOO'].includes(st.id)) {
    // Crossover before station (connecting Hilir to Hulu)
    SCHEMATIC_SWITCHES.push({
      id: `W-${st.id}-XOver-Before`,
      stationId: st.id,
      kp: st.kp - 0.25,
      x: st.x - 120,
      y: st.yHilir,
      direction: LineDirection.Hilir,
      state: 'straight',
      targetY: st.yHulu,
      type: 'diverge'
    });
    // Crossover after station (connecting Hulu to Hilir)
    SCHEMATIC_SWITCHES.push({
      id: `W-${st.id}-XOver-After`,
      stationId: st.id,
      kp: st.kp + 0.25,
      x: st.x + 120,
      y: st.yHulu,
      direction: LineDirection.Hulu,
      state: 'straight',
      targetY: st.yHilir,
      type: 'diverge'
    });
  }
});

// Dynamic signals mapping at each station (exit signals for both main and loop tracks)
export const SCHEMATIC_SIGNALS: MappedSignal[] = [];
SCHEMATIC_STATIONS.forEach((st) => {
  // Hilir Main exit signal
  SCHEMATIC_SIGNALS.push({
    id: `S-${st.id}-Hilir-Main`,
    stationId: st.id,
    kp: st.kp + 0.08,
    x: st.x + 40,
    y: st.yHilir,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  });
  // Hilir Loop exit signal
  SCHEMATIC_SIGNALS.push({
    id: `S-${st.id}-Hilir-Loop`,
    stationId: st.id,
    kp: st.kp + 0.08,
    x: st.x + 40,
    y: st.yHilir - 15,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  });

  // Hulu Main exit signal
  SCHEMATIC_SIGNALS.push({
    id: `S-${st.id}-Hulu-Main`,
    stationId: st.id,
    kp: st.kp - 0.08,
    x: st.x - 40,
    y: st.yHulu,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  });
  // Hulu Loop exit signal
  SCHEMATIC_SIGNALS.push({
    id: `S-${st.id}-Hulu-Loop`,
    stationId: st.id,
    kp: st.kp - 0.08,
    x: st.x - 40,
    y: st.yHulu + 15,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  });
});

// Helper to convert KM Post (kp) and route branch to X coordinate on schematic canvas
export function kpToX(kp: number, canvasWidth: number, routeBranch?: 'BogorLine' | 'CikarangLoop'): number {
  const coords = getCoordinatesAtKp(kp, LineDirection.Hilir, routeBranch);
  return coords.x;
}

// Helper to check if a train should stop due to red signal in front of it (Anti-Collision/SPAD)
export function checkSignalStop(
  kp: number,
  direction: LineDirection,
  signals: SignalBlock[],
  trainY: number,
  routeBranch?: 'BogorLine' | 'CikarangLoop'
): boolean {
  // HAPUS SISTEM E-BRAKE: Masinis yang melanggar sinyal akan langsung ditindak (banned & denda poin) oleh engine, sehingga sistem auto-stop otomatis ditiadakan.
  return false;
}
