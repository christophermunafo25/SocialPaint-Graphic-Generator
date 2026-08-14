// Commit-moment confetti. Motion adapted from the BYQ Supply "Confetti
// Burst" gem under its integration licence — the physics (gravity, drag,
// cone, flutter, lifetimes) are copied verbatim, because that is what makes
// the effect feel right. EVERYTHING visual is ours: the paper flies in the
// five SocialPaint brand primitives, read from the live theme at fire time,
// and there is no button, no auto-play, and none of BYQ's palette.
//
// Fired only on the moments that send work into the world — publishing a
// template, downloading a graphic. Transient by nature: the canvas mounts
// for the burst and removes itself when the last piece lands.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  tilt: number;
  tiltSpeed: number;
  color: string;
  life: number;
  decay: number;
}

const GRAVITY = 0.32;
const DRAG = 0.986;

/** The five brand primitives, resolved from the live theme so the paper is
 * always exactly the brand — never a baked copy that could drift. */
function brandColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  return ["--voltage", "--wednesdays", "--fire", "--aqua", "--sunshine"]
    .map((t) => style.getPropertyValue(t).trim())
    .filter(Boolean);
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let raf: number | null = null;

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function teardown(): void {
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null;
  particles = [];
  canvas?.remove();
  canvas = null;
}

function tick(): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vx *= DRAG;
    p.vy = p.vy * DRAG + GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.spin;
    p.tilt += p.tiltSpeed;
    if (p.vy > 0) p.life -= p.decay;
    if (p.life <= 0 || p.y - p.h > window.innerHeight) {
      particles.splice(i, 1);
      continue;
    }
    const flutter = Math.cos(p.tilt);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.fillRect((-p.w / 2) * flutter, -p.h / 2, p.w * flutter, p.h);
    ctx.restore();
  }

  if (particles.length > 0) raf = requestAnimationFrame(tick);
  else teardown();
}

/** Fire one celebratory burst from the centre of `from` (or the lower
 * centre of the viewport). Respects prefers-reduced-motion with a brief
 * stationary scatter instead of the physics burst. */
export function celebrate(from?: Element | null): void {
  const colors = brandColors();
  if (!colors.length) return;
  const ctx = ensureCanvas();
  if (!ctx) return;

  const rect = from?.getBoundingClientRect();
  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const originY = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.7;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: originX + rand(-60, 60),
        y: originY + rand(-40, 40),
        vx: 0,
        vy: 0,
        w: rand(5, 9),
        h: rand(5, 9),
        rot: rand(0, Math.PI * 2),
        spin: 0,
        tilt: 0,
        tiltSpeed: 0,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
        decay: 0.03,
      });
    }
  } else {
    for (let i = 0; i < 90; i++) {
      const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const speed = rand(6, 15) * (0.6 + Math.random() * 0.7);
      const ribbon = Math.random() < 0.55;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: ribbon ? rand(4, 6) : rand(6, 10),
        h: ribbon ? rand(9, 16) : rand(6, 10),
        rot: rand(0, Math.PI * 2),
        spin: rand(-0.28, 0.28),
        tilt: rand(0, Math.PI * 2),
        tiltSpeed: rand(0.08, 0.2),
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
        decay: rand(0.006, 0.012),
      });
    }
  }

  if (raf === null) raf = requestAnimationFrame(tick);
}
