# Espace Work&You — POC

Bureau virtuel 3D rétro pour le réseau Work&You : accueil avec canapés et télé, couloir vitré dépoli, salle de réunion/brainstorm, salle de prospection, amphithéâtre relié à Google Agenda + Meet, dressing pour personnaliser son avatar.

100 % statique (HTML/JS, three.js) : hébergeable gratuitement sur GitHub Pages. Pas de serveur à nous :
- **Signalisation** : broker public gratuit PeerJS (`0.peerjs.com`).
- **Voix, partage d'écran** : WebRTC en direct entre navigateurs.
- **État partagé** (positions, chat, post-it) : un navigateur est élu « hub » automatiquement. S'il part, un autre reprend en quelques secondes.
- **SSO** : Google Identity Services, vérification du domaine `hd` et de la signature de l'ID token par le hub.

> ⚠️ POC : architecture maillée pensée pour une quinzaine de testeurs. Pour 20 à 60 utilisateurs en production : LiveKit (SFU) + petit serveur Node (Colyseus) + vérification SSO côté serveur.

## Commandes
ZQSD/WASD/flèches : se déplacer · Maj : courir · clic-glisser : caméra · molette : zoom · **E** : s'asseoir / interagir · **M** : micro · **V** (maintenir) : chuchoter · Entrée : chat · P : pixellisation · H : aide.

## Règles audio
| Situation | Qui t'entend |
|---|---|
| Accueil / couloir | Proximité (pleine voix < 2 m, plus rien à 9 m) |
| Même canapé / même table | Tout le groupe |
| Réunion, dressing | Toute la pièce (les vitres isolent) |
| Prospection, poste d'appel | Toute la salle entend l'appelant ; l'appelant n'entend pas la salle |
| Amphi | Proximité ; sur scène : toute la salle |
| Mode « en visio » (amphi) | Personne, sauf en maintenant V (chuchotement ~3 m) |

## Déploiement GitHub Pages
1. Pousser ce dossier sur un dépôt **public** (Pages gratuit) ou privé avec un plan payant.
2. Settings → Pages → Source : `Deploy from a branch` → `main` / `/ (root)`.
3. L'URL est `https://<compte>.github.io/<depot>/`.

## Activer le SSO Google (@workandyou.fr)
1. Google Cloud Console (avec un compte admin workandyou.fr) → nouveau projet « Espace WY ».
2. **Écran de consentement OAuth** → type **Interne** (seuls les comptes du domaine peuvent se connecter).
3. **Identifiants → Créer → ID client OAuth → Application Web**.
   - Origines JavaScript autorisées : `https://<compte>.github.io`
4. Activer l'**API Google Calendar** (pour l'amphi).
5. Dans `config.js` : `GOOGLE_CLIENT_ID: 'xxxx.apps.googleusercontent.com'`. Le mode test (connexion par prénom) se désactive automatiquement.
6. Amphi : `CALENDAR_ID` = l'agenda partagé des réunions nationales (ex. `xxx@group.calendar.google.com`) et éventuellement `AMPHI_KEYWORD`.

## Tests en local
```
python3 -m http.server 8080
# serveur PeerJS local (optionnel) : npx peerjs --port 9000 --path /peer
# puis http://localhost:8080/?peer=local
```
Paramètres d'URL : `?salle=xxx` (salon séparé), `?solo` (sans réseau), `?bots=1` (bots de démo).

## Limites connues du POC
- Sans serveur TURN, certains réseaux d'entreprise stricts peuvent bloquer la voix (ajouter un TURN dans `ICE_SERVERS`).
- Le hub est un navigateur : s'il a une mauvaise connexion, tout le monde le ressent.
- Google Meet ne peut pas être intégré dans la page : il s'ouvre dans un onglet à côté.
- Casque fortement conseillé (écho).
