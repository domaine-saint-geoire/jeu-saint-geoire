/**
 * terrain.js — Construit le maillage 3D du sol à partir de la Carte, puis y
 * drape l'image satellite comme texture.
 *
 * Le relief vient du canal Rouge (via carte.altitudeAt). Les coordonnées de
 * texture (UV) sont calculées EXACTEMENT comme l'échantillonnage des altitudes,
 * pour que l'image satellite et le relief soient parfaitement alignés.
 */
import * as THREE from '../lib/three.module.js';
import { MONDE } from './config.js';

/**
 * @param {import('./carte.js').Carte} carte
 * @param {THREE.Texture} [textureSol]  texture du sol déjà préparée (satellite + zones peintes) ;
 *   si absente, on drape simplement le satellite.
 * @returns {THREE.Mesh} le sol, prêt à être ajouté à la scène
 */
export function construireTerrain(carte, textureSol) {
  const taille = carte.tailleM;
  const seg = MONDE.SUBDIVISIONS;

  // Plan subdivisé, créé dans le plan XY puis basculé à l'horizontale (plan XZ, Y = hauteur).
  const geo = new THREE.PlaneGeometry(taille, taille, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Hauteur du sol à ce sommet.
    pos.setY(i, carte.altitudeAt(x, z));
    // UV alignées sur la même convention que altitudeAt : u = ouest→est, v = nord→sud.
    uv.setXY(i, x / taille + 0.5, z / taille + 0.5);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals(); // normales correctes → éclairage des pentes réaliste

  // Texture du sol : soit celle préparée (satellite + zones peintes), soit le satellite seul.
  // flipY=false pour que la 1re ligne de l'image (le nord) corresponde à v=0, comme dans altitudeAt.
  let texture = textureSol;
  if (!texture) {
    texture = new THREE.Texture(carte.satellite);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }

  const materiau = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, materiau);
  mesh.name = 'terrain';
  return mesh;
}
