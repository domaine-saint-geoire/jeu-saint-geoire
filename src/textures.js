/**
 * textures.js — Habillage du sol : peint les ZONES de la carte (herbe / gravier)
 * par-dessus l'image satellite, en respectant les zones dessinées dans l'atelier.
 *
 * Principe : on fabrique UNE grande image du sol = satellite + textures répétées
 * dans les polygones de zones (herbe sur les zones d'herbe, gravier sur le gravier).
 * Cette image sert de texture au terrain (à la place du satellite seul).
 *
 * Les textures d'herbe et de gravier sont générées « à la volée » (procédurales,
 * sans couture), d'après les rendus fournis (« Realistic Seamless Grass / Gravel »).
 */
import * as THREE from '../lib/three.module.js';

const T = 250; // côté du monde en mètres (repère V2)

/** Génère un canvas de texture répétable ('herbe' ou 'gravier'). */
export function genererCanvas(kind) {
  const size = 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  let base, colors, count, rmin, rmax;
  if (kind === 'gravier') {
    base = '#5c544d';
    colors = ['#8b8580', '#a19a95', '#6b6560', '#b5aea9', '#78726d', '#524d4a', '#ccc3bd'];
    count = 8000; rmin = 3; rmax = 12;
  } else { // herbe
    base = '#221a0f';
    colors = ['#1d2e11', '#263d16', '#314e1c', '#3c5a20', '#4d7529', '#15250c'];
    count = 15000; rmin = 2; rmax = 8;
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
    // Copies aux bords → texture sans couture (répétable).
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

/**
 * Fabrique la texture du sol (satellite + zones peintes). Retourne null s'il n'y a
 * pas de carte peinte (le jeu garde alors le satellite seul).
 * @param {import('./carte.js').Carte} carte
 * @returns {Promise<THREE.CanvasTexture|null>}
 */
export async function texturerSol(carte) {
  let data;
  try { const r = await fetch('./monde/carte.json', { cache: 'no-cache' }); if (r.ok) data = await r.json(); } catch (e) {}
  const zones = (data && Array.isArray(data.zones)) ? data.zones : [];
  if (!zones.length) return null;
  const types = (data && data.types) || [];

  const W = 2048, H = 2048;
  const bake = document.createElement('canvas'); bake.width = W; bake.height = H;
  const bx = bake.getContext('2d');
  bx.drawImage(carte.satellite, 0, 0, W, H);         // fond = satellite

  const tuilePx = (7 / T) * W;                        // une tuile de texture ≈ 7 m
  const motif = (cv) => {
    const p = bx.createPattern(cv, 'repeat');
    const m = new DOMMatrix(); const s = tuilePx / cv.width; m.a = s; m.d = s;
    p.setTransform(m); return p;
  };
  const pats = {};
  for (const z of zones) {
    const sol = solPourType(types, z.type); if (!sol) continue;
    if (!pats[sol]) pats[sol] = motif(genererCanvas(sol));
    bx.save(); bx.beginPath();
    z.pts.forEach((p, i) => { const px = (p[0] / T + 0.5) * W, py = (p[1] / T + 0.5) * H; i ? bx.lineTo(px, py) : bx.moveTo(px, py); });
    bx.closePath(); bx.clip();
    bx.fillStyle = pats[sol]; bx.fillRect(0, 0, W, H);
    bx.restore();
  }

  const tex = new THREE.CanvasTexture(bake);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}
