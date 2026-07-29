/**
 * renderer.js — Met en place le décor technique : scène, caméra, lumières,
 * ciel/brouillard, moteur de rendu WebGL, et le redimensionnement de la fenêtre.
 */
import * as THREE from '../lib/three.module.js';
import { RENDU } from './config.js';

/**
 * @param {HTMLElement} conteneur  élément où insérer le <canvas>
 * @returns {{scene:THREE.Scene, camera:THREE.PerspectiveCamera, renderer:THREE.WebGLRenderer}}
 */
export function creerRendu(conteneur) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(RENDU.COULEUR_CIEL);
  // Brouillard : commence à 40 % de la distance de vue et sature à 100 %.
  scene.fog = new THREE.Fog(RENDU.COULEUR_CIEL, RENDU.DISTANCE_VUE_M * 0.4, RENDU.DISTANCE_VUE_M);

  const camera = new THREE.PerspectiveCamera(
    RENDU.FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    RENDU.DISTANCE_VUE_M * 2,
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  conteneur.appendChild(renderer.domElement);

  // Éclairage : lumière ciel/sol douce + un « soleil » directionnel.
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x69795a, 1.0));
  const soleil = new THREE.DirectionalLight(0xfff3e0, 1.7);
  soleil.position.set(120, 220, 90);
  scene.add(soleil);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}
