// Lightweight WebAudio sound effects with proper cleanup
let ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
};

const playSound = (
  freq: number,
  freqEnd: number,
  type: "triangle" | "square",
  duration: number,
  gain: number,
  rampType: "exponential" | "linear" = "exponential"
) => {
  const c = getCtx();
  if (!c) return;

  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);

  if (rampType === "exponential") {
    try {
      o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
    } catch {
      o.frequency.linearRampToValueAtTime(freqEnd, c.currentTime + duration);
    }
  } else {
    o.frequency.linearRampToValueAtTime(freqEnd, c.currentTime + duration);
  }

  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration + 0.05);

  o.connect(g).connect(c.destination);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration + 0.1);
};

export const playPlock = () => {
  playSound(420, 180, "triangle", 0.12, 0.4);
};

export const playInvalid = () => {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(180, c.currentTime);
  o.frequency.linearRampToValueAtTime(120, c.currentTime + 0.15);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime);
  o.stop(c.currentTime + 0.2);
};

export const playApplause = () => {
  const c = getCtx();
  if (!c) return;

  const duration = 1.8;
  const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / c.sampleRate;
    const env = Math.exp(-((t - 0.2) ** 2) * 4) + Math.exp(-((t - 0.8) ** 2) * 6) + 0.4;
    data[i] = (Math.random() * 2 - 1) * env * 0.35;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2000;
  filter.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.6;

  src.connect(filter).connect(g).connect(c.destination);
  src.start(c.currentTime);
  src.stop(c.currentTime + duration + 0.2);
};

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (ctx) {
      ctx.close();
      ctx = null;
    }
  });
}
