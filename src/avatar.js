/**
 * avatar.js — Le personnage des joueurs + l'interface de personnalisation.
 *
 * Un personnage = une boule colorée avec des yeux, plus (au choix) un chapeau et un objet tenu.
 * `construireAvatar()` fabrique le modèle 3D — utilisé pour les autres joueurs (net.js) ET
 * pour l'aperçu de la personnalisation. `Personnalisation` gère l'écran de choix.
 */
import * as THREE from '../lib/three.module.js';

export const COULEURS_AVATAR = [0xE85A5A, 0x5A9BE8, 0x5AE87A, 0xE8C85A, 0xC85AE8, 0x5AE8D8, 0xE88A5A, 0xA0E85A, 0xFFFFFF, 0x333333];
export const CHAPEAUX = [
  { id: 'none', nom: 'Aucun' }, { id: 'cowboy', nom: '🤠 Cowboy' },
  { id: 'hautforme', nom: '🎩 Haut-de-forme' }, { id: 'lunettes', nom: '🕶 Lunettes' },
];
export const OBJETS = [
  { id: 'none', nom: 'Rien' }, { id: 'baton', nom: '🥢 Bâton' },
  { id: 'baguette', nom: '🥖 Baguette' }, { id: 'fromage', nom: '🧀 Fromage' },
];

const R = 0.45; // rayon de la boule

/**
 * Construit le modèle 3D d'un personnage.
 * @param {{c?:string,h?:string,i?:string}|null} skin  couleur (hex sans #), chapeau, objet
 * @param {number} couleurDefaut  couleur si le skin n'en fixe pas
 * @returns {THREE.Group}
 */
export function construireAvatar(skin, couleurDefaut) {
  const g = new THREE.Group();
  const couleur = (skin && skin.c) ? parseInt(skin.c, 16) : couleurDefaut;

  const boule = new THREE.Mesh(new THREE.SphereGeometry(R, 18, 14), new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.55 }));
  boule.position.y = R; boule.name = 'boule';
  g.add(boule);

  // Yeux (vers l'avant = +Z local ; le groupe est tourné selon le cap).
  const blanc = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const noir = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const dx of [-0.16, 0.16]) {
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), blanc); oeil.position.set(dx, R + 0.07, R * 0.8); g.add(oeil);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), noir); pup.position.set(dx, R + 0.07, R * 0.95); g.add(pup);
  }

  // Chapeau.
  const h = skin && skin.h;
  if (h === 'cowboy') {
    const brun = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 });
    const bord = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), brun); bord.position.y = R + 0.42; g.add(bord);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 16), brun); dome.position.y = R + 0.55; g.add(dome);
  } else if (h === 'hautforme') {
    const noirM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const bord = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 20), noirM); bord.position.y = R + 0.42; g.add(bord);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 20), noirM); tube.position.y = R + 0.63; g.add(tube);
  } else if (h === 'lunettes') {
    const cadre = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const dx of [-0.16, 0.16]) {
      const v = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), cadre); v.position.set(dx, R + 0.07, R * 0.9); g.add(v);
    }
  }

  // Objet tenu (sur le côté droit).
  const i = skin && skin.i;
  if (i === 'baton') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x9a6b3a }));
    m.position.set(0.5, 0.4, 0); m.rotation.z = 0.2; g.add(m);
  } else if (i === 'baguette') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.9 }));
    m.position.set(0.52, 0.45, 0); m.rotation.z = 0.35; g.add(m);
  } else if (i === 'fromage') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 3), new THREE.MeshStandardMaterial({ color: 0xf2c94c }));
    m.position.set(0.55, 0.4, 0); m.rotation.y = 0.5; g.add(m);
  }

  return g;
}

/**
 * Écran de personnalisation. Affiche des choix (couleur / chapeau / objet) + un aperçu 3D,
 * et rappelle `onValider(pseudo, skin)` quand le joueur valide.
 */
export class Personnalisation {
  constructor(onValider) {
    this.onValider = onValider;
    this.skin = { c: 'E85A5A', h: 'none', i: 'none' };
    this.el = document.getElementById('perso');
    this._construireUI();
    this._initApercu();
  }

  afficher(pseudo) { document.getElementById('persoNom').value = pseudo || ''; this.el.style.display = 'flex'; this._resizeApercu(); }
  cacher() { this.el.style.display = 'none'; }

  _construireUI() {
    const cont = document.getElementById('persoCouleurs');
    COULEURS_AVATAR.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch'; b.style.background = '#' + c.toString(16).padStart(6, '0');
      b.onclick = () => { this.skin.c = c.toString(16).padStart(6, '0'); this._maj(); this._selSwatch(b); };
      cont.appendChild(b);
      if (c === 0xE85A5A) this._selSwatch(b);
    });
    this._remplirSelect('persoChapeau', CHAPEAUX, 'h');
    this._remplirSelect('persoObjet', OBJETS, 'i');
    document.getElementById('persoOk').onclick = () => {
      const pseudo = (document.getElementById('persoNom').value || '').trim().slice(0, 16) || 'Joueur';
      this.cacher(); this.onValider(pseudo, this.skin);
    };
  }
  _remplirSelect(id, options, cle) {
    const sel = document.getElementById(id);
    options.forEach((o) => { const opt = document.createElement('option'); opt.value = o.id; opt.textContent = o.nom; sel.appendChild(opt); });
    sel.onchange = () => { this.skin[cle] = sel.value; this._maj(); };
  }
  _selSwatch(b) {
    document.querySelectorAll('#persoCouleurs .swatch').forEach((s) => s.classList.remove('on'));
    b.classList.add('on');
  }

  _initApercu() {
    const cv = document.getElementById('persoApercu');
    this._rend = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    this._scene = new THREE.Scene();
    this._cam = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
    this._cam.position.set(0, 1.1, 2.6); this._cam.lookAt(0, 0.5, 0);
    this._scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(2, 4, 3); this._scene.add(dl);
    this._maj();
    const boucle = () => { requestAnimationFrame(boucle); if (this._avatar) this._avatar.rotation.y += 0.02; this._rend.render(this._scene, this._cam); };
    boucle();
  }
  _resizeApercu() {
    const cv = document.getElementById('persoApercu');
    const w = cv.clientWidth || 180, h = cv.clientHeight || 180;
    this._rend.setSize(w, h, false); this._cam.aspect = w / h; this._cam.updateProjectionMatrix();
  }
  _maj() {
    if (this._avatar) this._scene.remove(this._avatar);
    this._avatar = construireAvatar(this.skin, parseInt(this.skin.c, 16));
    this._scene.add(this._avatar);
  }
}
