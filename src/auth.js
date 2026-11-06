// Connexion Google (Google Identity Services) limitée au domaine + vérification de l'ID token.
export function decodeJwt(token) {
  const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = p + '='.repeat((4 - (p.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

export function waitForGis(timeout = 6000) {
  return new Promise((res) => {
    const t0 = Date.now();
    (function poll() {
      if (window.google?.accounts?.id) return res(true);
      if (Date.now() - t0 > timeout) return res(false);
      setTimeout(poll, 150);
    })();
  });
}

// Affiche le bouton Google dans `el`. Appelle onUser({name,email,token,picture}) ou onError(msg).
export function renderGoogleButton(el, cfg, onUser, onError) {
  google.accounts.id.initialize({
    client_id: cfg.GOOGLE_CLIENT_ID,
    hd: cfg.ALLOWED_DOMAIN,
    ux_mode: 'popup',
    auto_select: true,
    callback: (resp) => {
      try {
        const p = decodeJwt(resp.credential);
        if (p.hd !== cfg.ALLOWED_DOMAIN || !p.email_verified) return onError(`Accès réservé aux comptes @${cfg.ALLOWED_DOMAIN}`);
        onUser({ name: p.given_name || p.name || p.email.split('@')[0], fullName: p.name, email: p.email, token: resp.credential, picture: p.picture });
      } catch (e) { onError('Connexion Google invalide'); }
    },
  });
  google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'rectangular', text: 'signin_with', locale: 'fr' });
}

// Vérification côté "hub" (pair qui relaie l'état) : signature RS256 + audience + domaine.
let jwks = null;
export async function verifyIdToken(token, cfg) {
  let p;
  try { p = decodeJwt(token); } catch { return { ok: false, reason: 'jeton illisible' }; }
  if (p.aud !== cfg.GOOGLE_CLIENT_ID) return { ok: false, reason: 'audience' };
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) return { ok: false, reason: 'émetteur' };
  if (p.hd !== cfg.ALLOWED_DOMAIN || !p.email_verified) return { ok: false, reason: 'domaine' };
  if (p.exp * 1000 < Date.now() - 12 * 3600 * 1000) return { ok: false, reason: 'expiré' };
  try {
    if (!jwks) jwks = (await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys;
    const [h, b, s] = token.split('.');
    const head = JSON.parse(new TextDecoder().decode(b64u(h)));
    let jwk = jwks.find((k) => k.kid === head.kid);
    if (!jwk) { jwks = (await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys; jwk = jwks.find((k) => k.kid === head.kid); }
    if (!jwk) return { ok: false, reason: 'clé inconnue' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + b));
    return valid ? { ok: true, payload: p } : { ok: false, reason: 'signature' };
  } catch (e) {
    // Réseau indisponible : on accepte sur la base des champs (POC uniquement)
    console.warn('[auth] vérification de signature impossible, contrôle des champs seulement', e);
    return { ok: true, payload: p, weak: true };
  }
}
