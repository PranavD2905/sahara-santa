/**
 * Imperative engine for the tarot Reveal: deck → cascade → deal → shell game
 * → spotlight → the chosen card rises, glows and flips onto the Member's
 * person. After the Reveal the card can be dragged to turn it (momentum and a
 * spring back to the front); a tap replays the animation on the same person.
 *
 * All motion is transform/opacity only (Web Animations API), so it stays on
 * the compositor. The React component renders the DOM; this module animates it.
 */

import { CARD_RATIO, cardArt } from "./card-art";
import { createCaravanScene } from "./scene";

export interface TarotPerson {
  name: string;
  image: string | null;
}

export type TarotPhase = "ready" | "drawing" | "revealed";

export interface TarotOptions {
  /** Already-revealed person (from the server), or null before the first Reveal. */
  known: TarotPerson | null;
  /** Performs the Reveal on the server. Null means there's no Assignment. */
  fetchPerson: () => Promise<TarotPerson | null>;
  onPhase: (phase: TarotPhase) => void;
  onError: (message: string) => void;
  onAnnounce: (message: string) => void;
}

export interface TarotHandle {
  draw(): void;
  /** Call after the details panel has rendered so the card can make room for it. */
  layoutPanel(): void;
  destroy(): void;
}

const DECK_SIZE = 13;
const PERSP = 1100;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapDeg = (a: number) => {
  const m = ((a % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
};
function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface St { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number; o: number }
interface Mover { el: HTMLElement; st: St }
interface Card extends Mover { cell: number }
interface Particle {
  x: number; y: number; vx: number; vy: number; g: number; drag: number; life: number; max: number;
  size: number; grow: number; a: number; fin: number; tw: number; seed: number; color: string;
}

const S = (o: Partial<St> = {}): St => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 1, ...o });
const r2 = (v: number) => Math.round(v * 100) / 100;
const tf = (s: St) =>
  `translate3d(${r2(s.x)}px,${r2(s.y)}px,${r2(s.z)}px) rotateX(${r2(s.rx)}deg) rotateY(${r2(s.ry)}deg) rotateZ(${r2(s.rz)}deg) scale(${Math.round(s.s * 10000) / 10000})`;

class Aborted extends Error {}

