import { Station, SwitchWesel, SignalBlock, PJLCrossing, SignalColor, LineDirection, TrackType } from '../types';

export const STATIONS: Station[] = [
  {
    id: 'JAKK',
    name: 'Jakarta Kota',
    kp: 0.0,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
      { id: 3, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
      { id: 4, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
    ]
  },
  {
    id: 'JYK',
    name: 'Jayakarta',
    kp: 1.4,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'MGB',
    name: 'Mangga Besar',
    kp: 2.4,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'SWB',
    name: 'Sawah Besar',
    kp: 3.7,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'JUA',
    name: 'Juanda',
    kp: 4.5,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'GMR',
    name: 'Gambir',
    kp: 5.5,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'GDD',
    name: 'Gondangdia',
    kp: 6.5,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'CIK',
    name: 'Cikini',
    kp: 8.0,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'MRI',
    name: 'Manggarai',
    kp: 9.8,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 3, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 4, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
    ]
  },
  {
    id: 'TEB',
    name: 'Tebet',
    kp: 12.4,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'CWG',
    name: 'Cawang',
    kp: 13.7,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'DKB',
    name: 'Duren Kalibata',
    kp: 15.2,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'PMB',
    name: 'Pasar Minggu Baru',
    kp: 16.7,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'PSM',
    name: 'Pasar Minggu',
    kp: 18.2,
    zone: 1,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'TNT',
    name: 'Tanjung Barat',
    kp: 21.5,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'LTA',
    name: 'Lenteng Agung',
    kp: 23.9,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'UP',
    name: 'Upacara Pancasila',
    kp: 25.9,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'UI',
    name: 'Univ. Indonesia',
    kp: 27.2,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'POC',
    name: 'Pondok Cina',
    kp: 28.3,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'DPB',
    name: 'Depok Baru',
    kp: 31.1,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'DP',
    name: 'Depok',
    kp: 32.7,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
      { id: 3, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
    ]
  },
  {
    id: 'CTA',
    name: 'Citayam',
    kp: 37.8,
    zone: 2,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
    ]
  },
  {
    id: 'BJD',
    name: 'Bojonggede',
    kp: 44.5,
    zone: 3,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'CLT',
    name: 'Cilebut',
    kp: 49.3,
    zone: 3,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'BOO',
    name: 'Bogor',
    kp: 54.8,
    zone: 3,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
      { id: 3, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: 'Both' },
    ]
  },
  {
    id: 'PSN',
    name: 'Pasar Senen',
    kp: 4.0,
    zone: 4,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'GST',
    name: 'Gang Sentiong',
    kp: 5.4,
    zone: 4,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'KRT',
    name: 'Kramat',
    kp: 6.6,
    zone: 4,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'PJT',
    name: 'Pondok Jati',
    kp: 7.9,
    zone: 4,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir },
      { id: 3, type: TrackType.SwitchFork, isPlatform: false, occupiedBy: null, direction: 'Both' }
    ]
  },
  {
    id: 'MTR',
    name: 'Matraman',
    kp: 9.0,
    zone: 4,
    tracks: [
      { id: 1, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hulu },
      { id: 2, type: TrackType.Platform, isPlatform: true, occupiedBy: null, direction: LineDirection.Hilir }
    ]
  }
];

