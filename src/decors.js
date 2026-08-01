/**
 * decors.js — Charge les décors 3D (créés dans l'atelier) et les pose dans le monde.
 *
 * Lit le fichier `decors.json` (l'export de l'atelier). Pour chaque objet :
 *   - le décode et le place à sa position (x,z en mètres, repère V2 centré) ;
 *   - le met à la bonne hauteur (altitude du terrain + décalage éventuel) ;
 *   - applique son échelle et sa rotation ;
 *   - construit sa collision selon le mode choisi dans l'atelier.
 *
 * La collision est représentée par des « empreintes » : des rectangles au sol (plan XZ)
 * que le joueur ne peut pas traverser. Un collider sur-mesure à plusieurs pièces donne
 * une empreinte par pièce (les formes creuses, comme une arche, restent franchissables).
 */
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

const loader = new GLTFLoader();

/** base64 → ArrayBuffer */
function base64VersBuffer(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

/** Décode un .glb (ArrayBuffer) → scène THREE. */
function parseGlb(buf) {
  return new Promise((res, rej) => loader.parse(buf, '', (g) => res(g.scene), rej));
}

const deg = (d) => (d || 0) * Math.PI / 180;

/** Applique la transformation (position, échelle, rotation) d'un décor à un objet 3D. */
function poser(obj, x, y, z, scale, rotDeg, tiltDeg) {
  obj.position.set(x, y, z);
  obj.scale.set(scale, scale, scale);
  obj.rotation.order = 'YXZ';
  obj.rotation.y = deg(rotDeg);
  obj.rotation.x = deg(tiltDeg);
}

/** Empreinte au sol (rectangle XZ) de la boîte englobante monde d'un objet. */
function empreinte(objet3d) {
  const bb = new THREE.Box3().setFromObject(objet3d);
  return { minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z };
}

/**
 * Charge les décors et les ajoute à la scène.
 * @param {THREE.Scene} scene
 * @param {import('./carte.js').Carte} carte
 * @returns {Promise<Array<{minX,maxX,minZ,maxZ}>>} les empreintes de collision
 */
export async function chargerDecors(scene, carte) {
  let data;
  try {
    const r = await fetch('./decors.json', { cache: 'no-cache' });
    if (!r.ok) return [];               // pas de décors : normal
    data = await r.json();
  } catch (e) { return []; }
  if (!data || !Array.isArray(data.decors)) return [];

  const empreintes = [];

  for (const d of data.decors) {
    if (!d.glb || !d.at) continue;
    let objet;
    try { objet = await parseGlb(base64VersBuffer(d.glb)); } catch (e) { continue; }

    const x = d.at[0], z = d.at[1];
    const y = carte.altitudeAt(x, z) + (d.yOffset || 0);
    const s = d.scale || 1;
    poser(objet, x, y, z, s, d.rotDeg, d.tiltDeg);
    scene.add(objet);
    objet.updateMatrixWorld(true);

    // ——— collision ———
    const col = d.collider || { mode: 'auto' };
    if (col.mode === 'traversable') {
      // rien : on passe à travers
    } else if (col.mode === 'sur-mesure' && col.glb) {
      let coll;
      try { coll = await parseGlb(base64VersBuffer(col.glb)); } catch (e) { coll = null; }
      if (coll) {
        // le collider suit ses réglages (dans le repère de l'objet), puis la transfo de l'objet
        const cp = col.pos || [0, 0, 0], csz = col.scale || [1, 1, 1];
        coll.position.set(cp[0], cp[1], cp[2]);
        coll.scale.set(csz[0], csz[1], csz[2]);
        coll.rotation.order = 'YXZ';
        coll.rotation.y = deg(col.rotDeg);
        coll.rotation.x = deg(col.tiltDeg);
        const grp = new THREE.Group();
        grp.add(coll);
        poser(grp, x, y, z, s, d.rotDeg, d.tiltDeg);
        scene.add(grp);
        grp.updateMatrixWorld(true);
        // une empreinte par pièce (formes creuses préservées)
        coll.traverse((n) => { if (n.isMesh) empreintes.push(empreinte(n)); });
        scene.remove(grp);           // le collider ne s'affiche pas
      }
    } else {
      // auto : boîte englobante de l'objet
      empreintes.push(empreinte(objet));
    }
  }

  return empreintes;
}
