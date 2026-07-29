/**
 * ideas.js — Boîte à idées (côté jeu).
 * Un bouton 💡 ouvre un petit formulaire ; l'idée est envoyée au serveur (POST /idee),
 * qui l'ajoute dans V2/serveur/idees.txt.
 *
 * Ne marche que pendant une partie hébergée par le PC (il faut le serveur pour recevoir).
 * Sur le lien public statique, l'envoi échoue proprement avec un petit message.
 * (En doublon avec les Discussions GitHub, comme demandé.)
 */

/** @param {() => string} getPseudo  fournit le prénom courant du joueur */
export function installerBoiteAIdees(getPseudo) {
  const btn = document.getElementById('btnIdee');
  const dlg = document.getElementById('dlgIdee');
  const txt = document.getElementById('idText');
  const etat = document.getElementById('idEtat');

  btn.style.display = 'block';
  btn.onclick = () => { etat.textContent = ''; txt.value = ''; dlg.showModal(); };
  document.getElementById('idFermer').onclick = () => dlg.close();

  document.getElementById('idEnvoi').onclick = async () => {
    const texte = txt.value.trim();
    if (!texte) { dlg.close(); return; }
    etat.textContent = 'Envoi…';
    try {
      const r = await fetch('/idee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: getPseudo() || '?', texte }),
      });
      if (r.ok) { etat.textContent = 'Merci, idée envoyée ! 💡'; setTimeout(() => dlg.close(), 900); }
      else etat.textContent = 'Envoi impossible (le jeu doit être lancé depuis le PC).';
    } catch (e) {
      etat.textContent = 'Envoi impossible (le jeu doit être lancé depuis le PC).';
    }
  };
}
