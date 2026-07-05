import { Train, SignalBlock, SignalColor, LineDirection, TrainType, PJLCrossing, Station } from '../types';
import { getSpeedLimitAtKp, SIGNALS, PJLS, STATIONS } from '../data/tracks';

// Physics profile constants
export interface TrainSpec {
  mass: number; // tons
  maxPowerKn: number; // Kilonewtons
  brakingPower: number; // rate of deceleration
  maxSpeed: number;
  label: string;
}

export const TRAIN_SPECS: Record<TrainType, TrainSpec> = {
  [TrainType.Langsir]: { mass: 50, maxPowerKn: 120, brakingPower: 1.8, maxSpeed: 40, label: 'Langsir (CC 201)' },
  [TrainType.KRL_8]: { mass: 280, maxPowerKn: 480, brakingPower: 1.4, maxSpeed: 90, label: 'KRL Commuter Line 8-Car (JR 205)' },
  [TrainType.KRL_12]: { mass: 420, maxPowerKn: 720, brakingPower: 1.3, maxSpeed: 100, label: 'KRL Commuter Line 12-Car (JR 205 High Capacity)' },
  [TrainType.CC201]: { mass: 350, maxPowerKn: 400, brakingPower: 1.2, maxSpeed: 90, label: 'CC 201 + Rangkaian KA Pangrango' },
  [TrainType.CC206]: { mass: 450, maxPowerKn: 640, brakingPower: 1.1, maxSpeed: 120, label: 'CC 206 Double Header Jarak Jauh (Eksekutif)' }
};

