class DynamicAudioEngine {
  private ctx: AudioContext | null = null;
  private clickInterval: any = null;

  constructor() {
    // Lazy initialized on user click
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  // Play Semboyan 35 Loc Horn (Indonesian train horn sound combining 2 dominant pitches)
  playSemboyan35() {
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(392.00, ctx.currentTime); // G4

    // Volume envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.2);
    osc2.stop(ctx.currentTime + 1.2);
  }

  // Play PJL Crossing Bell (Indonesian "Ting-Ting-Ting" warning bell)
  playPJLBell(duration = 2.0) {
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    // Create dual chime oscillators
    const count = 3;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.4;
      if (delay > duration) break;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + delay); // High A

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.1, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    }
  }

  // Train Door chime (Ding Dong)
  playDoorChime() {
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, vol = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    };

    playTone(523.25, now); // C5
    playTone(659.25, now + 0.25); // E5
  }

  // Air brake release hiss ("psshhhh")
  playBrakeHiss() {
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.8; // 0.8 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // highpass filter for the "psshh" sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(1.0, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + 0.8);
  }

  // Loop of click-clack rail joint sounds proportional to speed
  startClickClackLoop(speedKmh: number) {
    if (speedKmh < 10) {
      this.stopClickClack();
      return;
    }

    this.initCtx();
    if (!this.ctx) return;

    // speed in km/h dictates interval between clicks
    const intervalMs = Math.max(300, 3000 - speedKmh * 25);
    
    this.stopClickClack();

    this.clickInterval = setInterval(() => {
      this.playSingleClickClack();
    }, intervalMs);
  }

  private playSingleClickClack() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const click = (delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(70, now + delay);
      
      gain.gain.setValueAtTime(0.02, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.06);
    };

    click(0);
    click(0.08); // double click representation
  }

  stopClickClack() {
    if (this.clickInterval) {
      clearInterval(this.clickInterval);
      this.clickInterval = null;
    }
  }
}

export const audio = new DynamicAudioEngine();
export default audio;
