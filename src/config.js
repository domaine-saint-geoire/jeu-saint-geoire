/**
 * config.js — Constantes du jeu, centralisées et documentées.
 *
 * Tout ce qui se règle est ici (et pas éparpillé dans le code) : encodage de la
 * carte, échelle du monde, réglages du joueur et du rendu.
 */

/** Paramètres liés aux DEUX images de la carte et à leur encodage. */
export const CARTE = {
  // Fichiers chargés à l'exécution (externes = modifiables sans toucher au code).
  // Chemins relatifs à index.html.
  IMAGE_SATELLITE: './carte/SatView.jpg',    // habillage visuel du sol, drapé sur le relief
  IMAGE_DONNEES:   './carte/Alti+Zones.png', // altitudes (Rouge) + zones (Bleu), PNG SANS PERTE obligatoire

  // --- Altitudes : canal Rouge de l'image de données ---
  ALT_MIN_M: 429.61,   // altitude réelle (m) quand Rouge = 0   (point le plus bas)
  ALT_MAX_M: 488.96,   // altitude réelle (m) quand Rouge = 255 (point le plus haut)
  ROUGE_TERRASSE: 140, // valeur de Rouge = niveau de la terrasse = hauteur 0 en jeu

  // --- Zones : canal Bleu de l'image de données (lecture par bits) ---
  BIT_LIMITE_TERRAIN: 0, // bit 0 : hors des limites du terrain -> message d'avertissement (on peut marcher)
  BIT_LIMITE_JEU:     1, // bit 1 : zone bloquée -> mur invisible (on ne peut pas entrer)
  // Bits restants (tout le Vert + Bleu bits 2..7) : réservés à de futures zones (herbe, gravier…).
};

/** Étendue verticale de la carte, en mètres (max - min = 59.35 m). */
export const ALT_ETENDUE_M = CARTE.ALT_MAX_M - CARTE.ALT_MIN_M;

/**
 * Taille réelle du carré de terrain, en mètres.
 * ≈ 250 m d'après la source. C'est l'échelle HORIZONTALE : elle fixe la raideur
 * ressentie des pentes. Si tout paraît trop (ou pas assez) raide, ajuster ici.
 */
export const TAILLE_MONDE_M = 250;

/** Réglages de construction du monde. */
export const MONDE = {
  TAILLE_M: TAILLE_MONDE_M,
  // Finesse du maillage du terrain (subdivisions par côté).
  // Plus grand = relief plus fin mais plus lourd. À baisser pour le mobile.
  SUBDIVISIONS: 250,
};

/** Réglages du joueur (unités : mètres et m/s). */
export const JOUEUR = {
  HAUTEUR_YEUX_M: 1.7,     // hauteur des yeux au-dessus du sol
  VITESSE_MARCHE: 4.5,     // vitesse normale
  VITESSE_COURSE: 9.0,     // vitesse touche Maj
  SENSIBILITE_SOURIS: 0.0022,
};

/** Réglages du rendu (caméra, ciel, distance de vue). */
export const RENDU = {
  FOV: 70,                 // champ de vision (degrés)
  DISTANCE_VUE_M: 700,     // distance max avant le brouillard/clip
  COULEUR_CIEL: 0x9fc6e8,  // bleu ciel (fond + brouillard)
};
