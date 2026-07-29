/**
 * ui.js — Interface à l'écran : écran de chargement, invite « clique pour jouer »,
 * bandeau « hors limites », et petit affichage de position (provisoire, pour le debug).
 *
 * Cette classe ne connaît que le DOM (les éléments définis dans index.html).
 */
export class UI {
  constructor() {
    this.chargement = document.getElementById('chargement');
    this.invite = document.getElementById('invite');
    this.bandeau = document.getElementById('bandeau');
    this.debug = document.getElementById('debug');
  }

  /** Cache l'écran de chargement et montre l'invite de démarrage. */
  pret() {
    this.chargement.style.display = 'none';
    this.invite.style.display = 'flex';
  }

  /** Cache l'invite (au 1er clic). */
  masquerInvite() { this.invite.style.display = 'none'; }

  /** Affiche/masque le bandeau « hors limites ». */
  horsLimites(actif) { this.bandeau.style.display = actif ? 'block' : 'none'; }

  /** Affiche une erreur bloquante sur l'écran de chargement. */
  erreur(message) {
    this.chargement.style.display = 'flex';
    this.chargement.textContent = 'Erreur : ' + message;
  }

  /** Affichage de position (debug). */
  majDebug(x, z, altitudeM) {
    this.debug.textContent = `x ${x.toFixed(1)}  z ${z.toFixed(1)}  ·  altitude ${altitudeM.toFixed(1)} m`;
  }
}
