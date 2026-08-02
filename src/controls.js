/**
 * controls.js — Saisie « vue à la première personne », PC ET téléphone.
 *
 *   PC       : souris (après clic = pointeur verrouillé) pour regarder, ZQSD/WASD pour marcher, Maj pour courir.
 *              On lit les codes PHYSIQUES des touches (KeyW/A/S/D) → AZERTY et QWERTY marchent pareil.
 *   Téléphone: manette tactile à gauche pour marcher (analogique), glisser à droite pour regarder.
 *              Sur mobile la vitesse de base = course (comme dans l'ancien jeu).
 *
 * Cette classe ne fait QUE lire les entrées ; c'est player.js qui les applique.
 */
import { JOUEUR } from './config.js';

// Détection automatique du tactile ; `?tactile` dans l'adresse le force (secours si mal détecté).
const EST_TACTILE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || location.search.includes('tactile');
const SENS_TACTILE = 0.005;   // sensibilité du regard au doigt
const RAYON_JOY = 55;         // rayon de la manette (px)

export class Controls {
  /** @param {HTMLElement} domElement  le <canvas> du rendu */
  constructor(domElement) {
    this.dom = domElement;
    this.yaw = 0;    // cap gauche/droite (rad) ; 0 = regard vers le nord (−Z)
    this.pitch = 0;  // regard haut/bas (rad)
    this.actif = false;     // pointeur verrouillé (PC) ?
    this.tactile = EST_TACTILE;
    this._touches = Object.create(null);

    // Manette tactile.
    this._joy = null;              // identifiant du doigt "manette" (ou null)
    this._joyV = { avant: 0, droite: 0 };
    this._joyOx = 0; this._joyOy = 0;
    this._look = null;             // { id, x, y } du doigt "regard"

    // --- PC : souris + clavier ---
    domElement.addEventListener('click', () => { if (!EST_TACTILE) domElement.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => { this.actif = document.pointerLockElement === domElement; });
    document.addEventListener('mousemove', (e) => {
      if (!this.actif) return;
      this.yaw   -= e.movementX * JOUEUR.SENSIBILITE_SOURIS;
      this.pitch -= e.movementY * JOUEUR.SENSIBILITE_SOURIS;
      this._clampPitch();
    });
    window.addEventListener('keydown', (e) => { this._touches[e.code] = true; });
    window.addEventListener('keyup',   (e) => { this._touches[e.code] = false; });

    if (EST_TACTILE) this._initTactile();
  }

  _clampPitch() { const l = Math.PI / 2 - 0.05; this.pitch = Math.max(-l, Math.min(l, this.pitch)); }

  // --- Téléphone : manette (gauche) + regard (droite) ---
  _initTactile() {
    this.base = document.getElementById('joyBase');
    this.knob = document.getElementById('joyKnob');
    const seuilGauche = () => window.innerWidth * 0.45;   // moitié gauche = manette

    this.dom.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < seuilGauche() && this._joy === null) {
          this._joy = t.identifier; this._joyOx = t.clientX; this._joyOy = t.clientY;
          this._montrerJoy(t.clientX, t.clientY);
        } else if (this._look === null) {
          this._look = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });

    this.dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joy) {
          let dx = t.clientX - this._joyOx, dy = t.clientY - this._joyOy;
          const d = Math.hypot(dx, dy);
          if (d > RAYON_JOY) { dx *= RAYON_JOY / d; dy *= RAYON_JOY / d; }
          this._joyV.avant = -dy / RAYON_JOY;    // pousser vers le haut = avancer
          this._joyV.droite = dx / RAYON_JOY;    // pousser à droite = pas de côté
          if (this.knob) { this.knob.style.left = (this._joyOx + dx) + 'px'; this.knob.style.top = (this._joyOy + dy) + 'px'; }
        } else if (this._look && t.identifier === this._look.id) {
          this.yaw   -= (t.clientX - this._look.x) * SENS_TACTILE;
          this.pitch -= (t.clientY - this._look.y) * SENS_TACTILE;
          this._clampPitch();
          this._look.x = t.clientX; this._look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const fin = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joy) { this._joy = null; this._joyV.avant = 0; this._joyV.droite = 0; this._cacherJoy(); }
        else if (this._look && t.identifier === this._look.id) { this._look = null; }
      }
    };
    this.dom.addEventListener('touchend', fin);
    this.dom.addEventListener('touchcancel', fin);
  }
  _montrerJoy(x, y) {
    if (!this.base) return;
    this.base.style.left = x + 'px'; this.base.style.top = y + 'px';
    this.knob.style.left = x + 'px'; this.knob.style.top = y + 'px';
    this.base.style.display = 'block'; this.knob.style.display = 'block';
  }
  _cacherJoy() { if (this.base) { this.base.style.display = 'none'; this.knob.style.display = 'none'; } }

  /**
   * Intention de déplacement relative à l'orientation.
   * @returns {{avant:number, droite:number, court:boolean}}  valeurs ∈ [−1,1] (analogiques au doigt)
   */
  intention() {
    // Si on écrit (chat), on ne bouge pas.
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return { avant: 0, droite: 0, court: false };
    // Manette tactile prioritaire (course par défaut sur mobile).
    if (this._joy !== null) return { avant: this._joyV.avant, droite: this._joyV.droite, court: true };
    // Clavier.
    const t = this._touches;
    const avant  = ((t.KeyW || t.ArrowUp)    ? 1 : 0) - ((t.KeyS || t.ArrowDown)  ? 1 : 0);
    const droite = ((t.KeyD || t.ArrowRight) ? 1 : 0) - ((t.KeyA || t.ArrowLeft)  ? 1 : 0);
    const court  = !!(t.ShiftLeft || t.ShiftRight);
    return { avant, droite, court };
  }
}
