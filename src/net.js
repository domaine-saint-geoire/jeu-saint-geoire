/**
 * net.js — Multijoueur (côté jeu) + protocole du LOUP.
 *   - envoie ma position (+ mon skin) au serveur ~10 fois/s ;
 *   - reçoit les autres joueurs et les affiche (personnage + prénom), met le loup en évidence ;
 *   - relaie l'état du loup, le chat et le radar à des callbacks (gérés par loup.js).
 *
 * Ne marche que si le jeu est hébergé par le serveur (partie lancée depuis le PC).
 */
import * as THREE from '../lib/three.module.js';
import { construireAvatar } from './avatar.js';

const HAUTEUR_YEUX = 1.7;   // le serveur envoie la position des yeux ; l'avatar se pose plus bas
const ROUGE_LOUP = 0xE0332A;

export class Net {
  /** @param {THREE.Scene} scene @param {string} pseudo @param {object} skin */
  constructor(scene, pseudo, skin) {
    this.scene = scene;
    this.pseudo = pseudo;
    this.skin = skin || null;
    this.moiId = null;
    this.maCouleur = 0xffffff;
    this.connecte = false;
    this.autres = new Map();       // id -> { group, boule, couleurBase, skinKey }
    this.loup = { wolf: 0, gel: 0, voitLoup: 0, loupVoitTout: 0, tempsRestant: 0 };
    this._radarJusqua = 0;
    // callbacks (branchés par le jeu)
    this.onLoup = () => {};        // (loupState, moiId) => void
    this.onChat = () => {};        // ({n,c,texte}) => void
    this.onRadar = () => {};       // (ms) => void

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
    if (d.type === 'bienvenue') { this.moiId = d.id; this.maCouleur = d.couleur; }
    else if (d.type === 'joueurs') { this.loup = d.loup || this.loup; this._majJoueurs(d.liste); this.onLoup(this.loup, this.moiId); }
    else if (d.type === 'chat') { this.onChat(d); }
    else if (d.type === 'radar') { this._radarJusqua = Date.now() + (d.ms || 8000); this.onRadar(d.ms || 8000); }
  }

  _majJoueurs(liste) {
    const vus = new Set();
    const jeSuisLoup = (this.moiId && this.moiId === this.loup.wolf);
    const radarActif = jeSuisLoup && (Date.now() < this._radarJusqua || this.loup.loupVoitTout);

    for (const p of liste) {
      if (p.id === this.moiId) continue;
      vus.add(p.id);
      const skinKey = JSON.stringify(p.s) + '|' + p.c;
      let a = this.autres.get(p.id);
      if (!a || a.skinKey !== skinKey) {
        if (a) this.scene.remove(a.group);
        const group = construireAvatar(p.s, p.c);
        this._ajouterEtiquette(group, p.n);
        this.scene.add(group);
        const boule = group.getObjectByName('boule');
        a = { group, boule, couleurBase: (p.s && p.s.c) ? parseInt(p.s.c, 16) : p.c, skinKey };
        this.autres.set(p.id, a);
      }
      // position : le serveur envoie la position des yeux → on pose l'avatar au sol
      a.group.position.set(p.x, p.y - HAUTEUR_YEUX, p.z);
      a.group.rotation.y = p.yaw + Math.PI;   // l'avatar regarde dans le sens de la marche

      // Mise en évidence : le loup en rouge quand tout le monde le voit (1re minute) ;
      // et si JE suis le loup, les brebis sont révélées pendant le radar (ou en continu dès 4 min).
      let couleur = a.couleurBase;
      if (p.id === this.loup.wolf && this.loup.voitLoup) couleur = ROUGE_LOUP;
      else if (radarActif && p.id !== this.loup.wolf) couleur = 0xE5A83E; // brebis révélées au loup
      if (a.boule) a.boule.material.color.setHex(couleur);
    }
    for (const [id, a] of this.autres) if (!vus.has(id)) { this.scene.remove(a.group); this.autres.delete(id); }
  }

  _ajouterEtiquette(group, nom) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 34px Segoe UI,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(nom || '?', 128, 34);
    ctx.fillStyle = '#fff'; ctx.fillText(nom || '?', 128, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    sp.scale.set(2.2, 0.55, 1); sp.position.y = 1.5;
    group.add(sp);
  }

  // ——— envois ———
  envoyer(x, y, z, yaw, cache) {
    if (this.connecte && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'etat', x, y, z, yaw, pseudo: this.pseudo, skin: this.skin, cache: !!cache }));
    }
  }
  envoyerFrappe() { this._env({ type: 'frappe' }); }
  demarrerLoup() { this._env({ type: 'loup' }); }
  envoyerChat(texte) { this._env({ type: 'chat', texte }); }
  _env(o) { if (this.connecte && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  fermer() { try { this.ws && this.ws.close(); } catch (e) {} }
}
