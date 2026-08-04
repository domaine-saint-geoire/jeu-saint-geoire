/**
 * murs.js — Construit les murs à partir des tracés de la carte peinte.
 *
 * Chaque mur = un TRACÉ (suite de points, en mètres) + un TYPE de mur nommé
 * (un module .glb d'1 m). Plusieurs types de mur peuvent coexister (« mur du pré est »,
 * « haie », …) ; chaque tracé référence son type.
 *
 * Le module est répété tout le long du tracé, et surtout : il **suit la pente**.
 * Pour chaque petit tronçon, on prend la hauteur du sol au début et à la fin, et on
 * incline le module en conséquence — le mur descend/monte « en pente », pas en escalier,
 * et sa base touche le sol. Un mur bloque le passage (empreintes de collision).
 *
 * Données (depuis `monde/carte.json`, produit par l'atelier de peinture) :
 *   { murTypes: [{ id, nom, module }], murs: [{ typeMur, points:[[x,z]…] }] }
 *   (compat : ancien format { murModule, murs:[{ points }] } encore accepté)
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
    if (!r.ok) return [];
    data = await r.json();
  } catch (e) { return []; }
  const murs = data && Array.isArray(data.murs) ? data.murs : [];
  if (!murs.length) return [];

  // Catalogue des modules : par id de type (nouveau) + repli sur l'ancien module unique.
  const parId = {};
  (data.murTypes || []).forEach((t) => { if (t && t.id) parId[t.id] = t.module; });

  const empreintes = [];
  const cache = new Map();                     // base64 → { modele, longueur }
  async function charger(b64) {
    if (!b64) return null;
    if (cache.has(b64)) return cache.get(b64);
    let modele = null, longueur = 1;
    try {
      modele = await parseGlb(b64VersBuffer(b64));
      const bb = new THREE.Box3().setFromObject(modele);
      longueur = Math.max(0.1, bb.max.x - bb.min.x);   // longueur du module = son étendue en X
    } catch (e) { modele = null; }
    const r = { modele, longueur }; cache.set(b64, r); return r;
  }

  const up = new THREE.Vector3(0, 1, 0);
  const xA = new THREE.Vector3(), yA = new THREE.Vector3(), zA = new THREE.Vector3(), base = new THREE.Matrix4();

  for (const mur of murs) {
    const b64 = (mur.typeMur && parId[mur.typeMur]) || mur.module || data.murModule;
    const pts = mur.points || mur.pts;
    if (!b64 || !pts || pts.length < 2) continue;
    const { modele, longueur } = await charger(b64);
    if (!modele) continue;

    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const seg = Math.hypot(dx, dz);
      if (seg < 1e-3) continue;
      const ux = dx / seg, uz = dz / seg;
      const nb = Math.max(1, Math.round(seg / longueur));
      const pas = seg / nb;                    // longueur horizontale d'un module sur ce segment

      for (let k = 0; k < nb; k++) {
        const sx = ax + ux * (k * pas), sz = az + uz * (k * pas);           // début du tronçon
        const ex = ax + ux * ((k + 1) * pas), ez = az + uz * ((k + 1) * pas); // fin du tronçon
        const h0 = carte.altitudeAt(sx, sz), h1 = carte.altitudeAt(ex, ez);
        const slot = Math.hypot(pas, h1 - h0);                              // longueur réelle (en pente)

        // Orientation : l'axe X du module suit la direction 3D (avec la pente) ;
        // l'axe Y (le haut du mur) s'incline avec la pente → mur « en pente », pas en escalier.
        xA.set(ex - sx, h1 - h0, ez - sz).normalize();
        zA.crossVectors(xA, up).normalize();
        yA.crossVectors(zA, xA).normalize();
        base.makeBasis(xA, yA, zA);

        const inst = modele.clone();
        inst.quaternion.setFromRotationMatrix(base);
        inst.position.set((sx + ex) / 2, (h0 + h1) / 2, (sz + ez) / 2);     // base posée au sol
        inst.scale.set(slot / longueur, 1, 1);                              // remplit pile le tronçon
        scene.add(inst);
        inst.updateMatrixWorld(true);
        empreintes.push(empreinteDe(inst));
      }
    }
  }
  return empreintes;
}