export const SWITCHES: SwitchWesel[] = [
  {
    id: 'W-JAKK-01',
    stationId: 'JAKK',
    zone: 1,
    kp: 0.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 4, y: 35 },
      straightEnd: { x: 8, y: 35 },
      divergingEnd: { x: 8, y: 20 }
    }
  },
  {
    id: 'W-JAKK-02',
    stationId: 'JAKK',
    zone: 1,
    kp: 0.6,
    direction: LineDirection.Hulu,
    state: 'straight',
    coords: {
      start: { x: 8, y: 50 },
      straightEnd: { x: 4, y: 50 },
      divergingEnd: { x: 4, y: 65 }
    }
  },
  {
    id: 'W-MRI-01',
    stationId: 'MRI',
    zone: 1,
    kp: 9.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 16, y: 35 },
      straightEnd: { x: 20, y: 35 },
      divergingEnd: { x: 20, y: 20 }
    }
  },
  {
    id: 'W-MRI-02',
    stationId: 'MRI',
    zone: 1,
    kp: 10.2,
    direction: LineDirection.Hulu,
    state: 'straight',
    coords: {
      start: { x: 20, y: 50 },
      straightEnd: { x: 16, y: 50 },
      divergingEnd: { x: 16, y: 65 }
    }
  },
  {
    id: 'W-DP-01',
    stationId: 'DP',
    zone: 2,
    kp: 32.3,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 52, y: 35 },
      straightEnd: { x: 56, y: 35 },
      divergingEnd: { x: 56, y: 20 }
    }
  },
  {
    id: 'W-CTA-01',
    stationId: 'CTA',
    zone: 2,
    kp: 38.2,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 67, y: 35 },
      straightEnd: { x: 71, y: 35 },
      divergingEnd: { x: 71, y: 50 }
    }
  },
  {
    id: 'W-BOO-01',
    stationId: 'BOO',
    zone: 3,
    kp: 54.2,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 92, y: 35 },
      straightEnd: { x: 95, y: 35 },
      divergingEnd: { x: 95, y: 20 }
    }
  },
  {
    id: 'W-PSN-01',
    stationId: 'PSN',
    zone: 4,
    kp: 4.2,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 40, y: 35 },
      straightEnd: { x: 44, y: 35 },
      divergingEnd: { x: 44, y: 20 }
    }
  },
  {
    id: 'W-MRI-03',
    stationId: 'MRI',
    zone: 4,
    kp: 9.3,
    direction: LineDirection.Hulu,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  },
  {
    // Wesel Percabangan Pasar Senen <-> Manggarai: menentukan tujuan akhir kereta yang baru
    // selesai menempuh jalur lingkar Sektor 4 (Pasar Senen - Kramat - Pondok Jati - Matraman)
    // dan kembali bergabung ke jalur utama di Manggarai. state 'straight' = lanjut ke arah
    // Bogor (Hilir), state 'diverging' = balik memutar ke arah Jakarta Kota (Hulu).
    // Sebelumnya keputusan ini di-hardcode berdasarkan NAMA kereta ("#2041") di App.tsx,
    // yang tidak logis karena tidak bisa diatur PPKA. Sekarang wesel inilah yang menentukan.
    id: 'W-MRI-04',
    stationId: 'MRI',
    zone: 4,
    kp: 9.6,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 55 },
      straightEnd: { x: 50, y: 55 },
      divergingEnd: { x: 50, y: 40 }
    }
  },
  // Crossover Tracks (Wesel Penyeberangan Ganda) for major stations
  { 
    id: 'W-JAKK-XOver-Before', 
    stationId: 'JAKK', 
    zone: 1, 
    kp: -0.25, 
    direction: LineDirection.Hilir, 
    state: 'straight',
    coords: {
      start: { x: 4.5, y: 30 },
      straightEnd: { x: 5.5, y: 30 },
      divergingEnd: { x: 5.5, y: 40 }
    }
  },
  { 
    id: 'W-JAKK-XOver-After', 
    stationId: 'JAKK', 
    zone: 1, 
    kp: 0.25, 
    direction: LineDirection.Hulu, 
    state: 'straight',
    coords: {
      start: { x: 5.5, y: 30 },
      straightEnd: { x: 6.5, y: 30 },
      divergingEnd: { x: 6.5, y: 40 }
    }
  },
  { 
    id: 'W-MRI-XOver-Before', 
    stationId: 'MRI', 
    zone: 1, 
    kp: 9.55, 
    direction: LineDirection.Hilir, 
    state: 'straight',
    coords: {
      start: { x: 20.0, y: 30 },
      straightEnd: { x: 21.0, y: 30 },
      divergingEnd: { x: 21.0, y: 40 }
    }
  },
  { 
    id: 'W-MRI-XOver-After', 
    stationId: 'MRI', 
    zone: 1, 
    kp: 10.05, 
    direction: LineDirection.Hulu, 
    state: 'straight',
    coords: {
      start: { x: 21.0, y: 30 },
      straightEnd: { x: 22.0, y: 30 },
      divergingEnd: { x: 22.0, y: 40 }
    }
  },
  { 
    id: 'W-PSN-XOver-Before', 
    stationId: 'PSN', 
    zone: 4, 
    kp: 3.75, 
    direction: LineDirection.Hilir, 
    state: 'straight',
    coords: {
      start: { x: 11.0, y: 65 },
      straightEnd: { x: 12.0, y: 65 },
      divergingEnd: { x: 12.0, y: 75 }
    }
  },
  { 
    id: 'W-PSN-XOver-After', 
    stationId: 'PSN', 
    zone: 4, 
    kp: 4.25, 
    direction: LineDirection.Hulu, 
    state: 'straight',
    coords: {
      start: { x: 12.0, y: 65 },
      straightEnd: { x: 13.0, y: 65 },
      divergingEnd: { x: 13.0, y: 75 }
    }
  },
  { 
    id: 'W-DPK-XOver-Before', 
    stationId: 'DPK', 
    zone: 2, 
    kp: 31.75, 
    direction: LineDirection.Hilir, 
    state: 'straight',
    coords: {
      start: { x: 56.5, y: 30 },
      straightEnd: { x: 57.5, y: 30 },
      divergingEnd: { x: 57.5, y: 40 }
    }
  },
  { 
    id: 'W-DPK-XOver-After', 
    stationId: 'DPK', 
    zone: 2, 
    kp: 32.25, 
    direction: LineDirection.Hulu, 
    state: 'straight',
    coords: {
      start: { x: 57.5, y: 30 },
      straightEnd: { x: 58.5, y: 30 },
      divergingEnd: { x: 58.5, y: 40 }
    }
  },
  { 
    id: 'W-BOO-XOver-Before', 
    stationId: 'BOO', 
    zone: 3, 
    kp: 54.55, 
    direction: LineDirection.Hilir, 
    state: 'straight',
    coords: {
      start: { x: 94.0, y: 30 },
      straightEnd: { x: 95.0, y: 30 },
      divergingEnd: { x: 95.0, y: 40 }
    }
  },
  { 
    id: 'W-BOO-XOver-After', 
    stationId: 'BOO', 
    zone: 3, 
    kp: 55.05, 
    direction: LineDirection.Hulu, 
    state: 'straight',
    coords: {
      start: { x: 95.0, y: 30 },
      straightEnd: { x: 96.0, y: 30 },
      divergingEnd: { x: 96.0, y: 40 }
    }
  },
  // ============================================================
  // Wesel standar untuk stasiun kecil/sedang (belum punya percabangan sebelumnya)
  // ============================================================
  {
    id: 'W-JYK-01',
    stationId: 'JYK',
    zone: 1,
    kp: 1.4,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Jayakarta (KM 1.4) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-MGB-01',
    stationId: 'MGB',
    zone: 1,
    kp: 2.4,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Mangga Besar (KM 2.4) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-JUA-01',
    stationId: 'JUA',
    zone: 1,
    kp: 4.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Juanda (KM 4.5) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-GDD-01',
    stationId: 'GDD',
    zone: 1,
    kp: 6.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Gondangdia (KM 6.5) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-CWG-01',
    stationId: 'CWG',
    zone: 1,
    kp: 13.7,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Cawang (KM 13.7) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-PMB-01',
    stationId: 'PMB',
    zone: 1,
    kp: 16.7,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Pasar Minggu Baru (KM 16.7) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-UP-01',
    stationId: 'UP',
    zone: 2,
    kp: 25.9,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Upacara Pancasila (KM 25.9) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-UI-01',
    stationId: 'UI',
    zone: 2,
    kp: 27.2,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Univ. Indonesia (KM 27.2) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-DPB-01',
    stationId: 'DPB',
    zone: 2,
    kp: 31.1,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Depok Baru (KM 31.1) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-KRT-01',
    stationId: 'KRT',
    zone: 4,
    kp: 6.6,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Kramat (KM 6.6) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-SWB-01',
    stationId: 'SWB',
    zone: 1,
    kp: 3.7,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Sawah Besar (KM 3.7) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-GMR-01',
    stationId: 'GMR',
    zone: 1,
    kp: 5.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Gambir (KM 5.5) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-CIK-01',
    stationId: 'CIK',
    zone: 1,
    kp: 8.0,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Cikini (KM 8.0) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-TEB-01',
    stationId: 'TEB',
    zone: 1,
    kp: 12.4,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Tebet (KM 12.4) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-DKB-01',
    stationId: 'DKB',
    zone: 1,
    kp: 15.2,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Duren Kalibata (KM 15.2) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-PSM-01',
    stationId: 'PSM',
    zone: 1,
    kp: 18.2,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Pasar Minggu (KM 18.2) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-TNT-01',
    stationId: 'TNT',
    zone: 2,
    kp: 21.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Tanjung Barat (KM 21.5) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-LTA-01',
    stationId: 'LTA',
    zone: 2,
    kp: 23.9,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Lenteng Agung (KM 23.9) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-POC-01',
    stationId: 'POC',
    zone: 2,
    kp: 28.3,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Pondok Cina (KM 28.3) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-BJD-01',
    stationId: 'BJD',
    zone: 3,
    kp: 44.5,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Bojonggede (KM 44.5) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-CLT-01',
    stationId: 'CLT',
    zone: 3,
    kp: 49.3,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Cilebut (KM 49.3) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-GST-01',
    stationId: 'GST',
    zone: 4,
    kp: 5.4,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Gang Sentiong (KM 5.4) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
  {
    id: 'W-PJT-01',
    stationId: 'PJT',
    zone: 4,
    kp: 7.9,
    direction: LineDirection.Hilir,
    state: 'straight',
    coords: {
      start: { x: 46, y: 50 },
      straightEnd: { x: 42, y: 50 },
      divergingEnd: { x: 42, y: 65 }
    }
  }, // Wesel sepur simpang Stasiun Pondok Jati (KM 7.9) - standar 1 sepur belok untuk persilangan/penyusulan KA di stasiun kecil/sedang sesuai ketentuan KAI.
];

