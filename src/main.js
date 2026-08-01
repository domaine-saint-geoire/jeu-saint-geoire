/**
 * main.js — Point d'entrée du jeu. Enchaînement :
 *
 *   chargement de la carte  →  MENU  →  mode choisi  →  partie (boucle de rendu)
 *
 * Modes : « solo » (tout seul) ou « multi » (multijoueur, via le serveur).
 * La boîte à idées est disponible dès le menu.
 *
 * Le jeu DOIT être servi par un serveur (http) — pas ouvert en fichier local —
 * car il lit les pixels de l'image de données.
 */
import * as THREE from '../lib/three.module.js';
import { Carte } from './carte.js';
import { construireTerrain } from './terrain.js';
import { creerRendu } from './renderer.js';
import { Controls } from './controls.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Menu } from './menu.js';
import { Net } from './net.js';
import { installerBoiteAIdees } from './ideas.js';
import { chargerDecors } from './decors.js';

async function demarrer() {
  const ui = new UI();
  const { scene, camera, renderer } = creerRendu(document.getElementById('jeu'));

  // Carte (2 images) + terrain.
  const carte = await Carte.charger();
  scene.add(construireTerrain(carte));

  // Décors créés dans l'atelier (objets + collisions). Vide si pas de fichier decors.json.
  const empreintesDecors = await chargerDecors(scene, carte);

  // État de la partie.
  let pseudo = 'Anonyme';
  let player = null, controls = null, net = null, enJeu = false;

  // Boîte à idées (utilise le pseudo courant).
  installerBoiteAIdees(() => pseudo);

  // Menu → lance la partie dans le mode choisi.
  const menu = new Menu((mode, p) => { if (p) pseudo = p; lancerPartie(mode); });
  ui.chargement.style.display = 'none';
  menu.afficher();

  function lancerPartie(mode) {
    controls = new Controls(renderer.domElement);
    player = new Player(carte, controls, (hors) => ui.horsLimites(hors));
    player.collideursDecors = empreintesDecors;   // collisions des décors
    if (mode === 'multi') net = new Net(scene, pseudo);
    enJeu = true;
    ui.invite.style.display = 'flex';
    ui.invite.onclick = () => { ui.masquerInvite(); renderer.domElement.requestPointerLock(); };
  }

  // Échap → la souris se déverrouille → on remontre l'invite (pause).
  document.addEventListener('pointerlockchange', () => {
    if (enJeu && document.pointerLockElement !== renderer.domElement) ui.invite.style.display = 'flex';
  });

  // Boucle de rendu.
  const horloge = new THREE.Clock();
  function boucle() {
    requestAnimationFrame(boucle);
    const dt = Math.min(horloge.getDelta(), 0.1);
    if (enJeu) {
      player.maj(dt, camera);
      if (net) net.envoyer(player.position.x, player.position.y, player.position.z, controls.yaw);
      ui.majDebug(player.position.x, player.position.z,
        carte.altitudeAt(player.position.x, player.position.z));
    }
    renderer.render(scene, camera);
  }
  boucle();

  // Accès debug depuis la console (provisoire).
  window.__v2 = { THREE, scene, camera, renderer, carte,
    get player() { return player; }, get net() { return net; } };
}

demarrer().catch((e) => { console.error(e); new UI().erreur(e.message); });
