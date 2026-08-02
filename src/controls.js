/**
 * controls.js — Saisie « vue à la première personne ».
 *   - Souris : tourne la vue (après un clic qui verrouille le pointeur).
 *   - Clavier : déplacement. On lit les codes PHYSIQUES des touches (KeyW/A/S/D),
 *     ce qui couvre automatiquement AZERTY (ZQSD) ET QWERTY (WASD), plus les flèches.
 *   - Maj : courir.
 *
 * Cette classe ne fait QUE lire les entrées ; c'est player.js qui les applique.
 */
import { JOUEUR } from './config.js';

export class Controls {
  /** @param {HTMLElement} domElement  le <canvas> du rendu */
  constructor(domElement) {
    this.dom = domElement;
    this.yaw = 0;    // cap gauche/droite (rad) ; 0 = regard vers le nord (−Z)
    this.pitch = 0;  // regard haut/bas (rad)
    this.actif = false; // pointeur verrouillé ?
    this._touches = Object.create(null);

    // Verrouillage du pointeur au clic (nécessaire pour capter la souris).
    domElement.addEventListener('click', () => domElement.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      this.actif = document.pointerLockElement === domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.actif) return;
      this.yaw   -= e.movementX * JOUEUR.SENSIBILITE_SOURIS;
      this.pitch -= e.movementY * JOUEUR.SENSIBILITE_SOURIS;
      const limite = Math.PI / 2 - 0.05; // on ne bascule pas complètement la tête
      this.pitch = Math.max(-limite, Math.min(limite, this.pitch));
    });

    window.addEventListener('keydown', (e) => { this._touches[e.code] = true; });
    window.addEventListener('keyup',   (e) => { this._touches[e.code] = false; });
  }

  /**
   * Intention de déplacement relative à l'orientation.
   * @returns {{avant:number, droite:number, court:boolean}}  avant/droite ∈ {−1,0,1}
   */
  intention() {
    // Si on est en train d'écrire (chat), on ne bouge pas.
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return { avant: 0, droite: 0, court: false };
    const t = this._touches;
    const avant  = ((t.KeyW || t.ArrowUp)    ? 1 : 0) - ((t.KeyS || t.ArrowDown)  ? 1 : 0);
    const droite = ((t.KeyD || t.ArrowRight) ? 1 : 0) - ((t.KeyA || t.ArrowLeft)  ? 1 : 0);
    const court  = !!(t.ShiftLeft || t.ShiftRight);
    return { avant, droite, court };
  }
}