// Physics update tick (dt in seconds)
export function updateTrainPhysics(
  train: Train,
  dt: number,
  signals: SignalBlock[],
  pjls: PJLCrossing[]
): {
  updatedTrain: Train;
  penalties: string[];
  kickAndBan: boolean;
  banReason?: string;
} {
  const penalties: string[] = [];
  let kickAndBan = false;
  let banReason = '';

  if (train.hasCollided || train.isBanned) {
    return { updatedTrain: train, penalties, kickAndBan };
  }

  const spec = TRAIN_SPECS[train.type] || TRAIN_SPECS[TrainType.KRL_8];
  let curSpeed = train.speed; // in km/h

  // Limit check based on system rules
  const lineLimitInfo = getSpeedLimitAtKp(train.kp, train.routeBranch);
  let signalLimit = 120;

  // Find next signal facing the train to check SPAD (Passing Red Signal)
  const facingSignals = signals.filter(s => 
    s.direction === train.direction && 
    (train.direction === LineDirection.Hilir ? s.kp > train.kp : s.kp < train.kp)
  );
  
  // Sort to find closest one ahead
  facingSignals.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );

  const nextSignal = facingSignals[0];
  let distanceToNextSignal = 999.0; // km
  if (nextSignal) {
    distanceToNextSignal = Math.abs(nextSignal.kp - train.kp);
    
    // Manage signal limit constraints
    if (distanceToNextSignal < 1.0) { // yellow warning zone
      if (nextSignal.color === SignalColor.Yellow) {
        // Pendekatan Stasiun Akhir (Pasar Senen [KM 4.0 ± 1.0], Bogor [KM >= 53.0], Jakarta Kota [KM <= 1.5])
        const isApproachingTerminal = 
          (train.kp <= 1.5 && train.direction === LineDirection.Hulu) || // Jakarta Kota
          (train.kp >= 53.0 && train.direction === LineDirection.Hilir) || // Bogor
          (Math.abs(train.kp - 4.0) <= 1.0); // Pasar Senen
        
        signalLimit = isApproachingTerminal ? 45 : 30; // Turun bertahap menjadi 45 km/h untuk terminal, else 30
      } else if (nextSignal.color === SignalColor.Red && distanceToNextSignal <= 0.05) {
        // Menerobos Sinyal Merah (SPAD / Signal Passed At Danger)
        kickAndBan = true;
        banReason = `Fatal: Menerobos Sinyal Merah pada km ${nextSignal.kp.toFixed(2)}`;
        curSpeed = 0;
      }
    }
  }

  // Speed Limit Enforcer
  const currentSpeedLimit = Math.min(lineLimitInfo.limit, signalLimit, spec.maxSpeed);

  // Check Speeding Penalty (Warning only, unless over 10 km/h)
  if (curSpeed > currentSpeedLimit + 5) {
    if (Math.random() < 0.02) { // Spaced out logging to prevent overflow
      penalties.push(`Kelebihan Kecepatan! Batas: ${currentSpeedLimit} km/h, Aktual: ${Math.round(curSpeed)} km/h`);
    }
    if (curSpeed > currentSpeedLimit + 20) {
      // Emergency penalty ban warning
      kickAndBan = true;
      banReason = `Fatal: Kecepatan berlebih ekstrim (${Math.round(curSpeed)} / ${currentSpeedLimit} km/h)`;
      curSpeed = 0;
    }
  }

  // Check Minimum Speed Limit (Vmin = 30 km/h) on main lines (GAPEKA compliance)
  const isApproachingTerminal = 
    (train.kp <= 1.5 && train.direction === LineDirection.Hulu) || // Jakarta Kota
    (train.kp >= 53.0 && train.direction === LineDirection.Hilir) || // Bogor
    (Math.abs(train.kp - 4.0) <= 1.0); // Pasar Senen

  if (
    train.type !== TrainType.Langsir && 
    !isApproachingTerminal && 
    curSpeed > 2 && 
    curSpeed < 30 && 
    train.throttle > 0 &&
    train.brake === 0
  ) {
    if (Math.random() < 0.02) { // Spaced out logging to prevent overflow
      penalties.push(`Melanggar Kecepatan Minimal! Aktual: ${Math.round(curSpeed)} km/h, Batas Min: 30 km/h (Menghambat GAPEKA!)`);
    }
  }

  // Grade Uphill Drag calculation for Bogor Track (km 40.0 to 54.8)
  let gradeDrag = 0;
  if (train.kp >= 40.0) {
    // 1% gradient factor -> slows train down if going Hilir (uphill to Bogor)
    // speeds it up if going Hulu (downhill to Jakarta)
    gradeDrag = train.direction === LineDirection.Hilir ? -0.8 : 0.6;
  }

  // Active Control Application
  let targetAcc = 0.0;
  
  if (train.emergencyBrake) {
    targetAcc = -spec.brakingPower * 3.0; // Extreme deceleration
  } else {
    // Calculate acceleration based on Throttle notch
    // Throttle 1..5 adds acceleration
    if (train.throttle > 0 && train.reverser !== 'N') {
      const directionFactor = train.reverser === 'F' ? 1 : -1;
      const powerPct = train.throttle / 5.0; // 20% to 100% power
      const forceKn = spec.maxPowerKn * powerPct;
      const massTons = spec.mass;
      // physics acc = force / mass (expressed in scale for km/h per sec)
      targetAcc = (forceKn / massTons) * 3.6 * directionFactor;
    }
    
    // Adding Grade slope effects
    targetAcc += gradeDrag;

    // Apply Braking notch
    if (train.brake > 0) {
      const brakePct = train.brake / 5.0;
      targetAcc -= spec.brakingPower * brakePct * 3.6;
    }

    // Passive rolling friction resistance
    if (curSpeed > 0) {
      targetAcc -= 0.1; // flat drag
    } else if (curSpeed < 0) {
      targetAcc += 0.1;
    }
  }

  // Update speed
  curSpeed += targetAcc * dt;
  
  // Reverser bounds
  if (train.reverser === 'N' && train.speed === 0) {
    curSpeed = 0;
  }
  if (curSpeed < 0) curSpeed = 0; // standard model cannot roll completely backward automatically in main loops
  if (curSpeed > currentSpeedLimit + 15) {
    curSpeed = currentSpeedLimit + 15; // capped by drag/safety governor
  }

  // Calculate position change 
  // Speed in km/h to km/s is: speed / 3600
  const kmPerSec = curSpeed / 3600;
  let nextKp = train.kp;
  if (train.direction === LineDirection.Hilir) {
    nextKp += kmPerSec * dt;
  } else {
    nextKp -= kmPerSec * dt;
  }

  // Lock boundary safety
  if (nextKp < 0) {
    nextKp = 0;
    curSpeed = 0;
  } else if (nextKp > 54.8) {
    nextKp = 54.8;
    curSpeed = 0;
  }

  // Level Crossing (PJL) Safety Check
  // If PJL is OPEN (isClosed == false) and the train passes, it's a critical safety issue!
  const targetPJL = pjlAhead(train, pjls);
  if (targetPJL && Math.abs(targetPJL.kp - train.kp) < 0.03 && !targetPJL.isClosed && curSpeed > 5) {
    if (Math.random() < 0.05) {
      penalties.push(`Bahaya: Menerobos PJL ${targetPJL.name} yang belum ditutup!`);
    }
  }

  // Station Stop and Door controls
  let currentPlatformId = null;
  const closestStation = STATIONS.find(s => Math.abs(s.kp - nextKp) < 0.2); // Within platform range (200m)
  
  if (closestStation) {
    currentPlatformId = closestStation.id;
    // Check if stopped perfectly
    if (curSpeed === 0 && Math.abs(closestStation.kp - nextKp) < 0.02) {
      // Perfect alignment!
      if (train.lastStopKp !== closestStation.kp) {
        train.lastStopKp = closestStation.kp;
        penalties.push(`Sempurna: Presisi berhenti prima di Peron Stasiun ${closestStation.name}! (+25 Poin)`);
      }
    }
  }

  // Overrun platform safety rules
  if (closestStation && train.direction === LineDirection.Hilir && train.kp < closestStation.kp && nextKp > closestStation.kp + 0.15 && curSpeed > 20) {
    // Overran station platform completely without stopping
    if (train.lastStopKp !== closestStation.kp) {
      train.lastStopKp = closestStation.kp; // mark handled
      penalties.push(`Peringatan: Melewatkan Peron (Overrun) di Stasiun ${closestStation.name}! (-20 Poin)`);
    }
  }

  return {
    updatedTrain: {
      ...train,
      kp: nextKp,
      speed: curSpeed,
      targetSpeedLimit: currentSpeedLimit,
      currentPlatformId,
    },
    penalties,
    kickAndBan,
    banReason
  };
}

