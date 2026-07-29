/**
 * net.js — Multijoueur (côté jeu).
 *   - se connecte au serveur en WebSocket ;
 *   - lui envoie ma position ~10 fois/seconde ;
 *   - reçoit la position des autres joueurs et les affiche (boule colorée + prénom).
 *
 * Ne marche QUE si le jeu est hébergé par le serveur (la partie lancée depuis le PC).
 * Sur le lien public fixe (statique), il n'y a pas de serveur : la connexion échoue
 * en silence et on reste seul — c'est voulu.
 */
import * as THREE from '../lib/three.module.js';

export class Net {
  /** @param {THREE.Scene} scene @param {string} pseudo */
  constructor(scene, pseudo) {
    this.scene = scene;
    this.pseudo = pseudo;
    this.moiId = null;
    this.connecte = false;
    this.autres = new Map(); // id -> THREE.Group (boule + étiquette)
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(proto + '://' + location.host);
      this.ws.onopen = () => { this.connecte = true; };
      this.ws.onmessage = (e) => { try { this._recu(JSON.parse(e.data)); } catch (err) {} };
      this.ws.onclose = () => { this.connecte = false; };
      this.ws.onerror = () => { this.connecte = false; };
    } catch (e) { this.connecte = false; }
  }

  _recu(d) {
    if (d.type === 'bienvenue') this.moiId = d.id;
    else if (d.type === 'joueurs') this._majJoueurs(d.liste);
  }

  _majJoueurs(liste) {
    const vus = new Set();
    for (const p of liste) {
      if (p.id === this.moiId) continue; // pas moi-même
      vus.add(p.id);
      let m = this.autres.get(p.id);
      if (!m) { m = this._creerBoule(p.c, p.n); this.scene.add(m); this.autres.set(p.id, m); }
      // p.y = hauteur des yeux de l'autre → on descend la boule au niveau du torse.
      m.position.set(p.x, p.y - 1.0, p.z);
    }
    // Retire ceux qui sont partis.
    for (const [id, m] of this.autres) {
      if (!vus.has(id)) { this.scene.remove(m); this.autres.delete(id); }
    }
  }

  /** Un autre joueur = une boule colorée surmontée de son prénom. */
  _creerBoule(couleur, nom) {
    const g = new THREE.Group();
    const boule = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 12),
      new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.6 }),
    );
    boule.position.y = 0.45;
    g.add(boule);

    // Étiquette prénom (canvas → sprite, toujours face à la caméra).
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 34px Segoe UI,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(nom || '?', 128, 34);
    ctx.fillStyle = '#ffffff'; ctx.fillText(nom || '?', 128, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    sp.scale.set(2.2, 0.55, 1); sp.position.y = 1.4;
    g.add(sp);
    return g;
  }

  /** Envoie ma position au serveur. */
  envoyer(x, y, z, yaw) {
    if (this.connecte && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'etat', x, y, z, yaw, pseudo: this.pseudo }));
    }
  }

  fermer() { try { this.ws && this.ws.close(); } catch (e) {} }
}
