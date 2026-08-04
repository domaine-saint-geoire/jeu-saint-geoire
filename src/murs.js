/**
 * murs.js — Construit les murs à partir des tracés de la carte peinte.
 *
 * Chaque mur = un TRACÉ (suite de points, en mètres) + un MODULE .glb d'1 m.
 * Le jeu répète le module tout le long du tracé, orienté dans le sens du mur et
 * posé à la hauteur du terrain (il monte/descend avec les pentes). Un mur bloque
 * le passage (empreintes de collision, comme les décors).
 *
 * Les données viennent du fichier de la carte (`monde/carte.json`, produit par
 * l'atelier de peinture) : { murModule?, murs: [{ points:[[x,z]…], module? }] }.
 */
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

const loader = new GLTFLoader();

function b64VersBuffer(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function parseGlb(buf) { return new Promise((res, rej) => loader.parse(buf, '', (g) => res(g.scene), rej)); }
function empreinteDe(obj) {
  const bb = new THREE.Box3().setFromObject(obj);
  return { minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z };
}

/**
 * @param {THREE.Scene} scene
 * @param {import('./carte.js').Carte} carte
 * @returns {Promise<Array<{minX,maxX,minZ,maxZ}>>} empreintes de collision des murs
 */
export async function chargerMurs(scene, carte) {
  let data;
  try {
    const r = await fetch('./monde/carte.json', { cache: 'no-cache' });
    if (!r.ok) return [];                 // pas de carte peinte : normal
    data = await r.json();
  } catch (e) { return []; }
  const murs = data && Array.isArray(data.murs) ? data.murs : [];
  if (!murs.length) return [];

  const empreintes = [];
  const cache = new Map();                 // base64 → { modele, longueur }
  async function charger(b64) {
    if (cache.has(b64)) return cache.get(b64);
    let modele = null, longueur = 1;
    try {
      modele = await parseGlb(b64VersBuffer(b64));
      const bb = new THREE.Box3().setFromObject(modele);
      longueur = Math.max(0.1, bb.max.x - bb.min.x);   // longueur du module = son étendue en X
    } catch (e) { modele = null; }
    const r = { modele, longueur }; cache.set(b64, r); return r;
  }

  for (const mur of murs) {
    const b64 = mur.module || data.murModule;
    const pts = mur.points || mur.pts;
    if (!b64 || !pts || pts.length < 2) continue;
    const { modele, longueur } = await charger(b64);
    if (!modele) continue;

    // Chaque segment du tracé est rempli de modules bout à bout.
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const seg = Math.hypot(dx, dz);
      if (seg < 1e-3) continue;
      const ux = dx / seg, uz = dz / seg;
      const yaw = Math.atan2(-uz, ux);                 // aligne l'axe X du module sur le segment
      const nb = Math.max(1, Math.round(seg / longueur));
      const pas = seg / nb;                            // légèrement étiré pour remplir pile le segment
      for (let k = 0; k < nb; k++) {
        const d = (k + 0.5) * pas;
        const cx = ax + ux * d, cz = az + uz * d;
        const inst = modele.clone();
        inst.position.set(cx, carte.altitudeAt(cx, cz), cz);
        inst.rotation.order = 'YXZ';
        inst.rotation.y = yaw;
        inst.scale.set(pas / longueur, 1, 1);          // pas de trou entre modules
        scene.add(inst);
        inst.updateMatrixWorld(true);
        empreintes.push(empreinteDe(inst));
      }
    }
  }
  return empreintes;
}