// Check AI automatic driver controls
export function runTrainAIDriver(
  train: Train,
  signals: SignalBlock[],
  pjls: PJLCrossing[],
  stations: typeof STATIONS
): Partial<Train> {
  const spec = TRAIN_SPECS[train.type] || TRAIN_SPECS[TrainType.KRL_8];
  const speed = train.speed;

  // Let's check upcoming signals, station platforms etc.
  const facingSignals = signals.filter(s => 
    s.direction === train.direction && 
    (train.direction === LineDirection.Hilir ? s.kp > train.kp : s.kp < train.kp)
  );
  facingSignals.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );
  const nextSignal = facingSignals[0];
  const distToSignal = nextSignal ? Math.abs(nextSignal.kp - train.kp) : 999;

  // Find next station on path
  const nextStations = stations.filter(s => 
    (train.direction === LineDirection.Hilir ? s.kp > train.kp : s.kp < train.kp)
  );
  nextStations.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );
  const nextStation = nextStations[0];
  const distToStation = nextStation ? Math.abs(nextStation.kp - train.kp) : 999;

  let throttle = train.throttle;
  let brake = train.brake;
  let doorsOpen = train.doorsOpen;

  // Standard speed profiling
  const limit = getSpeedLimitAtKp(train.kp, train.routeBranch).limit;
  let targetAccSpeed = limit - 5; // maintain 5km/h under line speed limit

  // If signal is yellow, cap speed to 30 km/h or 45 km/h if approaching terminal
  if (nextSignal && nextSignal.color === SignalColor.Yellow && distToSignal < 0.8) {
    const isApproachingTerminal = 
      (train.kp <= 1.5 && train.direction === LineDirection.Hulu) || // Jakarta Kota
      (train.kp >= 53.0 && train.direction === LineDirection.Hilir) || // Bogor
      (Math.abs(train.kp - 4.0) <= 1.0); // Pasar Senen

    targetAccSpeed = isApproachingTerminal ? 40 : 25; // cruise slightly under 45 / 30 limit
  }
  
  // If signal is red, we must deceleration profile to stop completely!
  if (nextSignal && nextSignal.color === SignalColor.Red && distToSignal < 1.0) {
    const stoppingProfileSpeed = Math.max(0, (distToSignal - 0.05) * 60); // linear decelerator
    targetAccSpeed = Math.min(targetAccSpeed, stoppingProfileSpeed);
  }

  // Station platform decelerating profile
  if (nextStation && distToStation < 0.5) {
    // AI wants to stop at platforms for 15 seconds
    if (distToStation < 0.02 && speed < 1) {
      doorsOpen = true;
      throttle = 0;
      brake = 5; // hold train at station
      return { throttle, brake, doorsOpen };
    } else {
      doorsOpen = false;
      const stationStopSpeed = Math.max(0, (distToStation - 0.005) * 45); // decelerate smoothly
      targetAccSpeed = Math.min(targetAccSpeed, stationStopSpeed);
    }
  }

  // Adjust throttle / brake to hit target speed
  if (speed < targetAccSpeed) {
    brake = 0;
    // simple proportional feedback throttle
    const diff = targetAccSpeed - speed;
    if (diff > 20) throttle = 5;
    else if (diff > 10) throttle = 3;
    else throttle = 1;
  } else if (speed > targetAccSpeed + 2) {
    throttle = 0;
    const diff = speed - targetAccSpeed;
    if (diff > 15) brake = 4;
    else if (diff > 5) brake = 2;
    else brake = 1;
  } else {
    throttle = 1; // cruising
    brake = 0;
  }

  // End of terminal paths turnaround!
  if (train.kp <= 0.1 && train.direction === LineDirection.Hulu) {
    return { direction: LineDirection.Hilir, throttle: 1, brake: 0, kp: 0.1 };
  }
  if (train.kp >= 54.7 && train.direction === LineDirection.Hilir) {
    return { direction: LineDirection.Hulu, throttle: 1, brake: 0, kp: 54.6 };
  }

  return { throttle, brake, doorsOpen };
}

