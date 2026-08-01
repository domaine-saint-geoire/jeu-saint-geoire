/**
 * player.js — Le joueur en vue première personne.
 *   - se déplace selon l'intention des contrôles ;
 *   - reste TOUJOURS collé au relief (hauteur du sol + hauteur des yeux) ;
 *   - ne peut PAS entrer dans une zone bloquée (limite dure) : on teste chaque
 *     axe séparément → glissement le long des « murs invisibles » ;
 *   - prévient quand il franchit la limite douce (hors du terrain) via un callback.
 */
import * as THREE from '../lib/three.module.js';
import { JOUEUR } from './config.js';

export class Player {
  /**
   * @param {import('./carte.js').Carte} carte
   * @param {import('./controls.js').Controls} controls
   * @param {(hors:boolean)=>void} onHorsLimites  appelé UNIQUEMENT quand l'état change
   */
  constructor(carte, controls, onHorsLimites) {
    this.carte = carte;
    this.controls = controls;
    this.onHorsLimites = onHorsLimites;
    this._horsAvant = false;
    // Empreintes de collision des décors (rectangles au sol), remplies par le chargeur de décors.
    this.collideursDecors = [];

    // Spawn provisoire : au centre de la carte (réglé plus tard).
    this.position = new THREE.Vector3(0, 0, 0);
    this.position.y = carte.altitudeAt(0, 0) + JOUEUR.HAUTEUR_YEUX_M;
  }

  /**
   * Avance la simulation d'un pas de temps et met à jour la caméra.
   * @param {number} dt  secondes écoulées depuis la dernière frame
   * @param {THREE.PerspectiveCamera} camera
   */
  maj(dt, camera) {
    const { avant, droite, court } = this.controls.intention();
    const vitesse = (court ? JOUEUR.VITESSE_COURSE : JOUEUR.VITESSE_MARCHE) * dt;

    // Vecteur de déplacement à plat, orienté selon le cap (yaw). yaw=0 → nord (−Z).
    const yaw = this.controls.yaw;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const dx = (avant * -sin + droite * cos) * vitesse;
    const dz = (avant * -cos - droite * sin) * vitesse;
    this._deplacerAvecCollision(dx, dz);

    // Se coller au sol.
    this.position.y = this.carte.altitudeAt(this.position.x, this.position.z) + JOUEUR.HAUTEUR_YEUX_M;

    // Limite douce : ne notifier qu'aux changements d'état (entrée/sortie).
    const hors = this.carte.zoneAt(this.position.x, this.position.z).horsTerrain;
    if (hors !== this._horsAvant) {
      this._horsAvant = hors;
      this.onHorsLimites(hors);
    }

    // Reporter la position et l'orientation sur la caméra (FPS : yaw puis pitch).
    camera.position.copy(this.position);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotateY(yaw);
    camera.rotateX(this.controls.pitch);
  }

  /** (x,z) est-il solide ? (limite dure de la carte OU empreinte d'un décor) */
  _bloque(x, z) {
    if (this.carte.zoneAt(x, z).bloque) return true;
    for (const f of this.collideursDecors) {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return true;
    }
    return false;
  }

  /** Applique (dx,dz) en respectant les obstacles, axe par axe (glissement le long des murs). */
  _deplacerAvecCollision(dx, dz) {
    const nx = this.position.x + dx;
    if (!this._bloque(nx, this.position.z)) this.position.x = nx;
    const nz = this.position.z + dz;
    if (!this._bloque(this.position.x, nz)) this.position.z = nz;

    // Ne jamais sortir du carré de la carte.
    const demi = this.carte.tailleM / 2 - 0.5;
    this.position.x = Math.max(-demi, Math.min(demi, this.position.x));
    this.position.z = Math.max(-demi, Math.min(demi, this.position.z));
  }
}