export const SIGNALS: SignalBlock[] = [
  { id: 'S-JAKK-Hilir-01', zone: 1, kp: 0.4, direction: LineDirection.Hilir, color: SignalColor.Red, autoControl: false }, // Protective for W-JAKK-01
  { id: 'S-JAKK-Hilir-01b', zone: 1, kp: 1.0, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },
  { id: 'S-JAKK-Hulu-02', zone: 1, kp: 0.7, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false }, // Protective for W-JAKK-02
  { id: 'S-MRI-Hulu-01', zone: 1, kp: 8.5, direction: LineDirection.Hulu, color: SignalColor.Green, autoControl: true },
  { id: 'S-MRI-Hilir-01', zone: 1, kp: 9.3, direction: LineDirection.Hilir, color: SignalColor.Red, autoControl: false }, // Protective for W-MRI-01
  { id: 'S-MRI-Hulu-02', zone: 1, kp: 10.3, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false }, // Protective for W-MRI-02
  { id: 'S-MRI-Hilir-02', zone: 1, kp: 10.5, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },
  { id: 'S-PSM-Hulu-01', zone: 1, kp: 17.5, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false },
  { id: 'S-PSM-Hilir-01', zone: 1, kp: 18.8, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },

  { id: 'S-TNT-Hulu-01', zone: 2, kp: 21.0, direction: LineDirection.Hulu, color: SignalColor.Green, autoControl: true },
  { id: 'S-TNT-Hilir-01', zone: 2, kp: 22.0, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },
  { id: 'S-DP-Hulu-01', zone: 2, kp: 31.5, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false },
  { id: 'S-DP-Hulu-02', zone: 2, kp: 32.5, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false }, // Protective for W-DP-01 Hulu
  { id: 'S-DP-Hilir-02', zone: 2, kp: 32.1, direction: LineDirection.Hilir, color: SignalColor.Red, autoControl: false }, // Protective for W-DP-01
  { id: 'S-DP-Hilir-01', zone: 2, kp: 33.2, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },
  { id: 'S-CTA-Hulu-01', zone: 2, kp: 37.0, direction: LineDirection.Hulu, color: SignalColor.Green, autoControl: true },
  { id: 'S-CTA-Hulu-02', zone: 2, kp: 38.4, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false }, // Protective for W-CTA-01 Hulu
  { id: 'S-CTA-Hilir-02', zone: 2, kp: 38.0, direction: LineDirection.Hilir, color: SignalColor.Red, autoControl: false }, // Protective for W-CTA-01
  { id: 'S-CTA-Hilir-01', zone: 2, kp: 38.5, direction: LineDirection.Hilir, color: SignalColor.Red, autoControl: false },

  { id: 'S-BJD-Hulu-01', zone: 3, kp: 43.8, direction: LineDirection.Hulu, color: SignalColor.Green, autoControl: true },
  { id: 'S-BJD-Hilir-01', zone: 3, kp: 45.2, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },
  { id: 'S-CLT-Hulu-01', zone: 3, kp: 48.5, direction: LineDirection.Hulu, color: SignalColor.Green, autoControl: true },
  { id: 'S-CLT-Hilir-01', zone: 3, kp: 49.8, direction: LineDirection.Hilir, color: SignalColor.Green, autoControl: true },
  { id: 'S-BOO-Hilir-01', zone: 3, kp: 54.1, direction: LineDirection.Hilir, color: SignalColor.Red, autoControl: false }, // Protective for W-BOO-01
  { id: 'S-BOO-Hulu-01', zone: 3, kp: 53.5, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false },
  { id: 'S-BOO-Hulu-02', zone: 3, kp: 54.3, direction: LineDirection.Hulu, color: SignalColor.Red, autoControl: false }, // Protective for W-BOO-01 Hulu outgoing
  // ==========================================
  // SEKTOR 4: JALUR LINGKAR TIMUR (PASAR SENEN LOOP)
  // Standard KAI Signalling and Protective Overlap Placement Rules:
  // - Sinyal Masuk ditempatkan sebelum wesel masuk stasiun dengan safety overlap pengereman aman.
  // - Posisi diletakkan di sisi kiri jalur (sesuai aturan Left-Hand Running Indonesia).
  // - Penempatan didasarkan pada visibilitas optimal masinis (ruang bebas pandang) dan profil pengereman 90 km/h ke 0 km/h.
  // ==========================================
  { 
    id: 'S-PSN-Masuk-Hilir', 
    zone: 4, 
    kp: 3.8, 
    direction: LineDirection.Hilir, 
    color: SignalColor.Red, 
    autoControl: false // Sinyal Masuk Utama (Protective) dikendalikan manual/otomatis rute peron oleh PPKA
  }, // Tech Comment: "Sinyal Masuk Pasar Senen Hilir di KM 3.8 ditempatkan sebelum wesel W-PSN-01 untuk melindungi perpindahan peron dan memberi safety margin pengereman penuh."
  { 
    id: 'S-PSN-Keluar-Hulu', 
    zone: 4, 
    kp: 4.5, 
    direction: LineDirection.Hulu, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Keluar Pasar Senen Hulu di KM 4.5 mengatur keberangkatan ke arah Gang Sentiong."
  { 
    id: 'S-GST-Hilir', 
    zone: 4, 
    kp: 5.1, 
    direction: LineDirection.Hilir, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Gang Sentiong Hilir di KM 5.1 menjaga jarak blok aman antara stasiun Pasar Senen dan peron Gang Sentiong."
  { 
    id: 'S-GST-Hulu', 
    zone: 4, 
    kp: 5.7, 
    direction: LineDirection.Hulu, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Gang Sentiong Hulu di KM 5.7 mengamankan blok jalan bebas menuju Pasar Senen bagi kereta arah Hulu."
  { 
    id: 'S-KRT-Hilir', 
    zone: 4, 
    kp: 6.3, 
    direction: LineDirection.Hilir, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Kramat Hilir di KM 6.3 menyediakan safety block otomatis untuk peron Kramat dari arah Gang Sentiong."
  { 
    id: 'S-KRT-Hulu', 
    zone: 4, 
    kp: 6.9, 
    direction: LineDirection.Hulu, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Kramat Hulu di KM 6.9 mengamankan petak jalan dari Pondok Jati menuju Kramat."
  { 
    id: 'S-PJT-Hilir', 
    zone: 4, 
    kp: 7.6, 
    direction: LineDirection.Hilir, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Pondok Jati Hilir di KM 7.6 melindungi peron lengkung Pondok Jati agar tidak dimasuki sebelum blok depan steril."
  { 
    id: 'S-PJT-Hulu', 
    zone: 4, 
    kp: 8.2, 
    direction: LineDirection.Hulu, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Pondok Jati Hulu di KM 8.2 dipasang di sisi kiri jalur ganda untuk jarak pandang maksimum masinis melintasi lengkung s."
  { 
    id: 'S-MTR-Hilir', 
    zone: 4, 
    kp: 8.7, 
    direction: LineDirection.Hilir, 
    color: SignalColor.Green, 
    autoControl: true 
  }, // Tech Comment: "Sinyal Blok Matraman Hilir di KM 8.7 memberikan block spacing krusial sebelum memasuki Manggarai Hub."
  { 
    id: 'S-MTR-Masuk-Hulu', 
    zone: 4, 
    kp: 9.45, 
    direction: LineDirection.Hulu, 
    color: SignalColor.Red, 
    autoControl: false // Sinyal Masuk Percabangan (Protective) sebelum wesel W-MRI-03
  }, // Tech Comment: "Sinyal Masuk Matraman Hulu di KM 9.45 dipasang 150m sebelum wesel percabangan W-MRI-03 (KM 9.3) untuk menghentikan kereta arah utara dengan overlap pengereman aman jika wesel sedang dilalui rute Manggarai lainnya. (Diperbaiki: sebelumnya berada di KP yang sama persis dengan wesel, KM 9.3, sehingga tidak ada jarak aman berhenti - melanggar ketentuan penempatan sinyal pelindung KAI.)"
  {
    // Sinyal pelindung untuk W-MRI-04 (percabangan Pasar Senen <-> Manggarai). Ditempatkan
    // sebelum wesel (KM 9.4 < KM 9.6, arah Hilir) sehingga masinis wajib berhenti dulu di
    // sinyal merah jika PPKA belum menetapkan arah wesel (Bogor atau Jakarta Kota).
    id: 'S-MTR-Percabangan-Hilir',
    zone: 4,
    kp: 9.4,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  },
  // ============================================================
  // Sinyal pelindung standar untuk wesel stasiun kecil/sedang di atas
  // (2 sinyal per stasiun: Masuk Hilir + Masuk Hulu, masing-masing 150m
  // sebelum tombol pemindah wesel, sesuai ketentuan penempatan sinyal KAI)
  // ============================================================
  {
    id: 'S-JYK-Masuk-Hilir',
    zone: 1,
    kp: 1.25,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Jayakarta, 150m sebelum wesel W-JYK-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-JYK-Masuk-Hulu',
    zone: 1,
    kp: 1.55,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Jayakarta, 150m sebelum wesel W-JYK-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-MGB-Masuk-Hilir',
    zone: 1,
    kp: 2.25,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Mangga Besar, 150m sebelum wesel W-MGB-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-MGB-Masuk-Hulu',
    zone: 1,
    kp: 2.55,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Mangga Besar, 150m sebelum wesel W-MGB-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-JUA-Masuk-Hilir',
    zone: 1,
    kp: 4.35,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Juanda, 150m sebelum wesel W-JUA-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-JUA-Masuk-Hulu',
    zone: 1,
    kp: 4.65,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Juanda, 150m sebelum wesel W-JUA-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-GDD-Masuk-Hilir',
    zone: 1,
    kp: 6.35,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Gondangdia, 150m sebelum wesel W-GDD-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-GDD-Masuk-Hulu',
    zone: 1,
    kp: 6.65,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Gondangdia, 150m sebelum wesel W-GDD-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-CWG-Masuk-Hilir',
    zone: 1,
    kp: 13.55,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Cawang, 150m sebelum wesel W-CWG-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-CWG-Masuk-Hulu',
    zone: 1,
    kp: 13.85,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Cawang, 150m sebelum wesel W-CWG-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-PMB-Masuk-Hilir',
    zone: 1,
    kp: 16.55,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Pasar Minggu Baru, 150m sebelum wesel W-PMB-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-PMB-Masuk-Hulu',
    zone: 1,
    kp: 16.85,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Pasar Minggu Baru, 150m sebelum wesel W-PMB-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-UP-Masuk-Hilir',
    zone: 2,
    kp: 25.75,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Upacara Pancasila, 150m sebelum wesel W-UP-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-UP-Masuk-Hulu',
    zone: 2,
    kp: 26.05,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Upacara Pancasila, 150m sebelum wesel W-UP-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-UI-Masuk-Hilir',
    zone: 2,
    kp: 27.05,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Univ. Indonesia, 150m sebelum wesel W-UI-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-UI-Masuk-Hulu',
    zone: 2,
    kp: 27.35,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Univ. Indonesia, 150m sebelum wesel W-UI-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-DPB-Masuk-Hilir',
    zone: 2,
    kp: 30.95,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Depok Baru, 150m sebelum wesel W-DPB-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-DPB-Masuk-Hulu',
    zone: 2,
    kp: 31.25,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Depok Baru, 150m sebelum wesel W-DPB-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-KRT-Masuk-Hilir',
    zone: 4,
    kp: 6.45,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Kramat, 150m sebelum wesel W-KRT-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-KRT-Masuk-Hulu',
    zone: 4,
    kp: 6.75,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Kramat, 150m sebelum wesel W-KRT-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-SWB-Masuk-Hilir',
    zone: 1,
    kp: 3.55,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Sawah Besar, 150m sebelum wesel W-SWB-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-SWB-Masuk-Hulu',
    zone: 1,
    kp: 3.85,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Sawah Besar, 150m sebelum wesel W-SWB-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-GMR-Masuk-Hilir',
    zone: 1,
    kp: 5.35,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Gambir, 150m sebelum wesel W-GMR-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-GMR-Masuk-Hulu',
    zone: 1,
    kp: 5.65,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Gambir, 150m sebelum wesel W-GMR-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-CIK-Masuk-Hilir',
    zone: 1,
    kp: 7.85,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Cikini, 150m sebelum wesel W-CIK-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-CIK-Masuk-Hulu',
    zone: 1,
    kp: 8.15,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Cikini, 150m sebelum wesel W-CIK-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-TEB-Masuk-Hilir',
    zone: 1,
    kp: 12.25,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Tebet, 150m sebelum wesel W-TEB-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-TEB-Masuk-Hulu',
    zone: 1,
    kp: 12.55,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Tebet, 150m sebelum wesel W-TEB-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-DKB-Masuk-Hilir',
    zone: 1,
    kp: 15.05,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Duren Kalibata, 150m sebelum wesel W-DKB-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-DKB-Masuk-Hulu',
    zone: 1,
    kp: 15.35,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Duren Kalibata, 150m sebelum wesel W-DKB-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-PSM-Masuk-Hilir',
    zone: 1,
    kp: 18.05,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Pasar Minggu, 150m sebelum wesel W-PSM-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-PSM-Masuk-Hulu',
    zone: 1,
    kp: 18.35,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Pasar Minggu, 150m sebelum wesel W-PSM-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-TNT-Masuk-Hilir',
    zone: 2,
    kp: 21.35,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Tanjung Barat, 150m sebelum wesel W-TNT-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-TNT-Masuk-Hulu',
    zone: 2,
    kp: 21.65,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Tanjung Barat, 150m sebelum wesel W-TNT-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-LTA-Masuk-Hilir',
    zone: 2,
    kp: 23.75,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Lenteng Agung, 150m sebelum wesel W-LTA-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-LTA-Masuk-Hulu',
    zone: 2,
    kp: 24.05,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Lenteng Agung, 150m sebelum wesel W-LTA-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-POC-Masuk-Hilir',
    zone: 2,
    kp: 28.15,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Pondok Cina, 150m sebelum wesel W-POC-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-POC-Masuk-Hulu',
    zone: 2,
    kp: 28.45,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Pondok Cina, 150m sebelum wesel W-POC-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-BJD-Masuk-Hilir',
    zone: 3,
    kp: 44.35,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Bojonggede, 150m sebelum wesel W-BJD-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-BJD-Masuk-Hulu',
    zone: 3,
    kp: 44.65,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Bojonggede, 150m sebelum wesel W-BJD-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-CLT-Masuk-Hilir',
    zone: 3,
    kp: 49.15,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Cilebut, 150m sebelum wesel W-CLT-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-CLT-Masuk-Hulu',
    zone: 3,
    kp: 49.45,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Cilebut, 150m sebelum wesel W-CLT-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-GST-Masuk-Hilir',
    zone: 4,
    kp: 5.25,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Gang Sentiong, 150m sebelum wesel W-GST-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-GST-Masuk-Hulu',
    zone: 4,
    kp: 5.55,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Gang Sentiong, 150m sebelum wesel W-GST-01 (tombol pemindah wesel) dari arah berlawanan.
  {
    id: 'S-PJT-Masuk-Hilir',
    zone: 4,
    kp: 7.75,
    direction: LineDirection.Hilir,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hilir Stasiun Pondok Jati, 150m sebelum wesel W-PJT-01 (tombol pemindah wesel) sesuai jarak aman pengereman KAI.
  {
    id: 'S-PJT-Masuk-Hulu',
    zone: 4,
    kp: 8.05,
    direction: LineDirection.Hulu,
    color: SignalColor.Red,
    autoControl: false
  }, // Sinyal Masuk Hulu Stasiun Pondok Jati, 150m sebelum wesel W-PJT-01 (tombol pemindah wesel) dari arah berlawanan.
];

export const PJLS: PJLCrossing[] = [
  { id: 'PJL-MRI-01', zone: 1, kp: 7.2, name: 'Slamet Riyadi (Manggarai)', isClosed: true, sirenPlaying: false },
  { id: 'PJL-PSM-01', zone: 1, kp: 16.5, name: 'Pasar Minggu Raya', isClosed: true, sirenPlaying: false },
  { id: 'PJL-DP-01', zone: 2, kp: 30.1, name: 'Kartini (Depok)', isClosed: true, sirenPlaying: false },
  { id: 'PJL-CTA-01', zone: 2, kp: 39.5, name: 'Citayam Barat', isClosed: true, sirenPlaying: false },
  { id: 'PJL-BJD-01', zone: 3, kp: 45.8, name: 'Bojonggede Utama', isClosed: true, sirenPlaying: false },
  { id: 'PJL-BOO-01', zone: 3, kp: 52.8, name: 'Kebon Pedes (Bogor)', isClosed: true, sirenPlaying: false },
  { id: 'PJL-PSN-01', zone: 4, kp: 4.8, name: 'Pasar Senen Flyover', isClosed: true, sirenPlaying: false }
];

export function getZoneFromKp(kp: number, routeBranch?: 'BogorLine' | 'CikarangLoop'): 1 | 2 | 3 | 4 {
  if (routeBranch === 'CikarangLoop') return 4;
  if (kp <= 20.0) return 1;
  if (kp <= 40.0) return 2;
  return 3;
}

export function getXCoordinateFromKp(kp: number): number {
  return (kp / 55.0) * 90 + 5;
}

export function getSpeedLimitAtKp(kp: number, routeBranch?: 'BogorLine' | 'CikarangLoop'): { limit: number; desc: string } {
  if (kp <= 0.8) return { limit: 30, desc: 'Pendekatan Stasiun Jakarta Kota (Throat)' };
  if (kp >= 53.8) return { limit: 30, desc: 'Pendekatan Stasiun Bogor (Tanjakan & Langsir)' };
  
  // Area Wesel / Percabangan Stasiun Hub Manggarai (KM 9.00 - 9.80): Maksimal 30 km/h - 40 km/h
  if (kp >= 9.0 && kp <= 9.80) {
    return { limit: 30, desc: 'Area Wesel / Percabangan Stasiun Hub Manggarai (Taspat KAI)' };
  }
  if (kp > 9.80 && kp <= 10.5) {
    return { limit: 40, desc: 'Jalur Hub Manggarai (Penyusutan Batas)' };
  }
  
  if (kp >= 32.0 && kp <= 33.5) return { limit: 60, desc: 'Pendekatan Depok & Wesel' };
  if (kp >= 40.0 && kp <= 48.0) return { limit: 70, desc: 'Jalur Menanjak & Lengkung Sektor Bogor' };

  // Cikarang Loop / Senen Sektor 4
  if (routeBranch === 'CikarangLoop') {
    return { limit: 100, desc: 'Lintas Lurus Terbuka Cikarang Loop Line (KRL JR 205 Taspat)' };
  }

  return { limit: 120, desc: 'Lintas Bebas Lurus Terbuka (Bogor Line)' };
}

export function getTrackY(kp: number, baseY: number): number {
  // Model curves based on real route geography
  let curve = 0;
  
  if (kp <= 2.5) {
    // Jakarta Kota throat / yard curves
    curve = Math.sin(kp * Math.PI) * 12;
  } else if (kp >= 7.5 && kp <= 11.5) {
    // Manggarai flyover & S-Curve transitions
    curve = Math.sin((kp - 7.5) * Math.PI / 2.0) * 16;
  } else if (kp >= 12.0 && kp <= 15.5) {
    // Tebet to Cawang winding curves
    curve = Math.cos((kp - 12.0) * Math.PI / 1.75) * 18;
  } else if (kp >= 21.0 && kp <= 29.0) {
    // Lenteng Agung, pancasila to UI lake loop curves
    curve = Math.sin((kp - 21.0) * Math.PI / 2.5) * 14;
  } else if (kp >= 31.0 && kp <= 38.5) {
    // Depok Baru, Depok & Citayam approaches
    curve = Math.cos((kp - 31.0) * Math.PI / 3.0) * 15;
  } else if (kp >= 42.0 && kp <= 52.0) {
    // Bojonggede to Cilebut & Bogor steep hills winding tracks
    curve = Math.sin((kp - 42.0) * Math.PI / 2.0) * 22 + Math.cos((kp - 42.0) * Math.PI / 4.0) * 8;
  } else if (kp > 52.0) {
    // Sharp mountain approaches into Bogor Platform
    curve = Math.sin((kp - 52.0) * Math.PI / 1.2) * 15;
  }
  
  return baseY + curve;
}

export function getTrackPath(baseY: number): string {
  let path = '';
  // High fidelity sampling for buttery-smooth SVG paths
  for (let kp = 0.0; kp <= 55.02; kp += 0.1) {
    const pct = getXCoordinateFromKp(kp);
    const x = (pct / 100) * 900 + 50;
    const y = getTrackY(kp, baseY);
    if (kp === 0) {
      path += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return path;
}

// ---------------- Real World GPS Maps Integration (Leaflet.js matching) ----------------

export const TRACK_GPS_POINTS: { kp: number; lat: number; lng: number }[] = [
  // --- Zone 1 ---
  { kp: 0.0, lat: -6.137569, lng: 106.814322 }, // Jakarta Kota
  { kp: 0.1, lat: -6.137680, lng: 106.815300 }, // Leaving Jakarta Kota, heading east
  { kp: 0.2, lat: -6.137880, lng: 106.816300 },
  { kp: 0.3, lat: -6.138200, lng: 106.817200 }, // Curving south-east
  { kp: 0.4, lat: -6.138540, lng: 106.818000 },
  { kp: 0.5, lat: -6.138900, lng: 106.819000 },
  { kp: 0.6, lat: -6.139400, lng: 106.820100 },
  { kp: 0.8, lat: -6.139980, lng: 106.821200 }, // Curving south
  { kp: 1.0, lat: -6.140500, lng: 106.821900 },
  { kp: 1.2, lat: -6.140950, lng: 106.822300 },
  { kp: 1.4, lat: -6.141559, lng: 106.822601 }, // Jayakarta Station (dihaluskan sedikit dari -6.141381,106.822602 untuk mengurangi belokan tajam yang berpotensi memotong bangunan)
  { kp: 1.6, lat: -6.143000, lng: 106.822900 }, // Solid straight south-south-east viaduct
  { kp: 1.8, lat: -6.144700, lng: 106.823200 },
  { kp: 2.0, lat: -6.146400, lng: 106.823500 },
  { kp: 2.2, lat: -6.148100, lng: 106.823900 },
  { kp: 2.4, lat: -6.149842, lng: 106.824141 }, // Mangga Besar Station
  { kp: 2.6, lat: -6.151500, lng: 106.824300 }, // Straight viaduct over Jl. Karang Anyar
  { kp: 2.9, lat: -6.154200, lng: 106.824500 },
  { kp: 3.2, lat: -6.156900, lng: 106.824650 },
  { kp: 3.5, lat: -6.159000, lng: 106.824750 },
  { kp: 3.7, lat: -6.160400, lng: 106.824800 }, // Sawah Besar Station
  { kp: 3.9, lat: -6.161900, lng: 106.825100 }, // Curving slightly east-southeast
  { kp: 4.1, lat: -6.163300, lng: 106.825800 },
  { kp: 4.3, lat: -6.164800, lng: 106.826800 },
  { kp: 4.5, lat: -6.166400, lng: 106.828200 }, // Juanda Station
  { kp: 4.7, lat: -6.168200, lng: 106.829100 }, // Elevated line straight south, crossing the river and canal
  { kp: 5.0, lat: -6.171200, lng: 106.829900 },
  { kp: 5.3, lat: -6.174200, lng: 106.830300 },
  { kp: 5.5, lat: -6.176700, lng: 106.830600 }, // Gambir Station area (not stopping, but line passes through Gambir)
  { kp: 5.8, lat: -6.179700, lng: 106.831200 },
  { kp: 6.1, lat: -6.182500, lng: 106.831700 },
  { kp: 6.3, lat: -6.184300, lng: 106.831900 },
  { kp: 6.5, lat: -6.186100, lng: 106.832200 }, // Gondangdia Station
  { kp: 6.8, lat: -6.188800, lng: 106.832300 }, // Elevated line heading straight south
  { kp: 7.1, lat: -6.191500, lng: 106.832350 },
  { kp: 7.4, lat: -6.194200, lng: 106.832400 },
  { kp: 7.7, lat: -6.196300, lng: 106.832450 },
  { kp: 8.0, lat: -6.198300, lng: 106.832500 }, // Cikini Station
  { kp: 8.2, lat: -6.199800, lng: 106.832800 }, // Leaving Cikini, start a massive curve heading east to Manggarai
  { kp: 8.4, lat: -6.201200, lng: 106.833500 },
  { kp: 8.6, lat: -6.202500, lng: 106.834800 },
  { kp: 8.8, lat: -6.203800, lng: 106.836500 }, // Curving over Ciliwung River
  { kp: 9.0, lat: -6.204800, lng: 106.838500 },
  { kp: 9.2, lat: -6.205700, lng: 106.841000 },
  { kp: 9.4, lat: -6.206700, lng: 106.843800 },
  { kp: 9.6, lat: -6.208100, lng: 106.846500 }, // Aligning to Manggarai platforms
  { kp: 9.8, lat: -6.209755, lng: 106.849045 }, // Manggarai Station (dihaluskan sedikit dari -6.209800,106.849300 untuk mengurangi belokan tajam yang berpotensi memotong bangunan)
  { kp: 10.1, lat: -6.211200, lng: 106.850400 }, // Leaving Manggarai southwards, curves to follow Jl. Bukit Duri
  { kp: 10.4, lat: -6.212800, lng: 106.851200 },
  { kp: 10.7, lat: -6.214400, lng: 106.852100 },
  { kp: 11.0, lat: -6.216200, lng: 106.853500 }, // Flyover curves area
  { kp: 11.4, lat: -6.218800, lng: 106.855100 },
  { kp: 11.8, lat: -6.221500, lng: 106.856200 },
  { kp: 12.1, lat: -6.223800, lng: 106.857200 },
  { kp: 12.4, lat: -6.226400, lng: 106.858400 }, // Tebet Station
  { kp: 12.7, lat: -6.229000, lng: 106.858800 }, // Going south along Jl. Tebet Timur
  { kp: 13.0, lat: -6.232500, lng: 106.859100 },
  { kp: 13.4, lat: -6.237500, lng: 106.859200 },
  { kp: 13.7, lat: -6.242700, lng: 106.858700 }, // Cawang Station
  { kp: 14.1, lat: -6.246000, lng: 106.858200 }, // Heading south-southwest
  { kp: 14.5, lat: -6.249800, lng: 106.857600 },
  { kp: 14.9, lat: -6.253200, lng: 106.857200 },
  { kp: 15.2, lat: -6.255500, lng: 106.856900 }, // Duren Kalibata Station
  { kp: 15.6, lat: -6.258800, lng: 106.855300 }, // Curving west-southwest
  { kp: 16.0, lat: -6.262500, lng: 106.853200 },
  { kp: 16.4, lat: -6.266200, lng: 106.851600 },
  { kp: 16.7, lat: -6.269300, lng: 106.850700 }, // Pasar Minggu Baru Station
  { kp: 17.1, lat: -6.273000, lng: 106.848500 }, // Curving gently toward Pasar Minggu
  { kp: 17.5, lat: -6.276500, lng: 106.846500 },
  { kp: 17.9, lat: -6.279800, lng: 106.845000 },
  { kp: 18.2, lat: -6.282100, lng: 106.844000 }, // Pasar Minggu Station
  
  // --- Zone 2 ---
  { kp: 18.6, lat: -6.285200, lng: 106.842900 }, // Moving south-south-west, parallel to Jl. Raya Pasar Minggu / Lenteng Agung
  { kp: 19.1, lat: -6.289000, lng: 106.842200 },
  { kp: 19.6, lat: -6.292500, lng: 106.841800 },
  { kp: 20.0, lat: -6.295250, lng: 106.841500 }, // Transition
  { kp: 20.4, lat: -6.298500, lng: 106.840900 },
  { kp: 20.9, lat: -6.302500, lng: 106.840200 },
  { kp: 21.5, lat: -6.307900, lng: 106.839300 }, // Tanjung Barat Station
  { kp: 22.0, lat: -6.312500, lng: 106.838300 }, 
  { kp: 22.6, lat: -6.318000, lng: 106.837000 },
  { kp: 23.2, lat: -6.323500, lng: 106.836000 },
  { kp: 23.9, lat: -6.330100, lng: 106.835100 }, // Lenteng Agung Station
  { kp: 24.5, lat: -6.335500, lng: 106.834800 },
  { kp: 25.2, lat: -6.341500, lng: 106.834600 },
  { kp: 25.9, lat: -6.347500, lng: 106.834400 }, // Universitas Pancasila Station
  { kp: 26.5, lat: -6.353000, lng: 106.833200 }, // Heading slightly west-southwest entering UI forest area
  { kp: 27.2, lat: -6.360600, lng: 106.831800 }, // Universitas Indonesia Station
  { kp: 27.7, lat: -6.364500, lng: 106.832100 }, // Gentle curve around Kampus UI lake
  { kp: 28.3, lat: -6.368800, lng: 106.832700 }, // Pondok Cina Station
  { kp: 29.0, lat: -6.374500, lng: 106.829000 }, // Curving south-west towards Depok Baru
  { kp: 29.7, lat: -6.380500, lng: 106.825200 },
  { kp: 30.4, lat: -6.386000, lng: 106.822500 },
  { kp: 31.1, lat: -6.391200, lng: 106.820800 }, // Depok Baru Station
  { kp: 31.6, lat: -6.396000, lng: 106.820900 }, // Approaching Depok
  { kp: 32.1, lat: -6.401000, lng: 106.821000 },
  { kp: 32.7, lat: -6.405800, lng: 106.821100 }, // Depok Station
  { kp: 33.3, lat: -6.411000, lng: 106.818500 }, // Leaving Depok, curves south-west towards Citayam
  { kp: 34.0, lat: -6.417000, lng: 106.815200 },
  { kp: 35.0, lat: -6.425500, lng: 106.812200 }, // Citayam Transition
  { kp: 36.0, lat: -6.433500, lng: 106.808000 },
  { kp: 37.0, lat: -6.441500, lng: 106.804800 },
  { kp: 37.8, lat: -6.448800, lng: 106.802100 }, // Citayam Station
  
  // --- Zone 3 ---
  { kp: 38.6, lat: -6.453500, lng: 106.800100 }, // Heading south-southwest towards Bojonggede
  { kp: 39.5, lat: -6.459000, lng: 106.797800 },
  { kp: 41.0, lat: -6.467800, lng: 106.795500 }, // Bojonggede transition
  { kp: 42.1, lat: -6.474500, lng: 106.793800 },
  { kp: 43.2, lat: -6.481500, lng: 106.792400 },
  { kp: 44.5, lat: -6.489700, lng: 106.791500 }, // Bojonggede Station
  { kp: 45.8, lat: -6.498500, lng: 106.790500 }, // Straightening south, following the main artery
  { kp: 47.1, lat: -6.510500, lng: 106.790100 },
  { kp: 48.2, lat: -6.520500, lng: 106.790300 },
  { kp: 49.3, lat: -6.531200, lng: 106.790500 }, // Cilebut Station
  { kp: 50.1, lat: -6.541000, lng: 106.790100 }, // Following the river/creek curves
  { kp: 51.0, lat: -6.551000, lng: 106.789800 },
  { kp: 52.0, lat: -6.565200, lng: 106.789500 }, // Cilebut to Bogor curve
  { kp: 53.0, lat: -6.576000, lng: 106.789300 },
  { kp: 54.0, lat: -6.586200, lng: 106.789150 },
  { kp: 54.8, lat: -6.594700, lng: 106.789100 }  // Bogor Station
];

// =====================================================================================
// KAI SIGNALLING COMPLIANCE VALIDATOR
// =====================================================================================
// Encodes core PT KAI persinyalan placement rules for wesel (turnouts) and their
// protective sinyal masuk/pelindung (protective/home signal):
//
//  1. Setiap wesel percabangan (facing switch, e.g. entering a station or junction)
//     harus memiliki minimal satu sinyal pelindung manual (autoControl: false) pada
//     zone yang sama dan arah (direction) yang sama, terletak SEBELUM wesel tersebut
//     dari sudut pandang arah perjalanan kereta yang menghadapinya.
//  2. Sinyal pelindung tidak boleh berada pada KP yang sama dengan atau SETELAH wesel
//     yang dilindunginya - itu artinya nol (atau negatif) jarak aman pengereman.
//  3. Jarak (overlap) minimum yang disarankan antara sinyal pelindung dan wesel adalah
//     MIN_PROTECTIVE_OVERLAP_KM, agar masinis memiliki ruang henti yang wajar.
//
// This validator is a DEV-TIME GUARDRAIL ONLY: it does not alter runtime train
// physics/behaviour. It exists so that future edits to SWITCHES/SIGNALS in this file
// can be checked automatically instead of relying purely on manual review.
const MIN_PROTECTIVE_OVERLAP_KM = 0.05; // 50m hard minimum
const RECOMMENDED_PROTECTIVE_OVERLAP_KM = 0.1; // 100m recommended minimum

export interface SignallingComplianceIssue {
  severity: 'error' | 'warning';
  switchId: string;
  message: string;
}

export function validateKaiSignallingCompliance(): SignallingComplianceIssue[] {
  const issues: SignallingComplianceIssue[] = [];

  SWITCHES.forEach(sw => {
    // Crossover wesels (Wesel Penyeberangan) are protected by the same station's main
    // Sinyal Masuk/Keluar rather than a dedicated protective signal, so they're excluded
    // from the "must have its own protective signal" check.
    if (sw.id.includes('XOver')) return;

    const isHilir = sw.direction === LineDirection.Hilir;

    // Candidate protective signals: same zone, same direction, manual (autoControl: false)
    const candidates = SIGNALS.filter(sig =>
      sig.zone === sw.zone &&
      sig.direction === sw.direction &&
      sig.autoControl === false
    );

    // "Facing" the switch means positioned before it in the direction of travel:
    // for Hilir (kp increasing) that means signal.kp < switch.kp
    // for Hulu (kp decreasing) that means signal.kp > switch.kp
    const facingCandidates = candidates.filter(sig =>
      isHilir ? sig.kp < sw.kp : sig.kp > sw.kp
    );

    if (facingCandidates.length === 0) {
      issues.push({
        severity: 'error',
        switchId: sw.id,
        message: `Wesel ${sw.id} (KM ${sw.kp}, ${sw.direction}) tidak memiliki sinyal pelindung (Sinyal Masuk) sama sekali. Berpotensi kereta memasuki wesel tanpa proteksi PPKA.`
      });
      return;
    }

    // Nearest facing protective signal (smallest overlap distance)
    const nearest = facingCandidates.reduce((closest, sig) => {
      const gap = Math.abs(sw.kp - sig.kp);
      const closestGap = Math.abs(sw.kp - closest.kp);
      return gap < closestGap ? sig : closest;
    });

    const overlap = Math.abs(sw.kp - nearest.kp);

    if (overlap < MIN_PROTECTIVE_OVERLAP_KM) {
      issues.push({
        severity: 'error',
        switchId: sw.id,
        message: `Sinyal ${nearest.id} (KM ${nearest.kp}) hanya berjarak ${(overlap * 1000).toFixed(0)}m dari wesel ${sw.id} (KM ${sw.kp}) - di bawah batas aman minimum ${MIN_PROTECTIVE_OVERLAP_KM * 1000}m. Tidak ada ruang henti yang memadai.`
      });
    } else if (overlap < RECOMMENDED_PROTECTIVE_OVERLAP_KM) {
      issues.push({
        severity: 'warning',
        switchId: sw.id,
        message: `Sinyal ${nearest.id} (KM ${nearest.kp}) berjarak ${(overlap * 1000).toFixed(0)}m dari wesel ${sw.id} (KM ${sw.kp}) - di bawah jarak yang direkomendasikan ${RECOMMENDED_PROTECTIVE_OVERLAP_KM * 1000}m.`
      });
    }
  });

  return issues;
}

// Run the validator once on module load, but only in development builds - this surfaces
// placement mistakes immediately in the browser console without affecting production.
if (typeof window !== 'undefined' && (import.meta as any)?.env?.DEV) {
  const issues = validateKaiSignallingCompliance();
  if (issues.length > 0) {
    console.group('%c[RRSid] KAI Signalling Compliance Check', 'color:#f59e0b;font-weight:bold;');
    issues.forEach(issue => {
      const logFn = issue.severity === 'error' ? console.error : console.warn;
      logFn(`[${issue.severity.toUpperCase()}] ${issue.message}`);
    });
    console.groupEnd();
  } else {
    console.log('%c[RRSid] KAI Signalling Compliance Check: OK, semua wesel memiliki sinyal pelindung yang sesuai ketentuan.', 'color:#10b981;font-weight:bold;');
  }
}

// Jalur lingkar Sektor 4 (Pasar Senen - Gang Sentiong - Kramat - Pondok Jati - Matraman),
// secara geografis berada di SEBELAH TIMUR koridor utama Jakarta Kota - Manggarai (yang
// melewati Gondangdia/Cikini). Sebelumnya seluruh entitas Zona 4 memakai TRACK_GPS_POINTS
// yang sama dengan Zona 1 sehingga digambar menumpuk di jalur utama - array terpisah ini
// memperbaikinya, dengan titik akhir (KM 9.6) dibuat menyatu kembali ke jalur utama persis
// di titik percabangan Manggarai (W-MRI-04).
export const TRACK_GPS_POINTS_ZONE4: { kp: number; lat: number; lng: number }[] = [
  { kp: 3.8, lat: -6.179500, lng: 106.842300 }, // Pendekatan Pasar Senen dari arah Kampung Bandan
  { kp: 4.2, lat: -6.177500, lng: 106.842000 }, // Pasar Senen Station
  { kp: 5.4, lat: -6.185000, lng: 106.847000 }, // Gang Sentiong
  { kp: 6.6, lat: -6.192000, lng: 106.851000 }, // Kramat
  { kp: 7.9, lat: -6.200000, lng: 106.856000 }, // Pondok Jati
  { kp: 9.0, lat: -6.206000, lng: 106.852000 }, // Mendekati Matraman
  { kp: 9.6, lat: -6.208100, lng: 106.846500 }  // Titik gabung kembali ke jalur utama (Manggarai, W-MRI-04)
];

export function getLatLngFromKp(kp: number, direction?: LineDirection, zone?: 1 | 2 | 3 | 4): [number, number] {
  const pointSet = zone === 4 ? TRACK_GPS_POINTS_ZONE4 : TRACK_GPS_POINTS;
  const maxKp = zone === 4 ? 9.6 : 54.8;
  const clampedKp = Math.max(zone === 4 ? 3.8 : 0.0, Math.min(maxKp, kp));
  let idx = 0;
  while (idx < pointSet.length - 2 && pointSet[idx + 1].kp < clampedKp) {
    idx++;
  }
  
  const p1 = pointSet[idx];
  const p2 = pointSet[idx + 1];
  
  const range = p2.kp - p1.kp;
  const t = range === 0 ? 0 : (clampedKp - p1.kp) / range;
  
  let lat = p1.lat + (p2.lat - p1.lat) * t;
  let lng = p1.lng + (p2.lng - p1.lng) * t;
  
  if (direction) {
    const dLat = p2.lat - p1.lat;
    const dLng = p2.lng - p1.lng;
    const len = Math.sqrt(dLat * dLat + dLng * dLng);
    
    if (len > 0) {
      const pX = -dLng / len;
      const pY = dLat / len;
      const offsetDist = 0.000045; // parallel lane width separation
      const side = direction === LineDirection.Hulu ? 1 : -1;
      
      lat += pX * offsetDist * side;
      lng += pY * offsetDist * side;
    }
  }
  
  return [lat, lng];
}

export function getBearingAtKp(kp: number, direction: LineDirection, zone?: 1 | 2 | 3 | 4): number {
  const current = getLatLngFromKp(kp, undefined, zone);
  const delta = direction === LineDirection.Hilir ? 0.02 : -0.02;
  const maxKp = zone === 4 ? 9.6 : 54.8;
  const minKp = zone === 4 ? 3.8 : 0.0;
  const targetKp = Math.max(minKp, Math.min(maxKp, kp + delta));
  const nextPt = getLatLngFromKp(targetKp, undefined, zone);
  
  const lat1 = current[0];
  const lng1 = current[1];
  const lat2 = nextPt[0];
  const lng2 = nextPt[1];
  
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const rLat1 = lat1 * (Math.PI / 180);
  const rLat2 = lat2 * (Math.PI / 180);
  
  const y = Math.sin(dLng) * Math.cos(rLat2);
  const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);
  
  let brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}