export function mountTarot(root: HTMLElement, opts: TarotOptions): TarotHandle {
  const q = <T extends HTMLElement>(sel: string) => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`Tarot: missing ${sel}`);
    return el;
  };
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = RM ? 0.45 : 1;
  const sky = q<HTMLCanvasElement>(".tr-sky");
  const fxc = q<HTMLCanvasElement>(".tr-fx");
  const sx = sky.getContext("2d")!;
  const fx = fxc.getContext("2d")!;
  const stage = q<HTMLDivElement>(".tr-stage");
  const group = q<HTMLDivElement>(".tr-group");
  const R: Mover = { el: q<HTMLDivElement>(".tr-reveal"), st: S() };
  const RI = q<HTMLDivElement>(".tr-inner");
  const RD = q<HTMLDivElement>(".tr-drag");
  const halo: Mover = { el: q<HTMLDivElement>(".tr-halo"), st: S() };
  const haloIn = q<HTMLDivElement>(".tr-halo-in");
  const spot = q<HTMLDivElement>(".tr-spot");
  const photoImg = q<HTMLImageElement>(".tr-photo img");
  const initials = q<HTMLSpanElement>(".tr-initials");
  const nameEl = q<HTMLDivElement>(".tr-name");
  const panel = q<HTMLDivElement>(".tr-panel");
  const sheens = Array.from(root.querySelectorAll<HTMLElement>(".tr-gl, .tr-gr"));
  const scene = createCaravanScene(RM);

  let destroyed = false;
  let busy = false;
  let revealed = false;
  let known = opts.known;
  let W = 0, H = 0, DPR = 1;
  let SW = 0, SH = 0, SL = 0, ST = 0, CX = 0, CY = 0;
  let cw = 0, ch = 0, BW = 0, BH = 0, FY = 0;
  let gridY = 0;
  let slots: { x: number; y: number }[] = [];
  let pose = { x: 0, y: 0, s: 1 };
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  };

  root.style.setProperty("--tr-back", `url("${cardArt("back")}")`);
  root.style.setProperty("--tr-front", `url("${cardArt("front")}")`);

  /* ---------- motion helpers ---------- */
  function apply(m: Mover, s: Partial<St>) {
    m.st = S({ ...m.st, ...s });
    m.el.style.transform = tf(m.st);
    m.el.style.opacity = String(m.st.o);
  }
  function settle(m: Mover, end: St, a: Animation) {
    m.el.style.transform = tf(end);
    m.el.style.opacity = String(end.o);
    a.cancel();
  }
  function to(m: Mover, s: Partial<St>, dur: number, easing = "cubic-bezier(.22,1,.36,1)", delay = 0) {
    const from = m.st;
    const end = S({ ...from, ...s });
    m.st = end;
    const a = m.el.animate(
      [{ transform: tf(from), opacity: from.o }, { transform: tf(end), opacity: end.o }],
      { duration: Math.max(1, dur * SPEED), delay: delay * SPEED, easing, fill: "both" },
    );
    return a.finished.then(() => settle(m, end, a), () => {});
  }
  function along(m: Mover, fn: (t: number) => Partial<St>, dur: number, easing = "linear", delay = 0, n = 48) {
    const base = m.st;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= n; i++) {
      const s = S({ ...base, ...fn(i / n) });
      frames.push({ transform: tf(s), opacity: s.o });
    }
    const end = S({ ...base, ...fn(1) });
    m.st = end;
    const a = m.el.animate(frames, { duration: Math.max(1, dur * SPEED), delay: delay * SPEED, easing, fill: "both" });
    return a.finished.then(() => settle(m, end, a), () => {});
  }

  let idleAnim: Animation | null = null;
  function startIdle() {
    if (RM || idleAnim) return;
    idleAnim = group.animate(
      [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(0,-9px,0)" }, { transform: "translate3d(0,0,0)" }],
      { duration: 4200, iterations: Infinity, easing: "ease-in-out" },
    );
  }
  async function stopIdle() {
    if (!idleAnim) return;
    const cur = getComputedStyle(group).transform;
    idleAnim.cancel();
    idleAnim = null;
    const b = group.animate(
      [{ transform: cur === "none" ? "translate3d(0,0,0)" : cur }, { transform: "translate3d(0,0,0)" }],
      { duration: 420 * SPEED, easing: "cubic-bezier(.4,0,.2,1)" },
    );
    await b.finished.catch(() => {});
  }

  /* ---------- layout ---------- */
  function measure() {
    const rr = root.getBoundingClientRect();
    W = rr.width;
    H = rr.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [sky, fxc]) {
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
    }
    sx.setTransform(DPR, 0, 0, DPR, 0, 0);
    scene.resize(W, H, DPR);
    const sr = stage.getBoundingClientRect();
    SW = sr.width;
    SH = sr.height;
    SL = sr.left - rr.left;
    ST = sr.top - rr.top;
    CX = SL + SW / 2;
    CY = ST + SH / 2;
    cw = Math.round(clamp(Math.min(SW * 0.156, SH * 0.135), 46, 104));
    ch = Math.round(cw * CARD_RATIO);
    BW = Math.round(clamp(Math.min(SW * 0.666, (SH * 0.874) / CARD_RATIO), 146, 302));
    BH = Math.round(BW * CARD_RATIO);
    FY = -Math.round(BH * 0.02);
    root.style.setProperty("--tr-cw", `${cw}px`);
    root.style.setProperty("--tr-ch", `${ch}px`);
    root.style.setProperty("--tr-bw", `${BW}px`);
    root.style.setProperty("--tr-bh", `${BH}px`);
    root.style.setProperty("--tr-spot", `${Math.round(ch * 2)}px`);
    gridY = SH * 0.02;
    const gx = cw * 1.22;
    const gy = ch * 1.1;
    slots = [];
    [4, 5, 4].forEach((cnt, row) => {
      for (let c = 0; c < cnt; c++) slots.push({ x: (c - (cnt - 1) / 2) * gx, y: gridY + (row - 1) * gy });
    });
  }
  const proj = (x: number, y: number, z = 0) => {
    const k = PERSP / (PERSP - z);
    return { x: CX + x * k, y: CY + y * k, k };
  };

  /* ---------- deck ---------- */
  const cards: Card[] = [];
  for (let i = 0; i < DECK_SIZE; i++) {
    const el = document.createElement("div");
    el.className = "tr-card";
    group.appendChild(el);
    cards.push({ el, st: S(), cell: i });
  }
  let deck: Card[] = [...cards];

  function rest(anim: boolean) {
    return Promise.all(
      deck.map((c, j) => {
        const s = { x: 0, y: gridY - j * 0.8, z: j * 0.7, rx: 0, ry: 0, rz: (j % 3 - 1) * 1.6, s: 1, o: 1 };
        if (!anim) {
          apply(c, s);
          return null;
        }
        return to(c, s, 950, "cubic-bezier(.22,1,.36,1)", j * 38);
      }),
    );
  }

  /* ---------- the Draw animation (shell game) ---------- */
  let abort = false;
  const check = () => {
    if (abort || destroyed) throw new Aborted();
  };

  async function shuffle(): Promise<Card> {
    const n = deck.length;
    const L = -cw * 1.45;
    const Rx = cw * 1.45;
    await Promise.all(deck.map((c, j) => to(c, { x: L, y: gridY - j * 0.8, z: j * 0.7, rz: -6 }, 480, "cubic-bezier(.3,0,.2,1)", j * 6)));
    check();
    const cascade = async (toX: number, dur: number, gap: number, rz: number) => {
      const seq = [...deck].reverse();
      await Promise.all(
        seq.map((c, idx) => {
          const s0 = { ...c.st };
          return along(c, (t) => {
            const e = easeInOut(t);
            const b = Math.sin(Math.PI * t);
            return {
              x: lerp(s0.x, toX, e),
              y: lerp(s0.y, gridY - idx * 0.8, e) - b * ch * 1.0,
              z: lerp(s0.z, idx * 0.7, e) + b * 40,
              rz: lerp(s0.rz, rz, e) - b * rz * 3,
              rx: -b * 14,
            };
          }, dur, "linear", idx * gap, 28);
        }),
      );
      deck = seq;
    };
    await cascade(Rx, 560, 62, 6);
    check();
    await cascade(L, 440, 44, -6);
    check();
    await Promise.all(deck.map((c, j) => to(c, { x: 0, rz: 0, y: gridY - j * 0.8, z: j * 0.7 }, 420, "cubic-bezier(.3,0,.2,1)")));
    check();
    const dealOrder = [...deck].reverse();
    await Promise.all(
      dealOrder.map((c, i) => {
        c.cell = i;
        const s = slots[i]!;
        return to(c, { x: s.x, y: s.y, z: 12, rz: 360, rx: 0 }, 700, "cubic-bezier(.34,1.3,.64,1)", i * 75);
      }),
    );
    cards.forEach((c) => apply(c, { rz: 0 }));
    check();
    const move = (c: Card, a: { x: number; y: number }, b: { x: number; y: number }, side: number, d: number) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      return along(c, (t) => {
        const e = easeInOut(t);
        const qq = Math.sin(Math.PI * t);
        return {
          x: lerp(a.x, b.x, e) + px * side * qq * ch * 0.28,
          y: lerp(a.y, b.y, e) + py * side * qq * ch * 0.28,
          z: 12 + side * qq * 70,
          rz: -side * qq * 9,
          s: 1 + side * qq * 0.05,
        };
      }, d, "linear", 0, 30);
    };
    const rounds = 9;
    for (let r = 0; r < rounds; r++) {
      const d = lerp(600, 290, r / (rounds - 1));
      const idx = shuffled([...Array(n).keys()]);
      const pairs: [number, number][] = [[idx[0]!, idx[1]!], [idx[2]!, idx[3]!]];
      if (r > 3) pairs.push([idx[4]!, idx[5]!]);
      await Promise.all(
        pairs.flatMap(([a, b]) => {
          const A = cards[a]!;
          const B = cards[b]!;
          const sa = slots[A.cell]!;
          const sb = slots[B.cell]!;
          [A.cell, B.cell] = [B.cell, A.cell];
          return [move(A, sa, sb, 1, d), move(B, sb, sa, -1, d)];
        }),
      );
      check();
    }
    await Promise.all(cards.map((c) => to(c, { o: 0.5 }, 450, "ease-out")));
    const k = Math.floor(Math.random() * n);
    const chosen = cards.find((c) => c.cell === k)!;
    const path = shuffled([...Array(n).keys()].filter((i) => i !== k))
      .slice(0, 3)
      .concat([k])
      .map((i) => proj(slots[i]!.x, slots[i]!.y, 12));
    spot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 * SPEED, fill: "forwards" });
    const kf: Keyframe[] = path.map((p, i) => ({
      transform: `translate(${p.x}px,${p.y}px)`,
      offset: i / (path.length - 1),
      easing: "cubic-bezier(.45,0,.25,1)",
    }));
    await spot.animate(kf, { duration: 2400 * SPEED, fill: "forwards" }).finished.catch(() => {});
    spot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700 * SPEED, fill: "forwards" });
    check();
    await to(chosen, { o: 1, z: 40, s: 1.08 }, 520);
    deck = [...cards].sort((a, b) => a.cell - b.cell);
    return chosen;
  }

  /* ---------- particles ---------- */
  const parts: Particle[] = [];
  const spriteCache = new Map<string, HTMLCanvasElement>();
  function sprite(col: string) {
    let c = spriteCache.get(col);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const n = parseInt(col.slice(1), 16);
    const rgba = (a: number) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(1));
    gr.addColorStop(0.2, rgba(0.8));
    gr.addColorStop(0.5, rgba(0.2));
    gr.addColorStop(1, rgba(0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    spriteCache.set(col, c);
    return c;
  }
  function emit(p: Partial<Particle> & Pick<Particle, "x" | "y" | "max" | "size" | "color">) {
    parts.push({ vx: 0, vy: 0, g: 0, drag: 1, life: 0, grow: 0, a: 1, fin: 0.18, tw: 0, seed: Math.random() * TAU, ...p });
  }
  function sparkleBurst() {
    const p = proj(R.st.x, R.st.y, R.st.z);
    const hw = (BW / 2) * p.k * R.st.s;
    const hh = (BH / 2) * p.k * R.st.s;
    emit({ x: p.x, y: p.y, size: BW * 2.4 * p.k, max: 0.9, a: 0.32, color: "#fff3dc", fin: 0.08 });
    const cols = ["#ffffff", "#fff3d6", "#ecd9b2", "#dcc092"];
    const n = RM ? 20 : 90;
    for (let i = 0; i < n; i++) {
      let x: number, y: number;
      if (Math.random() < 0.5) {
        x = p.x + rand(-hw, hw);
        y = p.y + (Math.random() < 0.5 ? -hh : hh);
      } else {
        x = p.x + (Math.random() < 0.5 ? -hw : hw);
        y = p.y + rand(-hh, hh);
      }
      const ang = Math.atan2(y - p.y, x - p.x);
      const sp = rand(20, 110);
      emit({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - rand(10, 40), g: -18, drag: 0.985, max: rand(1.2, 2.6), size: rand(3, 8), a: rand(0.6, 1), color: cols[i % 4]!, tw: rand(8, 18), fin: 0.05 });
    }
  }

  /* ---------- drag to turn ---------- */
  const drag = { on: false, phase: "idle" as "idle" | "drag" | "coast" | "settle", ay: 0, ax: 0, vy: 0, vx: 0, lift: 1, target: 0, sx: 0, sy: 0, ay0: 0, ax0: 0, t0: 0, moved: 0, hist: [] as { t: number; ay: number; ax: number }[] };
  let lastTf = "";
  let lastL = -1;
  let lastR = -1;
  function applyDrag() {
    const t = `rotateX(${drag.ax.toFixed(2)}deg) rotateY(${drag.ay.toFixed(2)}deg) scale(${drag.lift.toFixed(4)})`;
    if (t !== lastTf) {
      RD.style.transform = t;
      lastTf = t;
    }
    const sn = Math.sin((drag.ay * Math.PI) / 180);
    const tilt = Math.min(0.25, Math.abs(drag.ax) / 90);
    const l = Math.round(Math.min(0.8, Math.max(0, sn) * 0.7 + tilt) * 100) / 100;
    const r = Math.round(Math.min(0.8, Math.max(0, -sn) * 0.7 + tilt) * 100) / 100;
    if (l !== lastL || r !== lastR) {
      for (const el of sheens) el.style.opacity = String(el.classList.contains("tr-gl") ? l : r);
      lastL = l;
      lastR = r;
    }
  }
  function resetDrag() {
    Object.assign(drag, { on: false, phase: "idle", ay: 0, ax: 0, vy: 0, vx: 0, lift: 1 });
    applyDrag();
  }
  const isDone = () => R.el.classList.contains("is-done");
  function onPointerDown(e: PointerEvent) {
    if (busy || !isDone()) return;
    e.preventDefault();
    try {
      R.el.setPointerCapture(e.pointerId);
    } catch {}
    const now = e.timeStamp || performance.now();
    Object.assign(drag, { on: true, phase: "drag", sx: e.clientX, sy: e.clientY, ay0: drag.ay, ax0: drag.ax, vy: 0, vx: 0, t0: now, moved: 0, hist: [{ t: now, ay: drag.ay, ax: drag.ax }] });
    R.el.classList.add("is-grabbing");
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag.on) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    const k = 180 / (BW * pose.s * 1.15);
    const now = e.timeStamp || performance.now();
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    drag.ay = drag.ay0 + dx * k;
    drag.ax = 28 * Math.tanh((drag.ax0 - dy * k * 0.8) / 28);
    drag.hist.push({ t: now, ay: drag.ay, ax: drag.ax });
    while (drag.hist.length > 2 && now - drag.hist[0]!.t > 70) drag.hist.shift();
  }
  function onPointerUp(e: Event) {
    if (!drag.on) return;
    drag.on = false;
    R.el.classList.remove("is-grabbing");
    const now = e.timeStamp || performance.now();
    if (drag.moved < 6 && now - drag.t0 < 450) {
      drag.target = Math.round(drag.ay / 360) * 360;
      drag.phase = "settle";
      draw();
      return;
    }
    const h = drag.hist[0]!;
    const lastT = drag.hist[drag.hist.length - 1]!.t;
    const dt = Math.max(16, now - h.t) / 1000;
    if (now - lastT > 80) {
      drag.vy = 0;
      drag.vx = 0;
    } else {
      drag.vy = clamp((drag.ay - h.ay) / dt, -2400, 2400);
      drag.vx = clamp((drag.ax - h.ax) / dt, -400, 400);
    }
    drag.phase = "coast";
  }
  function onKey(e: KeyboardEvent) {
    if (busy || !isDone()) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      drag.vy += (e.key === "ArrowLeft" ? -1 : 1) * 460;
      if (drag.phase !== "coast") drag.phase = "coast";
    }
  }
  function stepDrag(dt: number) {
    if (drag.phase === "idle") return;
    drag.lift += ((drag.on ? 1.03 : 1) - drag.lift) * (1 - Math.exp(-dt * 12));
    if (!drag.on) {
      drag.vx += (-90 * drag.ax - 17 * drag.vx) * dt;
      drag.ax += drag.vx * dt;
      if (drag.phase === "coast") {
        drag.ay += drag.vy * dt;
        drag.vy *= Math.exp(-dt * 1.9);
        if (Math.abs(drag.vy) < 150) {
          drag.target = Math.round((drag.ay + drag.vy * 0.25) / 360) * 360;
          drag.phase = "settle";
        }
      } else if (drag.phase === "settle") {
        drag.vy += (55 * (drag.target - drag.ay) - 12.5 * drag.vy) * dt;
        drag.ay += drag.vy * dt;
        if (Math.abs(drag.target - drag.ay) < 0.05 && Math.abs(drag.vy) < 0.5 && Math.abs(drag.ax) < 0.05 && Math.abs(drag.vx) < 0.5 && Math.abs(drag.lift - 1) < 0.001) {
          resetDrag();
        }
      }
    }
    applyDrag();
  }

  /* ---------- details panel placement ---------- */
  function computePose() {
    if (!revealed) return { x: 0, y: FY, s: 1 };
    const side = SW >= 860;
    panel.classList.toggle("is-side", side);
    panel.classList.toggle("is-bottom", !side);
    if (side) {
      const pw = Math.min(340, SW * 0.32);
      const gap = 36;
      const cardX = -(pw + gap) / 2;
      panel.style.width = `${pw}px`;
      panel.style.left = `${CX + cardX + BW / 2 + gap}px`;
      panel.style.top = `${CY + FY}px`;
      return { x: cardX, y: FY, s: 1 };
    }
    const pw = Math.min(420, SW - 32);
    panel.style.width = `${pw}px`;
    panel.style.left = `${CX - pw / 2}px`;
    const ph = panel.offsetHeight;
    const gap = 14;
    panel.style.top = `${ST + SH - ph}px`;
    const avail = SH - ph - gap;
    const s = Math.min(1, avail / BH);
    return { x: 0, y: -SH / 2 + avail / 2, s };
  }
  function placeRevealed(animated: boolean) {
    pose = computePose();
    const target = { x: pose.x, y: pose.y, s: pose.s };
    const haloTarget = { x: pose.x, y: pose.y, z: -60, s: pose.s };
    if (animated) {
      void to(R, target, 900, "cubic-bezier(.22,1,.36,1)");
      void to(halo, haloTarget, 900, "cubic-bezier(.22,1,.36,1)");
    } else {
      apply(R, target);
      apply(halo, haloTarget);
    }
  }

  /* ---------- the Reveal ---------- */
  function fillFront(p: TarotPerson) {
    nameEl.textContent = p.name;
    const letters = p.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
    initials.textContent = letters || "?";
    if (p.image) {
      photoImg.src = p.image;
      photoImg.hidden = false;
      initials.hidden = true;
    } else {
      photoImg.removeAttribute("src");
      photoImg.hidden = true;
      initials.hidden = false;
    }
  }

  async function reveal(card: Card, p: TarotPerson) {
    fillFront(p);
    R.el.classList.remove("is-done");
    RI.style.transform = "rotateY(0deg)";
    const st = card.st;
    const k = cw / BW;
    apply(R, { x: st.x, y: st.y, z: st.z, rx: wrapDeg(st.rx), ry: wrapDeg(st.ry), rz: wrapDeg(st.rz), s: st.s * k, o: st.o });
    apply(halo, { x: 0, y: FY, z: -60, s: 1 });
    R.el.style.visibility = "visible";
    card.el.style.visibility = "hidden";
    const dismissing = Promise.all(cards.filter((c) => c !== card).map((c, i) => to(c, { o: 0.14, z: c.st.z - 120, s: c.st.s * 0.94 }, 900, "cubic-bezier(.22,1,.36,1)", i * 22)));
    await to(R, { x: 0, y: FY + 8, z: 40, rx: 7, ry: -14, rz: -4, s: 0.9, o: 1 }, 1150);
    haloIn.animate([{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "scale(1)" }], { duration: 1500 * SPEED, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
    await to(R, { y: FY, z: 60, rx: 0, ry: 0, rz: 0, s: 1 }, 760, "cubic-bezier(.45,0,.25,1)");
    const base = { ...R.st };
    const flip = RI.animate(
      [
        { transform: "rotateY(0deg)", easing: "cubic-bezier(.55,0,.25,1)" },
        { transform: "rotateY(186deg)", offset: 0.8, easing: "cubic-bezier(.4,0,.4,1)" },
        { transform: "rotateY(180deg)" },
      ],
      { duration: 1350 * SPEED, fill: "forwards" },
    );
    void along(R, (t) => ({ z: base.z + Math.sin(Math.PI * t) * 110, y: base.y - Math.sin(Math.PI * t) * 8 }), 1350);
    later(sparkleBurst, 560 * SPEED);
    await flip.finished.catch(() => {});
    RI.style.transform = "rotateY(180deg)";
    flip.cancel();
    await to(R, { z: 0 }, 300, "ease-out");
    R.el.classList.add("is-done");
    await dismissing;
  }

  async function hideReveal() {
    haloIn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500 * SPEED, fill: "forwards" });
    await to(R, { o: 0, y: R.st.y + 30, s: R.st.s * 0.92 }, 520, "cubic-bezier(.4,0,.2,1)");
    R.el.classList.remove("is-done");
    R.el.style.visibility = "hidden";
    RI.style.transform = "rotateY(0deg)";
    resetDrag();
    cards.forEach((c) => (c.el.style.visibility = "visible"));
  }

  async function draw() {
    if (busy || destroyed) return;
    busy = true;
    abort = false;
    opts.onError("");
    root.classList.remove("is-ready");
    opts.onPhase("drawing");
    if (revealed) {
      revealed = false;
      await hideReveal();
      await rest(true);
    }
    opts.onAnnounce("Drawing your person");
    await stopIdle();

    let failure: string | null = null;
    const personP: Promise<TarotPerson | null> = known
      ? Promise.resolve(known)
      : opts.fetchPerson().then(
          (p) => {
            if (!p) {
              failure = "There's no person for you right now.";
              abort = true;
            }
            return p;
          },
          () => {
            failure = "Something went wrong. Please try again.";
            abort = true;
            return null;
          },
        );

    let chosen: Card | null = null;
    try {
      chosen = await shuffle();
    } catch (e) {
      if (!(e instanceof Aborted)) throw e;
    }
    const person = chosen ? await personP : null;
    if (destroyed) return;
    if (!chosen || !person) {
      spot.animate([{ opacity: 0 }], { duration: 300, fill: "forwards" });
      await rest(true);
      startIdle();
      busy = false;
      root.classList.add("is-ready");
      opts.onPhase("ready");
      opts.onError(failure ?? "Something went wrong. Please try again.");
      return;
    }
    known = person;
    await reveal(chosen, person);
    if (destroyed) return;
    revealed = true;
    busy = false;
    opts.onAnnounce(`You're the Secret Santa for ${person.name}.`);
    opts.onPhase("revealed");
    if (!RM) {
      later(() => {
        if (isDone() && drag.phase === "idle" && !drag.on) {
          drag.ay = 0;
          drag.vy = -230;
          drag.target = 0;
          drag.phase = "settle";
        }
      }, 1500);
    }
  }

  /* ---------- frame loop ---------- */
  let raf = 0;
  let last = performance.now();
  let fxClean = false;
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (!drag.on && drag.phase === "idle") scene.draw(sx, t, dt);
    stepDrag(dt);
    if (isDone() && !RM && drag.phase === "idle" && Math.random() < dt * 14) {
      const p = proj(R.st.x, R.st.y, R.st.z);
      const hw = (BW / 2) * p.k * R.st.s;
      emit({ x: p.x + rand(-hw * 1.1, hw * 1.1), y: p.y + (BH / 2) * p.k * R.st.s * rand(0.2, 0.9), vx: rand(-6, 6), vy: -rand(14, 34), max: rand(2.2, 3.6), size: rand(3, 6), a: rand(0.3, 0.6), color: "#fff4dc", tw: rand(5, 10), fin: 0.4 });
    }
    if (parts.length || !fxClean) {
      fxClean = !parts.length;
      fx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fx.clearRect(0, 0, W, H);
      fx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life += dt;
        if (p.life >= p.max) {
          parts.splice(i, 1);
          continue;
        }
        p.vy += p.g * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.max;
        let al = p.a * Math.min(1, p.life / p.fin) * (1 - k);
        if (p.tw) al *= 0.55 + 0.45 * Math.sin(p.life * p.tw + p.seed);
        const sz = p.size * (1 + p.grow * k);
        fx.globalAlpha = Math.max(0, al);
        fx.drawImage(sprite(p.color), p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      fx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- wiring ---------- */
  function onDeckClick() {
    if (!busy && !revealed) void draw();
  }
  let resizeTimer = 0;
  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (destroyed) return;
      measure();
      if (busy) return;
      if (revealed) placeRevealed(false);
      else void rest(false);
    }, 160);
  }

  /**
   * Put the revealed card back to its hidden starting state. Next.js keeps a
   * left page alive but hidden (React Activity) and re-runs effects when it
   * comes back, so the DOM can still hold a previous Reveal's inline styles;
   * without this, the old card stays on screen above a fresh deck.
   */
  function resetRevealDom() {
    R.el.classList.remove("is-done", "is-grabbing");
    R.el.style.visibility = "hidden";
    R.el.style.transform = "";
    R.el.style.opacity = "";
    RI.style.transform = "rotateY(0deg)";
    RD.style.transform = "";
    haloIn.style.opacity = "";
    spot.style.opacity = "";
  }

  resetRevealDom();
  measure();
  void rest(false);
  apply(halo, { x: 0, y: FY, z: -60 });
  startIdle();
  root.classList.add("is-ready");
  group.addEventListener("click", onDeckClick);
  R.el.addEventListener("pointerdown", onPointerDown);
  R.el.addEventListener("pointermove", onPointerMove);
  R.el.addEventListener("pointerup", onPointerUp);
  R.el.addEventListener("pointercancel", onPointerUp);
  R.el.addEventListener("lostpointercapture", onPointerUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  raf = requestAnimationFrame(frame);

  return {
    draw: () => void draw(),
    layoutPanel: () => {
      if (revealed && !destroyed) placeRevealed(true);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(resizeTimer);
      idleAnim?.cancel();
      group.removeEventListener("click", onDeckClick);
      R.el.removeEventListener("pointerdown", onPointerDown);
      R.el.removeEventListener("pointermove", onPointerMove);
      R.el.removeEventListener("pointerup", onPointerUp);
      R.el.removeEventListener("pointercancel", onPointerUp);
      R.el.removeEventListener("lostpointercapture", onPointerUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      for (const el of root.querySelectorAll("*")) el.getAnimations().forEach((a) => a.cancel());
      cards.forEach((c) => c.el.remove());
      resetRevealDom();
    },
  };
}
