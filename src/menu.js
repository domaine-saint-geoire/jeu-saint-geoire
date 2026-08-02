/**
 * menu.js — Écran d'accueil : choix du mode de jeu.
 *   - Visite solo : on se balade tout seul.
 *   - Visite à plusieurs : on rejoint la partie en ligne (voir les autres, chat).
 *   - Loup touche-touche : partie en ligne + on lance tout de suite une manche de loup.
 *
 * Le menu ne fait que signaler le mode choisi. Pour les modes en ligne, c'est main.js
 * qui enchaîne sur l'écran de personnalisation (prénom + apparence) avant de rejoindre.
 */
export class Menu {
  /** @param {(mode:'solo'|'multi'|'loup')=>void} onMode */
  constructor(onMode) {
    this.onMode = onMode;
    this.el = document.getElementById('menu');
    document.getElementById('mSolo').addEventListener('click', () => this._choix('solo'));
    document.getElementById('mMulti').addEventListener('click', () => this._choix('multi'));
    document.getElementById('mLoup').addEventListener('click', () => this._choix('loup'));
  }

  afficher() { this.el.style.display = 'flex'; }
  cacher() { this.el.style.display = 'none'; }

  _choix(mode) { this.cacher(); this.onMode(mode); }
}
