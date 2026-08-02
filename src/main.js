/**
 * main.js — Point d'entrée du jeu. Enchaînement :
 *
 *   chargement de la carte  →  MENU  →  (personnalisation si en ligne)  →  partie (boucle de rendu)
 *
 * Modes :
 *   - « solo »  : on se balade tout seul (pas de serveur nécessaire côté réseau).
 *   - « multi » : partie en ligne — on voit les autres, on discute (chat).
 *   - « loup »  : partie en ligne + on lance une manche de Loup touche-touche.
 *
 * La boîte à idées est disponible dès le menu.
 *
 * Le jeu DOIT être servi par un serveur (http) — pas ouvert en fichier local —
 * car il lit les pixels de l'image de données. Le multijoueur exige en plus le serveur du jeu.
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
import { LoupUI } from './loup.js';
import { Personnalisation } from './avatar.js';
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
  let player = null, controls = null, net = null, loupUI = null, enJeu = false;

  // Boîte à idées (utilise le pseudo courant).
  installerBoiteAIdees(() => pseudo);

  // Écran de personnalisation (réutilisé pour les modes en ligne).
  const perso = new Personnalisation((p, skin) => lancerPartie(perso._mode, p, skin));

  // Menu → solo direct, ou personnalisation avant de rejoindre en ligne.
  const menu = new Menu((mode) => {
    if (mode === 'solo') { lancerPartie('solo'); return; }
    perso._mode = mode;               // mémorise le mode choisi pour l'après-validation
    perso.afficher(pseudo === 'Anonyme' ? '' : pseudo);
  });
  ui.chargement.style.display = 'none';
  menu.afficher();

  function lancerPartie(mode, p, skin) {
    if (p) pseudo = p;
    controls = new Controls(renderer.domElement);
    player = new Player(carte, controls, (hors) => ui.horsLimites(hors));
    player.collideursDecors = empreintesDecors;   // collisions des décors

    if (mode === 'multi' || mode === 'loup') {
      net = new Net(scene, pseudo, skin);
      loupUI = new LoupUI(net, () => player.position);
      loupUI.montrer();
      // Mode « loup » : on tente de démarrer une manche dès qu'on est connecté.
      if (mode === 'loup') setTimeout(() => net.demarrerLoup(), 1500);
    }
    // Textes d'aide selon PC / téléphone.
    document.getElementById('inviteTitre').textContent = controls.tactile ? 'Touche pour explorer' : 'Clique pour explorer';
    document.getElementById('inviteAide').textContent = controls.tactile
      ? 'Manette à gauche pour marcher · glisse à droite pour regarder'
      : 'ZQSD / WASD pour marcher · souris pour regarder · Maj pour courir · Échap pour la pause';

    enJeu = true;
    ui.invite.style.display = 'flex';
    // PC : le clic verrouille la souris. Téléphone : on entre direct (la manette gère tout).
    ui.invite.onclick = () => { ui.masquerInvite(); if (!controls.tactile) renderer.domElement.requestPointerLock(); };
    majOrientation();
  }

  // Échap → la souris se déverrouille → on remontre l'invite (pause),
  // sauf si on est en train d'écrire dans le chat.
  document.addEventListener('pointerlockchange', () => {
    const ecrit = document.activeElement && document.activeElement.id === 'chatInput';
    if (enJeu && !ecrit && document.pointerLockElement !== renderer.domElement) ui.invite.style.display = 'flex';
  });

  // Plein écran (⛶). Sur iPhone l'API n'existe pas → petit conseil à la place.
  document.getElementById('btnPlein').onclick = () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    else alert("Sur iPhone, le plein écran web n'existe pas. Astuce : mets-toi en paysage, ou ajoute la page à ton écran d'accueil (Partager → « Sur l'écran d'accueil ») pour l'avoir en plein écran.");
  };

  // Astuce « tourne ton téléphone » : mobile en portrait, pendant une partie.
  function majOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    document.getElementById('rotate').style.display = (enJeu && controls && controls.tactile && portrait) ? 'flex' : 'none';
  }
  window.addEventListener('resize', majOrientation);
  window.addEventListener('orientationchange', () => setTimeout(majOrientation, 200));

  // Boucle de rendu.
  const horloge = new THREE.Clock();
  function boucle() {
    requestAnimationFrame(boucle);
    const dt = Math.min(horloge.getDelta(), 0.1);
    if (enJeu) {
      player.maj(dt, camera);
      if (net) net.envoyer(player.position.x, player.position.y, player.position.z, controls.yaw, false);
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
