// Particules, confettis et éclairs, dessinés sur un canvas plein écran.
import { reducedMotion } from './ui.js';

const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
let particles = [];
let running = false;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
resize();
addEventListener('resize', resize);

function loop() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const now = performance.now();
  particles = particles.filter((p) => now - p.born < p.life);
  for (const p of particles) {
    const t = (now - p.born) / p.life;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else if (p.kind === 'star') {
      const s = p.size * (1 - t * 0.6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.28 : s;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (particles.length) requestAnimationFrame(loop);
  else {
    running = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

function add(list) {
  if (reducedMotion()) return;
  const born = performance.now();
  for (const p of list) particles.push({ born, drag: 0.97, gravity: 0.12, rot: 0, vr: 0, ...p });
  if (particles.length > 900) particles = particles.slice(-900);
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function burst(x, y, { colors = ['#fff'], count = 40, speed = 9, size = 3.2, life = 1100, stars = 0.3 } = {}) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.75);
    const star = Math.random() < stars;
    list.push({
      kind: star ? 'star' : 'dot',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1.5,
      size: star ? size * 2.4 : size * (0.5 + Math.random()),
      color: pick(colors),
      life: life * (0.6 + Math.random() * 0.6),
      gravity: 0.08,
      vr: (Math.random() - 0.5) * 0.3,
    });
  }
  add(list);
}

export function confetti({ colors, count = 160 } = {}) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      kind: 'confetti',
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 3,
      size: 7 + Math.random() * 7,
      color: pick(colors),
      life: 3200 + Math.random() * 1600,
      gravity: 0.05,
      drag: 0.99,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.25,
    });
  }
  add(list);
}

export function sparkleAround(rect, { colors, count = 18 } = {}) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const side = Math.random();
    const x = rect.left + Math.random() * rect.width;
    const y = side < 0.5 ? rect.top + Math.random() * 20 : rect.bottom - Math.random() * 20;
    list.push({ kind: 'star', x, y, vx: (Math.random() - 0.5) * 1.2, vy: -0.6 - Math.random(), size: 4 + Math.random() * 4, color: pick(colors), life: 900 + Math.random() * 700, gravity: -0.01 });
  }
  add(list);
}

export function flash(color = '#fff') {
  if (reducedMotion()) return;
  const f = document.createElement('div');
  f.className = 'flash';
  f.style.setProperty('--c', color);
  document.body.append(f);
  f.addEventListener('animationend', () => f.remove(), { once: true });
}

export function shake(target, strength = 6, duration = 420) {
  if (reducedMotion() || !target) return Promise.resolve();
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const s = strength * (1 - i / 8);
    frames.push({ transform: `translate(${(Math.random() - 0.5) * s * 2}px, ${(Math.random() - 0.5) * s * 2}px)` });
  }
  frames.push({ transform: 'none' });
  return target.animate(frames, { duration, easing: 'linear' }).finished.catch(() => {});
}
