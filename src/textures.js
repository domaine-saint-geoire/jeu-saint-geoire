/**
 * textures.js — Habillage du sol : herbe / gravier détaillés dans les zones peintes.
 *
 * Pour qu'on voie bien les touffes / cailloux DE PRÈS, on ne « bake » plus une image
 * aplatie : on répète les textures d'herbe et de gravier à haute fréquence directement
 * sur le sol (elles se répètent tous les ~3 m), et un « masque » indique où est chaque
 * zone. Le mélange satellite / herbe / gravier se fait dans le rendu (shader du terrain).
 *
 * Résultat : détail net au ras du sol, tout en gardant le satellite ailleurs.
 */
import * as THREE from '../lib/three.module.js';

const T = 250; // côté du monde en mètres (repère V2)

/** Génère un canvas de texture répétable ('herbe' ou 'gravier') — touffes / cailloux. */
export function genererCanvas(kind) {
  const size = 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  let base, colors, count, rmin, rmax;
  if (kind === 'gravier') {
    base = '#5c544d';
    colors = ['#8b8580', '#a19a95', '#6b6560', '#b5aea9', '#78726d', '#524d4a', '#ccc3bd'];
    count = 9000; rmin = 3; rmax = 12;
  } else { // herbe
    base = '#221a0f';
    colors = ['#1d2e11', '#263d16', '#314e1c', '#3c5a20', '#4d7529', '#5a8a30', '#15250c'];
    count = 20000; rmin = 2; rmax = 8;
  }
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const blob = (px, py, verts, col) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px + verts[0].x, py + verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(px + verts[i].x, py + verts[i].y);
    ctx.closePath(); ctx.fill();
  };
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const radius = rmin + Math.random() * (rmax - rmin);
    const steps = 4 + Math.floor(Math.random() * 4);
    const col = colors[Math.floor(Math.random() * colors.length)];
    const verts = [];
    for (let j = 0; j <= steps; j++) { const a = (j / steps) * Math.PI * 2, r = radius * (0.75 + Math.random() * 0.35); verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
    const xo = [0]; if (x - radius < 0) xo.push(size); if (x + radius > size) xo.push(-size);
    const yo = [0]; if (y - radius < 0) yo.push(size); if (y + radius > size) yo.push(-size);
    for (const dx of xo) for (const dy of yo) blob(x + dx, y + dy, verts, col);
  }
  return cv;
}

/** À quel sol correspond un type de zone ? → 'herbe' | 'gravier' | null. */
function solPourType(types, id) {
  const t = types.find((t) => t.id === id);
  const n = ((t && t.nom) || id || '').toLowerCase();
  if (id === 'gravier' || n.includes('gravier') || n.includes('gravel')) return 'gravier';
  if (id === 'pre' || id === 'sousbois' || n.includes('herbe') || n.includes('pré') || n.includes('pre') || n.includes('sous-bois') || n.includes('champ')) return 'herbe';
  return null;
}

/** Masque des zones : rouge = herbe, vert = gravier (aligné sur le satellite). */
function genererMasque(zones, types) {
  const W = 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, W);
  for (const z of zones) {
    const sol = solPourType(types, z.type); if (!sol) continue;
    ctx.fillStyle = sol === 'herbe' ? '#ff0000' : '#00ff00';
    ctx.beginPath();
    z.pts.forEach((p, i) => { const px = (p[0] / T + 0.5) * W, py = (p[1] / T + 0.5) * W; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.closePath(); ctx.fill();
  }
  return cv;
}

/**
 * Prépare l'habillage du sol. Retourne { grass, gravel, mask, repeat } (textures THREE)
 * ou null s'il n'y a pas de carte peinte.
 * @param {import('./carte.js').Carte} carte
 */
export async function preparerSol(carte) {
  let data;
  try { const r = await fetch('./monde/carte.json', { cache: 'no-cache' }); if (r.ok) data = await r.json(); } catch (e) {}
  const zones = (data && Array.isArray(data.zones)) ? data.zones : [];
  if (!zones.length) return null;
  const types = (data && data.types) || [];

  const grass = new THREE.CanvasTexture(genererCanvas('herbe'));
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.colorSpace = THREE.SRGBColorSpace; grass.anisotropy = 4;
  const gravel = new THREE.CanvasTexture(genererCanvas('gravier'));
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping; gravel.colorSpace = THREE.SRGBColorSpace; gravel.anisotropy = 4;
  const mask = new THREE.CanvasTexture(genererMasque(zones, types));
  mask.colorSpace = THREE.NoColorSpace; mask.flipY = false; mask.minFilter = THREE.LinearFilter; mask.magFilter = THREE.LinearFilter;

  const tuileM = 3;                 // une répétition d'herbe/gravier tous les ~3 m
  return { grass, gravel, mask, repeat: T / tuileM };
}
