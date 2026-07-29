/**
 * carte.js — Chargement et lecture de la carte du domaine.
 *
 * Deux images décrivent le MÊME carré de terrain (le haut = le nord) :
 *   - l'image satellite : l'aspect visuel du sol ;
 *   - l'image de données (PNG sans perte) : les altitudes (canal Rouge)
 *     et les zones (canal Bleu, lues bit par bit).
 *
 * Les dimensions des images sont lues au chargement : RIEN n'est codé en dur,
 * on peut donc changer leur définition sans toucher au code.
 *
 * Repère du monde 3D :
 *   - origine (0,0) au CENTRE de la carte ;
 *   - X : ouest (−) → est (+) ;
 *   - Z : nord (−) → sud (+)   (« avancer vers le nord » = Z diminue) ;
 *   - Y : hauteur en mètres, la terrasse valant 0.
 */
import { CARTE, ALT_ETENDUE_M, TAILLE_MONDE_M } from './config.js';

/**
 * Charge une image et en extrait les pixels (via un canvas hors-écran).
 * @param {string} url
 * @returns {Promise<{largeur:number, hauteur:number, pixels:Uint8ClampedArray, image:HTMLImageElement}>}
 */
async function lirePixels(url) {
  const image = await new Promise((resoudre, rejeter) => {
    const img = new Image();
    img.onload = () => resoudre(img);
    img.onerror = () => rejeter(new Error('Image introuvable : ' + url));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data; // [r,g,b,a, r,g,b,a, …]
  return { largeur: image.width, hauteur: image.height, pixels, image };
}

export class Carte {
  /**
   * @param {{largeur:number,hauteur:number,pixels:Uint8ClampedArray}} donnees  image alti+zones
   * @param {{image:HTMLImageElement}} satellite  image de fond
   */
  constructor(donnees, satellite) {
    this._donnees = donnees;
    this.satellite = satellite.image; // élément <img> réutilisé comme texture
    this.tailleM = TAILLE_MONDE_M;
  }

  /** Charge en parallèle les deux images et renvoie une Carte prête à l'emploi. */
  static async charger() {
    const [donnees, satellite] = await Promise.all([
      lirePixels(CARTE.IMAGE_DONNEES),
      lirePixels(CARTE.IMAGE_SATELLITE),
    ]);
    return new Carte(donnees, satellite);
  }

  // ————————————————— Conversions monde ↔ image —————————————————

  /**
   * Convertit une position monde (x,z) en coordonnées pixel (flottantes)
   * dans l'image de données.  u/v ∈ [0,1] : u = ouest→est, v = nord→sud.
   */
  _mondeVersPixel(x, z) {
    const u = x / this.tailleM + 0.5;
    const v = z / this.tailleM + 0.5;
    return { px: u * (this._donnees.largeur - 1), py: v * (this._donnees.hauteur - 1) };
  }

  /** Valeur d'un canal (0=R, 1=G, 2=B) au pixel entier (ix,iy), coordonnées bornées. */
  _canal(ix, iy, canal) {
    const L = this._donnees.largeur, H = this._donnees.hauteur;
    ix = ix < 0 ? 0 : ix > L - 1 ? L - 1 : ix;
    iy = iy < 0 ? 0 : iy > H - 1 ? H - 1 : iy;
    return this._donnees.pixels[(iy * L + ix) * 4 + canal];
  }

  // ————————————————— Lecture du terrain —————————————————

  /**
   * Altitude du terrain en (x,z), en mètres, la terrasse valant 0.
   * Interpolation BILINÉAIRE du canal Rouge → relief lisse (pas de marches d'escalier).
   */
  altitudeAt(x, z) {
    const { px, py } = this._mondeVersPixel(x, z);
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const fx = px - x0, fy = py - y0;
    const r00 = this._canal(x0,     y0,     0), r10 = this._canal(x0 + 1, y0,     0);
    const r01 = this._canal(x0,     y0 + 1, 0), r11 = this._canal(x0 + 1, y0 + 1, 0);
    const haut = r00 * (1 - fx) + r10 * fx;
    const bas  = r01 * (1 - fx) + r11 * fx;
    const rouge = haut * (1 - fy) + bas * fy;
    return (rouge - CARTE.ROUGE_TERRASSE) / 255 * ALT_ETENDUE_M;
  }

  /**
   * Zones en (x,z), lues sur le canal Bleu.
   * Échantillon au PLUS PROCHE (ce sont des bits : pas d'interpolation possible).
   * @returns {{horsTerrain:boolean, bloque:boolean}}
   */
  zoneAt(x, z) {
    const { px, py } = this._mondeVersPixel(x, z);
    const bleu = this._canal(Math.round(px), Math.round(py), 2);
    return {
      horsTerrain: ((bleu >> CARTE.BIT_LIMITE_TERRAIN) & 1) === 1,
      bloque:      ((bleu >> CARTE.BIT_LIMITE_JEU)     & 1) === 1,
    };
  }
}