// Utility to find if a level crossing is approaching
function pjlAhead(train: Train, pjls: PJLCrossing[]): PJLCrossing | null {
  const ahead = pjls.filter(p => 
    (train.direction === LineDirection.Hilir ? p.kp > train.kp : p.kp < train.kp)
  );
  ahead.sort((a, b) => 
    train.direction === LineDirection.Hilir ? a.kp - b.kp : b.kp - a.kp
  );
  return ahead[0] || null;
}

/**
 * Automatically update automatic block signals based on track block occupancy.
 * A signal turns Red if a train occupies the track block ahead of it, otherwise Green.
 */
export function updateSignalsAutomaticBlock(signals: SignalBlock[], trains: Train[]): SignalBlock[] {
  return signals.map(sig => {
    if (!sig.autoControl) return sig; // Manual or protective signals aren't auto-managed

    const isOccupied = trains.some(tr => {
      // Must be on the same route/direction
      if (tr.direction !== sig.direction) return false;
      if (tr.hasCollided || tr.isBanned) return false;

      // Handle sector/route branch check
      const sameSektor = (sig.zone === 4 && tr.routeBranch === 'CikarangLoop') || (sig.zone !== 4 && tr.routeBranch !== 'CikarangLoop');
      if (!sameSektor) return false;

      if (sig.direction === LineDirection.Hilir) {
        // Hilir train: moves to larger KP. Block extends up to 2.2 km ahead.
        return tr.kp > sig.kp && tr.kp <= sig.kp + 2.2;
      } else {
        // Hulu train: moves to smaller KP. Block extends down to 2.2 km behind.
        return tr.kp >= sig.kp - 2.2 && tr.kp < sig.kp;
      }
    });

    return {
      ...sig,
      color: isOccupied ? SignalColor.Red : SignalColor.Green
    };
  });
}

/**
 * updateRouteGraph expands and registers the route network specifically for the Pasar Senen line.
 * It ensures all Sektor 4 loop line stations and track coordinates are properly registered.
 */
export function updateRouteGraph(stations: Station[], signals: SignalBlock[]): { stations: Station[]; signals: SignalBlock[] } {
  const senenStationIds = ['PSN', 'GST', 'KRT', 'PJT', 'MTR'];
  
  const updatedStations = [...stations];
  senenStationIds.forEach(id => {
    if (!updatedStations.some(s => s.id === id)) {
      const template = STATIONS.find(s => s.id === id);
      if (template) {
        updatedStations.push(template);
      }
    }
  });

  const updatedSignals = [...signals];
  SIGNALS.forEach(sig => {
    if (sig.zone === 4 && !updatedSignals.some(s => s.id === sig.id)) {
      updatedSignals.push(sig);
    }
  });

  return { stations: updatedStations, signals: updatedSignals };
}

/**
 * MapsJunction handles automatic routing at Manggarai Hub (titik percabangan).
 * It automatically sets the route branch, direction, and kilometer post (KP) based on the target node.
 */
export function MapsJunction(train: Train, targetNode: 'Bogor' | 'JakartaKota'): Partial<Train> {
  if (targetNode === 'Bogor') {
    return {
      routeBranch: 'BogorLine',
      direction: LineDirection.Hilir,
      kp: 9.8, // Align to Manggarai hub
    };
  } else {
    return {
      routeBranch: undefined, // Main Line
      direction: LineDirection.Hulu,
      kp: 9.8, // Align to Manggarai hub
    };
  }
}

