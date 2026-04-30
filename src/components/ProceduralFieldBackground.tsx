import { useEffect, useRef } from "react";

const CONFIG = {
  seed: 18429,
  grassDensity: 0.00115,
  animatedGrassRatio: 0.22,
  windIntensity: 0.48,
  targetFps: 34,
};

interface GrassBlade {
  x: number;
  y: number;
  h: number;
  lean: number;
  width: number;
  alpha: number;
  phase: number;
  sway: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixColor(a: string, b: string, t: number, alpha = 1) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgba(${Math.round(lerp(ca[0], cb[0], t))}, ${Math.round(lerp(ca[1], cb[1], t))}, ${Math.round(lerp(ca[2], cb[2], t))}, ${alpha})`;
}

function drawGrassBase(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  const random = createSeededRandom(CONFIG.seed + 1);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#c6e27d");
  gradient.addColorStop(0.5, "#97cf61");
  gradient.addColorStop(1, "#6cb45a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 180; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = lerp(42, 180, random());
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r);
    spot.addColorStop(0, random() > 0.48 ? "rgba(255, 231, 126, 0.15)" : "rgba(87, 165, 78, 0.18)");
    spot.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  const noiseScale = 3;
  const noise = document.createElement("canvas");
  noise.width = Math.ceil((width * dpr) / noiseScale);
  noise.height = Math.ceil((height * dpr) / noiseScale);
  const noiseCtx = noise.getContext("2d");
  if (!noiseCtx) return;

  const image = noiseCtx.createImageData(noise.width, noise.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = Math.floor(random() * 42);
    image.data[i] = 126 + n;
    image.data[i + 1] = 158 + n;
    image.data[i + 2] = 72 + n * 0.55;
    image.data[i + 3] = 24;
  }
  noiseCtx.putImageData(image, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.38;
  ctx.drawImage(noise, 0, 0, width, height);
  ctx.restore();
}

function generateGrassBlades(width: number, height: number, density: number, densityScale: number) {
  const random = createSeededRandom(CONFIG.seed + 2);
  const count = Math.floor(width * height * density * densityScale);
  const clusters = Array.from({ length: Math.max(34, Math.floor(count / 70)) }, () => ({
    x: random() * width,
    y: random() * height,
    r: lerp(50, 180, random()),
    pull: lerp(0.2, 0.82, random()),
  }));

  const blades: GrassBlade[] = [];
  for (let i = 0; i < count; i++) {
    const cluster = clusters[Math.floor(random() * clusters.length)];
    const angle = random() * Math.PI * 2;
    const distance = Math.pow(random(), 1.9) * cluster.r;
    const x = lerp(random() * width, cluster.x + Math.cos(angle) * distance, cluster.pull);
    const y = lerp(random() * height, cluster.y + Math.sin(angle) * distance, cluster.pull);
    const shade = random();

    blades.push({
      x,
      y,
      h: lerp(7, 31, Math.pow(random(), 0.72)),
      lean: lerp(-0.42, 0.42, random()) + (x / width - 0.5) * 0.08,
      width: lerp(0.55, 1.9, random()),
      alpha: lerp(0.3, 0.82, random()),
      phase: random() * Math.PI * 2,
      sway: lerp(0.18, 1.08, random()),
      color: mixColor(shade > 0.54 ? "#d9dc75" : "#5da94f", shade > 0.54 ? "#78b64f" : "#b8d266", random()),
    });
  }

  return blades;
}

function drawBlade(ctx: CanvasRenderingContext2D, blade: GrassBlade, time: number, animated: boolean, reducedMotion: boolean) {
  const sway = animated && !reducedMotion ? Math.sin(time * 0.0012 + blade.phase) * CONFIG.windIntensity * blade.sway : 0;
  const tipX = blade.x + (blade.lean + sway * 0.24) * blade.h;
  const tipY = blade.y - blade.h;

  ctx.globalAlpha = blade.alpha;
  ctx.strokeStyle = blade.color;
  ctx.lineWidth = blade.width;
  ctx.beginPath();
  ctx.moveTo(blade.x, blade.y);
  ctx.bezierCurveTo(
    blade.x + blade.lean * blade.h * 0.24,
    blade.y - blade.h * 0.34,
    tipX - sway * 2,
    blade.y - blade.h * 0.72,
    tipX,
    tipY,
  );
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawGrassDetails(ctx: CanvasRenderingContext2D, blades: GrassBlade[], time: number, animated: boolean, reducedMotion: boolean) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const blade of blades) drawBlade(ctx, blade, time, animated, reducedMotion);
}

function drawGroundDetails(ctx: CanvasRenderingContext2D, width: number, height: number, densityScale: number) {
  const random = createSeededRandom(CONFIG.seed + 3);

  for (let i = 0; i < 115 * densityScale; i++) {
    const x = random() * width;
    const y = random() * height;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI);
    ctx.fillStyle = mixColor("#d8b867", "#7ea64d", random(), 0.42);
    ctx.beginPath();
    ctx.ellipse(0, 0, lerp(2, 5.5, random()), lerp(0.8, 2.2, random()), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < 48 * densityScale; i++) {
    const x = random() * width;
    const y = random() * height;
    ctx.fillStyle = random() > 0.5 ? "rgba(255, 219, 106, 0.58)" : "rgba(248, 169, 164, 0.52)";
    ctx.beginPath();
    ctx.arc(x, y, lerp(1, 2.4, random()), 0, Math.PI * 2);
    ctx.fill();
  }
}

function generateParticles(width: number, height: number, reducedMotion: boolean) {
  if (reducedMotion) return [];
  const random = createSeededRandom(CONFIG.seed + 4);
  const count = Math.floor(clamp((width * height) / 52000, 8, 28));
  return Array.from({ length: count }, () => ({
    x: random() * width,
    y: random() * height,
    r: lerp(0.8, 2.1, random()),
    speed: lerp(5, 18, random()),
    drift: lerp(-4, 12, random()),
    phase: random() * Math.PI * 2,
    alpha: lerp(0.1, 0.28, random()),
  }));
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], time: number, width: number, height: number) {
  ctx.save();
  ctx.fillStyle = "#f4e4a4";
  for (const particle of particles) {
    const t = time * 0.001;
    const x = (particle.x + t * particle.drift + Math.sin(t + particle.phase) * 8) % (width + 20);
    const y = (particle.y - t * particle.speed + height + 20) % (height + 20);
    ctx.globalAlpha = particle.alpha * (0.7 + Math.sin(t * 1.7 + particle.phase) * 0.3);
    ctx.beginPath();
    ctx.arc(x - 10, y - 10, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function ProceduralFieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let staticLayer = document.createElement("canvas");
    let staticCtx = staticLayer.getContext("2d");
    let blades: GrassBlade[] = [];
    let animatedBlades: GrassBlade[] = [];
    let particles: Particle[] = [];
    let densityScale = 1;
    let animationFrame = 0;
    let resizeTimer = 0;
    let lastFrame = 0;

    function renderStaticLayer() {
      if (!staticCtx) return;
      drawGrassBase(staticCtx, width, height, dpr);
      drawGroundDetails(staticCtx, width, height, densityScale);
      drawGrassDetails(staticCtx, reducedMotion ? blades : blades.filter((_, index) => index % 4 !== 0), 0, false, reducedMotion);
    }

    function resizeCanvas() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      staticLayer = document.createElement("canvas");
      staticLayer.width = Math.floor(width * dpr);
      staticLayer.height = Math.floor(height * dpr);
      staticCtx = staticLayer.getContext("2d");
      staticCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);

      densityScale = Math.min(width, height) < 680 ? 0.78 : clamp((width * height) / (1280 * 760), 0.9, 1.55);
      blades = generateGrassBlades(width, height, CONFIG.grassDensity, densityScale);
      animatedBlades = blades.filter((_, index) => index % Math.max(2, Math.round(1 / CONFIG.animatedGrassRatio)) === 0);
      particles = generateParticles(width, height, reducedMotion);
      renderStaticLayer();
    }

    function scheduleResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resizeCanvas, 140);
    }

    function animate(time = 0) {
      const minFrameTime = reducedMotion ? 1000 : 1000 / CONFIG.targetFps;
      if (time - lastFrame < minFrameTime) {
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      lastFrame = time;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(staticLayer, 0, 0, width, height);

      if (!reducedMotion) {
        drawGrassDetails(ctx, animatedBlades, time, true, reducedMotion);
        drawParticles(ctx, particles, time, width, height);
      }

      animationFrame = requestAnimationFrame(animate);
    }

    resizeCanvas();
    animationFrame = requestAnimationFrame(animate);
    window.addEventListener("resize", scheduleResize, { passive: true });

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", scheduleResize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen pointer-events-none" aria-hidden="true" />;
}
