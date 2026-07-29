/**
 * menu.js — Écran d'accueil : choix du mode de jeu.
 *   - Visite solo : on se balade tout seul.
 *   - Visite à plusieurs : on demande un pseudo, puis on rejoint la partie (multijoueur).
 *   - Loup touche-touche : à venir (bouton désactivé pour l'instant).
 */
export class Menu {
  /** @param {(mode:'solo'|'multi', pseudo:string)=>void} onMode */
  constructor(onMode) {
    this.onMode = onMode;
    this.el = document.getElementById('menu');
    document.getElementById('mSolo').addEventListener('click', () => this._choix('solo'));
    document.getElementById('mMulti').addEventListener('click', () => this._choix('multi'));
    // mLoup est désactivé (à construire).
  }

  afficher() { this.el.style.display = 'flex'; }
  cacher() { this.el.style.display = 'none'; }

  _choix(mode) {
    let pseudo = '';
    if (mode === 'multi') {
      pseudo = (prompt('Ton prénom (visible par les autres joueurs) :', '') || '').trim().slice(0, 20);
      if (!pseudo) return; // annulé → on reste sur le menu
    }
    this.cacher();
    this.onMode(mode, pseudo);
  }
}
