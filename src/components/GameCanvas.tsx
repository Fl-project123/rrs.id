import React, { useEffect, useRef, useState } from 'react';
import { Train, SignalBlock, SwitchWesel, LineDirection, SignalColor, TrainType } from '../types';
import {
  SCHEMATIC_STATIONS,
  SCHEMATIC_SWITCHES,
  SCHEMATIC_SIGNALS,
  getCoordinatesAtKp,
  getActiveBranch,
  kpToX,
  checkSignalStop
} from '../data/mapData';
import { Compass, Radio, ShieldAlert, CheckCircle } from 'lucide-react';

interface GameCanvasProps {
  trains: Train[];
  signals: SignalBlock[];
  switches: SwitchWesel[];
  userRole?: string;
  userStationId?: string; // Assigned PPKA station (e.g., 'MRI')
  onSwitchToggle?: (id: string, state: 'straight' | 'diverging') => void;
  onSignalToggle?: (id: string) => void;
}

export default function GameCanvas({
  trains,
  signals,
  switches,
  userRole = 'PPKA',
  userStationId = 'MRI',
  onSwitchToggle,
  onSignalToggle
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Animation loop references
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Smoothly interpolated local train coordinates for fluid animation
  const localTrainsRef = useRef<Record<string, { kp: number; x: number; y: number; speed: number }>>({});

  // 1. ASYNC IMAGE LOADER WITH FALLBACKS FOR ROBUST MOBILE / HP COMPATIBILITY
  useEffect(() => {
    const assets = [
      { key: 'CC201', file: 'CC 201.png' },
      { key: 'CC206', file: 'CC 206.png' },
      { key: 'GerbongKAJJ', file: 'Gerbong KAJJ.png' },
      { key: 'GerbongKRL', file: 'Gerbong KRL.png' },
      { key: 'KRLJR205', file: 'KRL JR 205.png' }
    ];

    let loadedCount = 0;
    const loadedImages: Record<string, HTMLImageElement> = {};

    const loadPromises = assets.map((asset) => {
      return new Promise<void>((resolve) => {
        const img = new Image();

        img.onload = () => {
          loadedImages[asset.key] = img;
          loadedCount++;
          setLoadingProgress(Math.round((loadedCount / assets.length) * 100));
          resolve();
        };

        img.onerror = () => {
          console.warn(`Failed primary load for: ${asset.file}. Retrying relative path...`);
          const fallbackImg = new Image();
          fallbackImg.src = asset.file;
          fallbackImg.onload = () => {
            loadedImages[asset.key] = fallbackImg;
            loadedCount++;
            setLoadingProgress(Math.round((loadedCount / assets.length) * 100));
            resolve();
          };
          fallbackImg.onerror = () => {
            console.error(`Fatal failure to load train sprite: ${asset.file}. Creating dynamic vector fallback...`);
            // Dynamic canvas placeholder to ensure rendering NEVER stalls
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 30;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(0, 0, 100, 30);
              ctx.fillStyle = '#64748b';
              ctx.font = '10px monospace';
              ctx.fillText(asset.key, 10, 20);
            }
            const fallbackImg2 = new Image();
            fallbackImg2.src = canvas.toDataURL();
            fallbackImg2.onload = () => {
              loadedImages[asset.key] = fallbackImg2;
              loadedCount++;
              setLoadingProgress(Math.round((loadedCount / assets.length) * 100));
              resolve();
            };
          };
        };

        // Fully qualified absolute URL to bypass sandboxed iFrame path issues
        img.src = `${window.location.origin}/${asset.file}`;
      });
    });

    Promise.all(loadPromises).then(() => {
      imagesRef.current = loadedImages;
      setImagesLoaded(true);
    });
  }, []);

  // Resilient switch state getter
  const getSwitchState = (swId: string, stationId: string, direction: LineDirection): 'straight' | 'diverging' => {
    const exact = switches.find((s) => s.id === swId);
    if (exact) return exact.state;

    const suffix = direction === LineDirection.Hilir ? '01' : '02';
    const matched = switches.find((s) => s.stationId === stationId && s.id.endsWith(suffix));
    if (matched) return matched.state;

    return 'straight';
  };

  // Resilient signal color getter
  const getSignalColor = (sigId: string, stationId: string, direction: LineDirection, isLoop: boolean): SignalColor => {
    const exact = signals.find((s) => s.id === sigId);
    if (exact) return exact.color;

    const key = direction === LineDirection.Hilir ? 'Hilir' : 'Hulu';
    const matched = signals.find((s) => s.id.includes(stationId) && s.id.includes(key));
    if (matched) return matched.color;

    return SignalColor.Green;
  };

  // 2. REAL-TIME PHYSIC TRANSITIONS WITH SWITCH AWARENESS (Sepur Belok tracking)
  useEffect(() => {
    const updatePhysicsLoop = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const dt = Math.min(deltaTime, 0.1);

      trains.forEach((t) => {
        const local = localTrainsRef.current[t.id];
        let currentKp = local ? local.kp : t.kp;

        const kpDiff = t.kp - currentKp;
        if (Math.abs(kpDiff) > 1.5) {
          currentKp = t.kp;
        } else {
          currentKp += kpDiff * 0.15;
        }

        // Determine train track Y height depending on switch state inside station area
        const branch = getActiveBranch(currentKp, t.routeBranch);
        const station = SCHEMATIC_STATIONS.find(
          (st) => st.branch === branch && Math.abs(st.kp - currentKp) < 0.12
        );

        let targetY = directionDefaultY(t.direction, branch);
        if (station) {
          if (t.direction === LineDirection.Hilir) {
            const swState = getSwitchState(`W-${station.id}-Hilir-In`, station.id, LineDirection.Hilir);
            targetY = swState === 'diverging' ? station.yHilir - 15 : station.yHilir;
          } else {
            const swState = getSwitchState(`W-${station.id}-Hulu-In`, station.id, LineDirection.Hulu);
            targetY = swState === 'diverging' ? station.yHulu + 15 : station.yHulu;
          }
        }

        // Crossover track interpolation (Wesel Penyeberangan Hulu-Hilir)
        const xoverStation = SCHEMATIC_STATIONS.find(
          (st) => ['JAKK', 'MRI', 'PSN', 'DPK', 'BOO'].includes(st.id) && Math.abs(st.kp - currentKp) < 0.35
        );
        if (xoverStation) {
          const kpBeforeStart = xoverStation.kp - 0.3;
          const kpBeforeEnd = xoverStation.kp - 0.2;
          const kpAfterStart = xoverStation.kp + 0.2;
          const kpAfterEnd = xoverStation.kp + 0.3;

          if (currentKp >= kpBeforeStart && currentKp <= kpBeforeEnd) {
            const swState = getSwitchState(`W-${xoverStation.id}-XOver-Before`, xoverStation.id, LineDirection.Hilir);
            if (swState === 'diverging') {
              const ratio = (currentKp - kpBeforeStart) / 0.1;
              const fromY = directionDefaultY(LineDirection.Hilir, branch);
              const toY = directionDefaultY(LineDirection.Hulu, branch);
              targetY = fromY + (toY - fromY) * Math.max(0, Math.min(1, ratio));
            }
          } else if (currentKp >= kpAfterStart && currentKp <= kpAfterEnd) {
            const swState = getSwitchState(`W-${xoverStation.id}-XOver-After`, xoverStation.id, LineDirection.Hulu);
            if (swState === 'diverging') {
              const ratio = (kpAfterEnd - currentKp) / 0.1;
              const fromY = directionDefaultY(LineDirection.Hulu, branch);
              const toY = directionDefaultY(LineDirection.Hilir, branch);
              targetY = fromY + (toY - fromY) * Math.max(0, Math.min(1, ratio));
            }
          }
        }

        const isStoppedBySignal = checkSignalStop(currentKp, t.direction, signals, local ? local.y : targetY, t.routeBranch);
        const effectiveSpeed = isStoppedBySignal ? 0 : t.speed;

        const kmPerSec = effectiveSpeed / 3600;
        if (effectiveSpeed > 0) {
          if (t.direction === LineDirection.Hilir) {
            currentKp += kmPerSec * dt;
          } else {
            currentKp -= kmPerSec * dt;
          }
        }

        currentKp = Math.max(0.0, Math.min(54.8, currentKp));

        const canvas = canvasRef.current;
        const width = canvas ? canvas.width : 1200;
        const targetX = kpToX(currentKp, width, t.routeBranch);

        const currentX = local ? local.x + (targetX - local.x) * 0.2 : targetX;
        const currentY = local ? local.y + (targetY - local.y) * 0.2 : targetY;

        localTrainsRef.current[t.id] = {
          kp: currentKp,
          x: currentX,
          y: currentY,
          speed: effectiveSpeed
        };
      });

      // Clear obsolete local trains
      const activeIds = new Set(trains.map((t) => t.id));
      Object.keys(localTrainsRef.current).forEach((id) => {
        if (!activeIds.has(id)) {
          delete localTrainsRef.current[id];
        }
      });

      drawCanvas();
      requestRef.current = requestAnimationFrame(updatePhysicsLoop);
    };

    if (imagesLoaded) {
      requestRef.current = requestAnimationFrame(updatePhysicsLoop);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [trains, signals, switches, imagesLoaded]);

  // Default track height helper
  const directionDefaultY = (dir: LineDirection, branch: 'Utara' | 'Selatan' | 'Timur'): number => {
    if (branch === 'Timur') {
      return dir === LineDirection.Hulu ? 60 : 30;
    } else if (branch === 'Selatan') {
      return dir === LineDirection.Hulu ? 310 : 250;
    } else {
      return dir === LineDirection.Hulu ? 150 : 90;
    }
  };

  // 3. CANVAS RENDERING ENGINE
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Backing charcoal slate
    ctx.fillStyle = '#05070e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(ctx, canvas.width, canvas.height);
    drawTrackInfrastructure(ctx, canvas.width);
    drawStationsLayout(ctx);
    drawSwitchesLever(ctx);
    drawSignalingBlocks(ctx);
    drawMovingTrains(ctx);
  };

  // Sub grid background lines
  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#080d1a';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  // Draws clean branching paths and dual track systems
  const drawTrackInfrastructure = (ctx: CanvasRenderingContext2D, width: number) => {
    // 1. UTARA BRANCH (X: 50 -> 400)
    ctx.strokeStyle = '#f59e0b'; // Hilir (Orange)
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 90);
    ctx.lineTo(400, 90);
    ctx.stroke();

    ctx.strokeStyle = '#3b82f6'; // Hulu (Blue)
    ctx.beginPath();
    ctx.moveTo(50, 150);
    ctx.lineTo(400, 150);
    ctx.stroke();

    // 2. SELATAN BRANCH (X: 400 -> 1150)
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(400, 250);
    ctx.lineTo(1150, 250);
    ctx.stroke();

    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(400, 310);
    ctx.lineTo(1150, 310);
    ctx.stroke();

    // 3. TIMUR BRANCH (X: 400 -> 1050)
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(400, 30);
    ctx.lineTo(1050, 30);
    ctx.stroke();

    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(400, 60);
    ctx.lineTo(1050, 60);
    ctx.stroke();

    // 4. HUB JUNCTION DIAGONAL TRANSITIONS (Manggarai Hub area)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);

    // Connect Utara to Selatan
    ctx.beginPath();
    ctx.moveTo(400, 90);
    ctx.lineTo(400, 250);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(400, 150);
    ctx.lineTo(400, 310);
    ctx.stroke();

    // Connect Hub to Timur
    ctx.beginPath();
    ctx.moveTo(400, 90);
    ctx.lineTo(400, 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(400, 150);
    ctx.lineTo(400, 60);
    ctx.stroke();

    ctx.setLineDash([]); // Reset
  };

  // Draws platforms and station loop lines (Sepur Belok) per "Update RRSid.png"
  const drawStationsLayout = (ctx: CanvasRenderingContext2D) => {
    SCHEMATIC_STATIONS.forEach((st) => {
      const startX = st.x - 60;
      const endX = st.x + 60;

      // Draw Sepur Belok tracks looping out and running parallel
      // Hilir Loop (loops UPwards)
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX - 20, st.yHilir);
      ctx.lineTo(startX, st.yHilir - 15);
      ctx.lineTo(endX, st.yHilir - 15);
      ctx.lineTo(endX + 20, st.yHilir);
      ctx.stroke();

      // Hulu Loop (loops DOWNwards)
      ctx.strokeStyle = '#2563eb';
      ctx.beginPath();
      ctx.moveTo(startX - 20, st.yHulu);
      ctx.lineTo(startX, st.yHulu + 15);
      ctx.lineTo(endX, st.yHulu + 15);
      ctx.lineTo(endX + 20, st.yHulu);
      ctx.stroke();

      // Station Platforms (Grey tactile box)
      ctx.fillStyle = 'rgba(71, 85, 105, 0.25)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;

      // Platform for Hilir loop
      ctx.fillRect(startX, st.yHilir - 27, 120, 10);
      ctx.strokeRect(startX, st.yHilir - 27, 120, 10);

      // Platform for Hulu loop
      ctx.fillRect(startX, st.yHulu + 17, 120, 10);
      ctx.strokeRect(startX, st.yHulu + 17, 120, 10);

      // Station name banner text
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(st.name, st.x - 30, (st.yHilir + st.yHulu) / 2 + 2);

      ctx.fillStyle = '#64748b';
      ctx.font = '7px monospace';
      ctx.fillText(`KM ${st.kp.toFixed(1)}`, st.x - 15, (st.yHilir + st.yHulu) / 2 + 10);
    });
  };

  // Draws the interactive switch points as black levers (Tombol Pemindah Wesel)
  const drawSwitchesLever = (ctx: CanvasRenderingContext2D) => {
    SCHEMATIC_SWITCHES.forEach((sw) => {
      const activeSwState = getSwitchState(sw.id, sw.stationId, sw.direction);
      const isDiverging = activeSwState === 'diverging';

      if (sw.id.includes('XOver')) {
        // Draw physical crossover tracks (always visible as muted line, turns active green when diverging)
        const endX = sw.id.includes('Before') ? sw.x + 40 : sw.x - 40;
        
        // Background line (inactive track)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sw.x, sw.y);
        ctx.lineTo(endX, sw.targetY);
        ctx.stroke();

        // Active path overlay
        if (isDiverging) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sw.x, sw.y);
          ctx.lineTo(endX, sw.targetY);
          ctx.stroke();
        }

        // Circle Button (Tombol Pemindah Wesel) - realistic black circle with green/red indicator
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = isDiverging ? '#10b981' : '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(isDiverging ? '➔' : '●', sw.x - 2.5, sw.y + 2.5);
      } else {
        // Draw the diverging visual branch angle
        ctx.strokeStyle = isDiverging ? '#10b981' : '#334155';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sw.x, sw.y);
        ctx.lineTo(sw.type === 'diverge' ? sw.x + 20 : sw.x - 20, sw.targetY);
        ctx.stroke();

        // Circle Button representation (Tombol Pemindah Wesel)
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = isDiverging ? '#10b981' : '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(isDiverging ? '➔' : '●', sw.x - 2.5, sw.y + 2.5);
      }
    });
  };

  // Draws protective signaling boxes before lines join back together
  const drawSignalingBlocks = (ctx: CanvasRenderingContext2D) => {
    SCHEMATIC_STATIONS.forEach((st) => {
      // 1. Hilir signals box (exit top side box)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 1]);
      ctx.strokeRect(st.x + 33, st.yHilir - 22, 14, 27);
      ctx.setLineDash([]);

      // 2. Hulu signals box (exit bottom side box)
      ctx.setLineDash([3, 1]);
      ctx.strokeRect(st.x - 47, st.yHulu - 5, 14, 27);
      ctx.setLineDash([]);

      // Draw signal lights
      const stationSignals = SCHEMATIC_SIGNALS.filter((sig) => sig.stationId === st.id);
      stationSignals.forEach((sig) => {
        const isLoop = sig.id.includes('Loop');
        const color = getSignalColor(sig.id, st.id, sig.direction, isLoop);
        const lightColor = color === SignalColor.Green ? '#10b981' : color === SignalColor.Yellow ? '#fbbf24' : '#ef4444';

        // Little LED dot
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sig.x, sig.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.arc(sig.x, sig.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow
        ctx.shadowColor = lightColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(sig.x, sig.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });
    });
  };

  // Draws preloaded train models with dynamic aspect-ratio scaling (Anti-Gepeng)
  const drawMovingTrains = (ctx: CanvasRenderingContext2D) => {
    trains.forEach((t) => {
      const local = localTrainsRef.current[t.id];
      if (!local) return;

      const isHilir = t.direction === LineDirection.Hilir;
      const spacing = 22; // spacing between trailing coaches in pixels

      for (let idx = 0; idx < 4; idx++) {
        const coachOffset = idx * spacing * (isHilir ? -1 : 1);
        const coachX = local.x + coachOffset;
        const coachY = local.y;

        const isLoco = idx === 0;
        let imgKey = 'GerbongKRL';

        if (t.type === TrainType.CC201 || t.type === TrainType.CC206) {
          imgKey = isLoco ? (t.type === TrainType.CC206 ? 'CC206' : 'CC201') : 'GerbongKAJJ';
        } else {
          imgKey = isLoco ? 'KRLJR205' : 'GerbongKRL';
        }

        let drawn = false;
        try {
          const img = imagesRef.current[imgKey];
          if (img && img.complete && img.naturalWidth > 0) {
            const isHorizontal = img.naturalWidth >= img.naturalHeight;
            ctx.save();
            ctx.translate(coachX, coachY);

            if (isHorizontal) {
              // Horizontal side-profile train scaling
              const targetWidth = 42;
              const aspect = img.naturalHeight / img.naturalWidth;
              const targetHeight = targetWidth * aspect;

              // Flip train direction depending on direction traveling
              if (!isHilir) {
                ctx.scale(-1, 1);
              }
              ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
            } else {
              // Vertical train scaling (rotate to align with horizontal track)
              const targetHeight = 15;
              const aspect = img.naturalWidth / img.naturalHeight;
              const targetWidth = targetHeight * aspect;

              ctx.rotate(isHilir ? Math.PI / 2 : -Math.PI / 2);
              ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
            }
            ctx.restore();
            drawn = true;
          }
        } catch (err) {
          console.warn(`Error drawing sprite ${imgKey}, using vector fallback:`, err);
        }

        if (!drawn) {
          // Robust vector fallback to ensure rendering NEVER stalls or crashes the app
          ctx.save();
          ctx.translate(coachX, coachY);

          // Draw train car body
          ctx.fillStyle = isLoco 
            ? (t.type === TrainType.CC206 ? '#f59e0b' : '#ef4444') 
            : '#1e293b'; // Orange/Red for Loco, dark slate for coaches
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-20, -6, 40, 12, 3);
          ctx.fill();
          ctx.stroke();

          // Draw wheels
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(-12, 6, 3, 0, Math.PI * 2);
          ctx.arc(12, 6, 3, 0, Math.PI * 2);
          ctx.fill();

          // Draw small windows
          ctx.fillStyle = '#fef08a'; // yellow windows glow
          ctx.fillRect(-14, -3, 6, 4);
          ctx.fillRect(-4, -3, 6, 4);
          ctx.fillRect(6, -3, 6, 4);

          // Front-stripe accent for Loco
          if (isLoco) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(isHilir ? 14 : -18, -6, 4, 12);
          }

          ctx.restore();
        }
      }

      // Metadata overhead text
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(local.x - 25, local.y - 23, 50, 9);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(local.x - 25, local.y - 23, 50, 9);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 6.5px monospace';
      ctx.fillText(t.name, local.x - 21, local.y - 16);
    });
  };

  // Handle interactable user clicks on switches and signals
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check click distance on schematic switches
    SCHEMATIC_SWITCHES.forEach((sw) => {
      const dist = Math.sqrt((clickX - sw.x) ** 2 + (clickY - sw.y) ** 2);
      if (dist < 14) {
        if (userRole.includes('PPKA') || userRole.includes('Operator')) {
          const currentState = getSwitchState(sw.id, sw.stationId, sw.direction);
          const nextState = currentState === 'straight' ? 'diverging' : 'straight';

          // Route to database switch representation in parent state
          let targetDbSwId = sw.id;
          const exactMatch = switches.some((s) => s.id === sw.id);
          if (!exactMatch) {
            const suffix = sw.direction === LineDirection.Hilir ? '01' : '02';
            const dbSw = switches.find((s) => s.stationId === sw.stationId && s.id.endsWith(suffix));
            if (dbSw) {
              targetDbSwId = dbSw.id;
            }
          }

          if (onSwitchToggle) {
            onSwitchToggle(targetDbSwId, nextState);
          }
        } else {
          alert('Akses Ditolak! Hanya PPKA dinas yang diizinkan untuk mengoperasikan wesel stasiun.');
        }
      }
    });

    // Check click distance on schematic signals
    SCHEMATIC_SIGNALS.forEach((sig) => {
      const dist = Math.sqrt((clickX - sig.x) ** 2 + (clickY - sig.y) ** 2);
      if (dist < 14) {
        if (userRole.includes('PPKA') || userRole.includes('Operator')) {
          let targetDbSigId = sig.id;
          const exactMatch = signals.some((s) => s.id === sig.id);
          if (!exactMatch) {
            const key = sig.direction === LineDirection.Hilir ? 'Hilir' : 'Hulu';
            const dbSig = signals.find((s) => s.id.includes(sig.stationId) && s.id.includes(key));
            if (dbSig) {
              targetDbSigId = dbSig.id;
            }
          }

          if (onSignalToggle) {
            onSignalToggle(targetDbSigId);
          }
        } else {
          alert('Akses Ditolak! Hanya PPKA dinas yang diizinkan mengendalikan sinyal visual.');
        }
      }
    });
  };

  return (
    <div className="relative w-full bg-[#03060f] border-2 border-slate-900 rounded-xl p-3 shadow-2xl flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#070b16] px-3 py-2 rounded border border-indigo-950/80 gap-2">
        <div className="flex items-center gap-2">
          <Compass className="animate-spin-slow text-orange-500" size={16} />
          <div>
            <h4 className="text-xs font-black tracking-wider text-slate-200 uppercase font-mono">PANEL PERSINYALAN DOUBLE TRACK (WESEL W-STASIUN)</h4>
            <p className="text-[9px] text-slate-500 font-mono">Gapeka RRSid - 3 Jalur Bercabang Mandiri (Utara, Selatan, Timur)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start">
          <span className="text-[9px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900 px-2 py-0.5 rounded">
            ROLE: <strong className="text-white">{userRole}</strong>
          </span>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded">
            WILAYAH TUGAS: <strong className="text-white">{userStationId}</strong>
          </span>
        </div>
      </div>

      {!imagesLoaded ? (
        <div className="w-full h-44 bg-[#050811] rounded border border-slate-900 flex flex-col items-center justify-center gap-3">
          <Radio className="text-indigo-400 animate-pulse" size={24} />
          <div className="text-center px-4">
            <p className="text-xs font-mono text-indigo-300 font-bold uppercase">MEMUAT SPRITE KERETA (MOBILE DEVICE COMPATIBILITY)...</p>
            <div className="w-48 h-1.5 bg-slate-950 rounded-full mt-2 mx-auto overflow-hidden border border-slate-800">
              <div
                className="h-full bg-indigo-600 transition-all duration-100"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full overflow-x-auto custom-scrollbar">
          <canvas
            ref={canvasRef}
            width={1200}
            height={380}
            onClick={handleCanvasClick}
            className="block w-full min-w-[1200px] h-auto cursor-crosshair rounded border border-slate-900 bg-[#050811]"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#070b16] p-2.5 rounded border border-indigo-950/50 text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-amber-500 shrink-0" size={14} />
          <p className="text-slate-400">
            <strong>Proteksi Sinyal (Anti-Collision):</strong> Sinyal diposisikan sebelum rel bergabung. Jika sinyal MERAH, rangkaian otomatis melakukan pengereman darurat (SPAD prevention).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="text-emerald-500 shrink-0" size={14} />
          <p className="text-slate-400">
            <strong>Operasi Wesel (PPKA):</strong> Klik tombol hitam di titik percabangan stasiun untuk mengarahkan jalur kereta menuju Sepur Lurus atau Sepur Belok (Diverging).
          </p>
        </div>
      </div>
    </div>
  );
}
