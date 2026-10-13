// Confettis et éclats lors des révélations (bibliothèque canvas-confetti).
import confettiLib from 'canvas-confetti';
import { RARITY, SHINY_COLORS } from './visuals.jsx';

const base = { disableForReducedMotion: true };

// Notre propre canvas, sans worker (la politique de sécurité n'autorise pas les workers blob:).
let instance = null;
function confetti(opts) {
  if (!instance) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90';
    document.body.append(canvas);
    instance = confettiLib.create(canvas, { resize: true, useWorker: false });
  }
  return instance(opts);
}

const paletteOf = (rarity, shiny) =>
  shiny ? SHINY_COLORS : [RARITY[rarity].color, RARITY[rarity].glow, '#ffffff'];

function origin(rect) {
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

// Éclat proportionné à la rareté, centré sur la carte révélée.
export function burstFor(rect, rarity, shiny = false) {
  const colors = paletteOf(rarity, shiny);
  const count = [0, 22, 45, 80, 130, 200][rarity] + (shiny ? 80 : 0);
  if (!count) return;
  confetti({
    ...base,
    particleCount: count,
    spread: 70 + rarity * 18,
    startVelocity: 22 + rarity * 6,
    origin: origin(rect),
    colors,
    shapes: rarity >= 3 || shiny ? ['star', 'circle'] : ['circle'],
    scalar: rarity >= 4 ? 1.1 : 0.9,
    ticks: 160 + rarity * 30,
    gravity: 0.9,
  });
}

// Pluie dorée sur tout l'écran pour une Légendaire (ou arc-en-ciel pour un Shiny).
export function celebrate(rarity, shiny = false) {
  const colors = paletteOf(rarity, shiny);
  const end = Date.now() + (rarity >= 5 ? 1600 : 900);
  (function frame() {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, shapes: ['square', 'star'] });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, shapes: ['square', 'star'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
