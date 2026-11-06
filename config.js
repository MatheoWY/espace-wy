// Configuration de l'espace virtuel Work&You (POC)
window.WY_CONFIG = {
  // ID client OAuth Google (type "Application Web"). Vide = mode test (connexion par prénom).
  GOOGLE_CLIENT_ID: '',
  // Seuls les comptes de ce domaine Google Workspace peuvent entrer.
  ALLOWED_DOMAIN: 'workandyou.fr',
  // Autoriser l'entrée sans SSO tant que GOOGLE_CLIENT_ID est vide (désactivé automatiquement sinon).
  ALLOW_TEST_MODE: true,
  // Agenda Google affiché dans l'amphithéâtre (ex : xxx@group.calendar.google.com). Vide = agenda du connecté.
  CALENDAR_ID: '',
  // Ne garder que les événements dont le titre contient ce mot (ex : 'nationale'). Vide = tous.
  AMPHI_KEYWORD: '',
  // Nom du salon : change-le pour créer un espace de test séparé.
  SPACE_ID: 'workandyou-poc',
  // Serveur de signalisation PeerJS : {} = broker public gratuit 0.peerjs.com
  PEER_SERVER: {},
  // Serveurs STUN/TURN (ajouter un TURN si certains réseaux d'entreprise bloquent la voix)
  ICE_SERVERS: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};
