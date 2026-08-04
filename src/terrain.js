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
 * @param {{grass:THREE.Texture,gravel:THREE.Texture,mask:THREE.Texture,repeat:number}} [sol]
 *   habillage des zones (herbe/gravier répétés + masque) ; si absent, satellite seul.
 * @returns {THREE.Mesh} le sol, prêt à être ajouté à la scène
 */
export function construireTerrain(carte, sol) {
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

  // Satellite drapé (flipY=false : 1re ligne de l'image = nord = v=0, comme altitudeAt).
  const satellite = new THREE.Texture(carte.satellite);
  satellite.colorSpace = THREE.SRGBColorSpace;
  satellite.flipY = false;
  satellite.anisotropy = 4;
  satellite.needsUpdate = true;

  const materiau = new THREE.MeshStandardMaterial({ map: satellite, roughness: 1, metalness: 0 });

  // Habillage des zones : dans le rendu, on remplace le satellite par de l'herbe / du
  // gravier RÉPÉTÉS (détail net de près) là où le masque l'indique (rouge=herbe, vert=gravier).
  if (sol) {
    materiau.onBeforeCompile = (shader) => {
      shader.uniforms.uGrass = { value: sol.grass };
      shader.uniforms.uGravel = { value: sol.gravel };
      shader.uniforms.uMask = { value: sol.mask };
      shader.uniforms.uRepeat = { value: sol.repeat };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>',
          '#include <common>\nuniform sampler2D uGrass;\nuniform sampler2D uGravel;\nuniform sampler2D uMask;\nuniform float uRepeat;')
        .replace('#include <map_fragment>',
          '#include <map_fragment>\n{'
          + ' vec4 mk = texture2D(uMask, vMapUv);'
          + ' vec3 herbe = pow(texture2D(uGrass, vMapUv * uRepeat).rgb, vec3(2.2));'
          + ' vec3 grav = pow(texture2D(uGravel, vMapUv * uRepeat).rgb, vec3(2.2));'
          + ' diffuseColor.rgb = mix(diffuseColor.rgb, herbe, clamp(mk.r, 0.0, 1.0));'
          + ' diffuseColor.rgb = mix(diffuseColor.rgb, grav, clamp(mk.g, 0.0, 1.0));'
          + ' }');
    };
    materiau.customProgramCacheKey = () => 'sol-zones';
  }

  const mesh = new THREE.Mesh(geo, materiau);
  mesh.name = 'terrain';
  return mesh;
}
