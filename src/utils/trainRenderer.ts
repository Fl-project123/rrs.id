import { Train, TrainType, LineDirection } from '../types';

let preloadedBitmaps: Record<string, ImageBitmap> = {};

export async function preloadTrainSprites(): Promise<Record<string, ImageBitmap>> {
  const urls = {
    'CC201': 'CC 201.png',
    'CC206': 'CC 206.png',
    'GerbongKAJJ': 'Gerbong KAJJ.png',
    'GerbongKRL': 'Gerbong KRL.png',
    'KRLJR205': 'KRL JR 205.png'
  };

  const loaded: Record<string, ImageBitmap> = {};
  for (const [key, url] of Object.entries(urls)) {
    // encodeURI so filenames with spaces (e.g. "CC 201.png") resolve reliably as "/CC%20201.png"
    const encodedUrl = encodeURI(url);
    try {
      const res = await fetch('/' + encodedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      loaded[key] = bitmap;
    } catch (e) {
      console.warn("Retrying with relative path for:", key);
      try {
        const res = await fetch(encodedUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        loaded[key] = bitmap;
      } catch (e2) {
        console.error("Failed to pre-render ImageBitmap for:", key, e2);
      }
    }
  }
  preloadedBitmaps = loaded;
  // Immediately draw any already-mounted train canvases now that sprites are ready, instead
  // of waiting for the next unrelated re-render tick (which previously could leave trains
  // invisible for a moment, or indefinitely if a tab was paused/backgrounded at load time).
  renderTrains();
  return loaded;
}

export function getLoadedBitmaps(): Record<string, ImageBitmap> {
  return preloadedBitmaps;
}

// Full required renderTrains() function using Canvas drawImage
export function renderTrains() {
  const canvases = document.querySelectorAll('.train-car-canvas');
  canvases.forEach((canvasEl: any) => {
    const canvas = canvasEl as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const type = canvas.dataset.type as TrainType;
    const idx = parseInt(canvas.dataset.idx || '0');
    const totalCars = parseInt(canvas.dataset.totalCars || '4');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let bitmap: ImageBitmap | undefined;

    // Direct mappings to uploaded PNG sprites
    if (type === TrainType.CC201) {
      if (idx === 0) {
        bitmap = preloadedBitmaps['CC201'];
      } else {
        bitmap = preloadedBitmaps['GerbongKAJJ'];
      }
    } else if (type === TrainType.CC206) {
      if (idx === 0) {
        bitmap = preloadedBitmaps['CC206'];
      } else {
        bitmap = preloadedBitmaps['GerbongKAJJ'];
      }
    } else if (type === TrainType.KRL_8 || type === TrainType.KRL_12) {
      if (idx === 0 || idx === totalCars - 1) {
        bitmap = preloadedBitmaps['KRLJR205'];
      } else {
        bitmap = preloadedBitmaps['GerbongKRL'];
      }
    } else if (type === TrainType.Langsir) {
      if (idx === 0) {
        bitmap = preloadedBitmaps['CC201'];
      } else {
        bitmap = preloadedBitmaps['GerbongKRL'];
      }
    } else {
      // Fallback
      if (idx === 0) {
        bitmap = preloadedBitmaps['CC206'];
      } else {
        bitmap = preloadedBitmaps['GerbongKAJJ'];
      }
    }

    if (bitmap) {
      const naturalWidth = bitmap.width || (bitmap as any).naturalWidth || 1;
      const naturalHeight = bitmap.height || (bitmap as any).naturalHeight || 1;

      // Source sprites (CC 201.png, KRL JR 205.png, dll) are horizontal side-profile
      // photos with the nose/front of the train facing RIGHT. This canvas, however, is a
      // top-down, portrait-oriented (vertical) frame whose PARENT wrapper is rotated by
      // the train's real compass bearing (see RealWorldMap.tsx: `rotate(${bearing}deg)`).
      // So here we must first rotate the sprite -90deg (nose-right -> nose-up) so that,
      // once the outer bearing rotation is applied, the train visually faces the correct
      // direction of travel and stays aligned with the track instead of appearing sideways.
      const aspectRatio = naturalWidth / naturalHeight; // length-to-width ratio of the train body
      const targetHeight = canvas.height; // train length maps to canvas height (direction of travel)
      const targetWidth = targetHeight / aspectRatio; // train width maps to canvas width

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(bitmap, -targetHeight / 2, -targetWidth / 2, targetHeight, targetWidth);
      ctx.restore();
    }
  });
}
