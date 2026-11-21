/**
 * "Christmas Caravan" background: snow on the Sahara, a giant moon, and a
 * caravan of camels in Santa hats walking along the lower dune.
 * Static layers are pre-rendered on resize; each frame only draws the moving
 * parts (twinkles, camels, snow).
 */

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Twinkle { x: number; y: number; s: number; p: number; v: number }
interface Flake { x: number; y: number; r: number; v: number; d: number }

type Ctx = CanvasRenderingContext2D;

function layer(w: number, h: number, dpr: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, ctx];
}

function dune(c: Ctx, w: number, h: number, base: number, amp: number, f: number, ph: number, fill: string, rim: string) {
  const yAt = (x: number) => base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.35;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w + 6; x += 6) c.lineTo(x, yAt(x));
  c.lineTo(w, h);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.beginPath();
  for (let x = 0; x <= w + 6; x += 6) {
    if (x) c.lineTo(x, yAt(x));
    else c.moveTo(x, yAt(x));
  }
  c.strokeStyle = rim;
  c.lineWidth = 1.3;
  c.stroke();
  return yAt;
}

function sparkle(c: Ctx, x: number, y: number, s: number) {
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x, y, x + s * 0.38, y);
  c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s * 0.38, y);
  c.quadraticCurveTo(x, y, x, y - s);
}

function camel(c: Ctx, x: number, y: number, s: number, ph: number) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = "#17123d";
  c.strokeStyle = "#17123d";
  c.lineCap = "round";
  c.lineWidth = 3.2;
  [-14, -8, 10, 16].forEach((lx, i) => {
    const sw = Math.sin(ph + (i % 2 ? Math.PI : 0)) * 5;
    c.beginPath();
    c.moveTo(lx, -2);
    c.lineTo(lx + sw, 22);
    c.stroke();
  });
  c.beginPath();
  c.ellipse(0, -6, 22, 10, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(-12, -12);
  c.quadraticCurveTo(-4, -34, 6, -12);
  c.fill();
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(18, -8);
  c.quadraticCurveTo(30, -12, 30, -26);
  c.stroke();
  c.beginPath();
  c.ellipse(35, -27, 8, 4.5, 0.15, 0, TAU);
  c.fill();
  // Santa hat
  c.fillStyle = "#d8344a";
  c.beginPath();
  c.moveTo(28, -30);
  c.quadraticCurveTo(32, -44, 44, -40);
  c.quadraticCurveTo(38, -36, 38, -30);
  c.fill();
  c.fillStyle = "#fff6ea";
  c.beginPath();
  c.roundRect(27, -32, 12, 3.6, 1.8);
  c.fill();
  c.beginPath();
  c.arc(44, -40, 2.4, 0, TAU);
  c.fill();
  // Gift on the hump
  c.fillStyle = "#dcc092";
  c.fillRect(-8, -30, 10, 9);
  c.fillStyle = "#d8344a";
  c.fillRect(-4, -30, 2, 9);
  c.fillRect(-8, -26.5, 10, 2);
  c.restore();
}

export interface Scene {
  resize(w: number, h: number, dpr: number): void;
  draw(c: Ctx, t: number, dt: number): void;
}

export function createCaravanScene(reducedMotion: boolean): Scene {
  let W = 0;
  let H = 0;
  let back: HTMLCanvasElement | null = null;
  let front: HTMLCanvasElement | null = null;
  let ridgeAt: (x: number) => number = () => 0;
  let camelScale = 0.7;
  let twinkles: Twinkle[] = [];
  let flakes: Flake[] = [];
  let walk = 0;

  return {
    resize(w, h, dpr) {
      W = w;
      H = h;
      const [b, bc] = layer(w, h, dpr);
      const [f, fc] = layer(w, h, dpr);
      const sky = bc.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0f1640");
      sky.addColorStop(0.55, "#3a2f78");
      sky.addColorStop(0.8, "#7a5a8a");
      bc.fillStyle = sky;
      bc.fillRect(0, 0, w, h);

      const base = Math.min(w, h * 0.56);
      const mr = base * 0.36;
      const mx = w / 2 + mr * 0.5;
      const my = h * 0.4;
      const glow = bc.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 2.4);
      glow.addColorStop(0, "rgba(255,240,210,.35)");
      glow.addColorStop(1, "rgba(255,240,210,0)");
      bc.fillStyle = glow;
      bc.fillRect(0, 0, w, h);
      bc.fillStyle = "#fff1d2";
      bc.beginPath();
      bc.arc(mx, my, mr, 0, TAU);
      bc.fill();
      bc.fillStyle = "rgba(220,192,146,.35)";
      for (const [a, b2, r] of [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.09], [0.35, -0.35, 0.07], [-0.45, 0.25, 0.05]]) {
        bc.beginPath();
        bc.arc(mx + a * mr, my + b2 * mr, r * mr, 0, TAU);
        bc.fill();
      }
      dune(bc, w, h, h * 0.68, 9, 0.008, 2, "#4a3a7c", "rgba(255,236,200,.5)");
      ridgeAt = dune(bc, w, h, h * 0.8, 9, 0.009, 0.4, "#2c2266", "rgba(255,236,200,.6)");
      dune(fc, w, h, h * 0.9, 10, 0.011, 1.1, "#1a1448", "rgba(255,236,200,.3)");
      back = b;
      front = f;

      camelScale = clamp(Math.min(w / 300, h / 533) * 0.55, 0.5, 1);
      twinkles = [];
      const n = Math.min(90, Math.round((w * h) / 7000));
      let guard = 0;
      while (twinkles.length < n && guard++ < n * 20) {
        const x = Math.random() * w;
        const y = Math.random() * h * 0.62;
        if (Math.hypot(x - mx, y - my) < mr * 1.08) continue;
        twinkles.push({ x, y, s: rand(1.6, 4.6), p: rand(0, TAU), v: rand(0.6, 1.8) });
      }
      const fl = Math.min(220, Math.round((w * h) / 4200));
      flakes = Array.from({ length: fl }, () => ({ x: Math.random() * w, y: Math.random() * h, r: rand(0.8, 2.4), v: rand(12, 34), d: rand(0, TAU) }));
    },

    draw(c, t, dt) {
      if (!back || !front) return;
      const dpr = c.getTransform().a || 1;
      if (!reducedMotion) walk += dt;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(back, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      c.fillStyle = "#fffaf0";
      for (const p of twinkles) {
        c.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.v + p.p));
        c.beginPath();
        sparkle(c, p.x, p.y, p.s);
        c.fill();
      }
      c.globalAlpha = 1;

      const s = camelScale;
      const gap = 100 * s;
      const count = 5;
      const span = W + gap * count + 60 * s;
      for (let i = 0; i < count; i++) {
        const x = ((walk * 22 * s + i * gap) % span) - gap * 1.2;
        camel(c, x, ridgeAt(x) - 20 * s, s, walk * 5 + i);
      }

      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(front, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      c.fillStyle = "#ffffff";
      c.globalAlpha = 0.75;
      for (const f of flakes) {
        if (!reducedMotion) {
          f.y += f.v * dt;
          f.x += Math.sin(t + f.d) * 0.3;
        }
        if (f.y > H) {
          f.y = -4;
          f.x = Math.random() * W;
        }
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    },
  };
}
