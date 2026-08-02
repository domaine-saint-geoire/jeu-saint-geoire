/**
 * loup.js — Interface du jeu « Loup touche-touche » + le chat, par-dessus le jeu.
 *
 * Règle (arbitrée par le serveur) : un joueur est le LOUP ; il doit toucher quelqu'un
 * (touche Espace, ou le bouton 👋) pour lui refiler le rôle. La 1re minute tout le
 * monde voit le loup ; ensuite le loup reçoit un « radar » de plus en plus fréquent.
 * Après 5 minutes, classement : le moins de temps passé en loup gagne.
 *
 * Cette classe NE fait QUE l'affichage et la saisie ; toute la logique est côté serveur
 * (voir serveur/server.js). Elle se branche sur les callbacks de net.js.
 */
export class LoupUI {
  /**
   * @param {import('./net.js').Net} net
   * @param {() => {x:number,y:number,z:number}} getPos  position du joueur (pour l'affichage)
   */
  constructor(net, getPos) {
    this.net = net;
    this.getPos = getPos;
    this.moiId = 0;
    this.etat = { wolf: 0, gel: 0, voitLoup: 0, loupVoitTout: 0, tempsRestant: 0 };

    // Éléments d'interface (définis dans index.html).
    this.hud = document.getElementById('loupHud');
    this.role = document.getElementById('loupRole');
    this.timer = document.getElementById('loupTimer');
    this.chat = document.getElementById('chat');
    this.chatLog = document.getElementById('chatLog');
    this.chatInput = document.getElementById('chatInput');
    this.btnLoup = document.getElementById('btnLoup');
    this.btnToucher = document.getElementById('btnToucher');

    this._brancherReseau();
    this._brancherSaisie();
  }

  /** Affiche l'interface (au lancement d'une partie en ligne). */
  montrer() { this.hud.style.display = 'block'; this.chat.style.display = 'flex'; this.btnLoup.style.display = 'block'; }
  cacher() { this.hud.style.display = 'none'; this.chat.style.display = 'none'; this.btnLoup.style.display = 'none'; this.btnToucher.style.display = 'none'; }

  // ————————————————— réseau —————————————————
  _brancherReseau() {
    this.net.onLoup = (etat, moiId) => { this.etat = etat; this.moiId = moiId; this._majHud(); };
    this.net.onChat = (m) => this._ajouterChat(m);
    this.net.onRadar = () => this._toast('📡 Radar ! Regarde autour de toi.');
  }

  _majHud() {
    const e = this.etat, suisLoup = this.moiId && this.moiId === e.wolf;
    if (!e.wolf) {                                   // aucune partie de loup en cours
      this.role.textContent = '🎮 Partie en ligne';
      this.role.className = 'attente';
      this.timer.textContent = '';
      this.btnToucher.style.display = 'none';
      this.btnLoup.textContent = '🐺 Lancer le loup';
      this.btnLoup.disabled = false;
      return;
    }
    this.btnLoup.textContent = '🐺 Partie de loup en cours';
    this.btnLoup.disabled = true;
    // Chrono restant (mm:ss).
    const s = Math.max(0, Math.round(e.tempsRestant / 1000));
    this.timer.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (suisLoup) {
      const gel = Math.ceil(e.gel / 1000);
      this.role.textContent = gel > 0 ? '🐺 LOUP — immunisé ' + gel + 's' : '🐺 Tu es le LOUP — attrape quelqu\'un !';
      this.role.className = 'loup';
      this.btnToucher.style.display = 'block';
      this.btnToucher.disabled = gel > 0;
    } else {
      this.role.textContent = '🐑 Fuis le loup !';
      this.role.className = 'brebis';
      this.btnToucher.style.display = 'none';
    }
  }

  // ————————————————— saisie —————————————————
  _brancherSaisie() {
    // Bouton « Lancer le loup ».
    this.btnLoup.onclick = () => { this.net.demarrerLoup(); this._flou(); };
    // Bouton « Toucher » (surtout mobile).
    this.btnToucher.onclick = () => { this._frapper(); this._flou(); };

    // Clavier : Espace = toucher (si je suis le loup) ; Entrée = ouvrir/envoyer le chat.
    window.addEventListener('keydown', (e) => {
      const enTrainDEcrire = document.activeElement === this.chatInput;
      if (e.code === 'Enter') {
        e.preventDefault();
        if (enTrainDEcrire) this._envoyerChat();
        else this.chatInput.focus();
        return;
      }
      if (e.code === 'Escape' && enTrainDEcrire) { this.chatInput.blur(); return; }
      if (enTrainDEcrire) return;
      if (e.code === 'Space' && this.moiId === this.etat.wolf && !this.etat.gel) { e.preventDefault(); this._frapper(); }
    });
    // Empêche l'input de perdre le focus au premier caractère et bloque la propagation vers le jeu.
    this.chatInput.addEventListener('keydown', (e) => e.stopPropagation());
  }

  _frapper() {
    const now = performance.now();
    if (this._dernFrappe && now - this._dernFrappe < 400) return; // anti-spam
    this._dernFrappe = now;
    this.net.envoyerFrappe();
  }

  _envoyerChat() {
    const t = (this.chatInput.value || '').trim().slice(0, 120);
    this.chatInput.value = '';
    this.chatInput.blur();
    if (t) this.net.envoyerChat(t);
  }

  _ajouterChat(m) {
    const div = document.createElement('div');
    div.className = 'msg';
    const couleur = '#' + (m.c || 0xffffff).toString(16).padStart(6, '0');
    div.innerHTML = '<b style="color:' + couleur + '">' + this._echapper(m.n || '?') + '</b> '
      + this._echapper(m.texte || '');
    this.chatLog.appendChild(div);
    while (this.chatLog.children.length > 40) this.chatLog.removeChild(this.chatLog.firstChild);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  _toast(txt) {
    let el = document.getElementById('loupToast');
    if (!el) { el = document.createElement('div'); el.id = 'loupToast'; document.body.appendChild(el); }
    el.textContent = txt; el.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }

  _flou() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  _echapper(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
}
