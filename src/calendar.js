// Agenda de l'amphithéâtre : Google Calendar API (lecture seule) ou agenda de démonstration.
export function demoAgenda() {
  const now = Date.now(), H = 3600e3;
  const at = (dayOffset, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); };
  return [
    { title: 'Réunion nationale — point réseau (démo)', start: now - 10 * 60e3, end: now + 50 * 60e3, meet: 'https://meet.google.com/', demo: true },
    { title: 'Formation Nicoka : la CVthèque', start: at(1, 10), end: at(1, 11), meet: 'https://meet.google.com/', demo: true },
    { title: 'Webinaire prospection PME', start: at(2, 14, 30), end: at(2, 15, 30), meet: 'https://meet.google.com/', demo: true },
  ].map((e) => ({ ...e, start: e.start, end: e.end || e.start + H }));
}

export function requestCalendarToken(cfg, email) {
  return new Promise((res, rej) => {
    if (!window.google?.accounts?.oauth2) return rej(new Error('Google Identity non chargé'));
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: cfg.GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      hint: email, prompt: '',
      callback: (r) => (r.error ? rej(new Error(r.error)) : res(r.access_token)),
      error_callback: (e) => rej(new Error(e.type || 'refus')),
    });
    tc.requestAccessToken();
  });
}

export async function fetchAgenda(cfg, accessToken) {
  const cal = encodeURIComponent(cfg.CALENDAR_ID || 'primary');
  const tMin = new Date(Date.now() - 3 * 3600e3).toISOString();
  const tMax = new Date(Date.now() + 14 * 24 * 3600e3).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?singleEvents=true&orderBy=startTime&maxResults=25&timeMin=${tMin}&timeMax=${tMax}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!r.ok) throw new Error('Agenda inaccessible (' + r.status + ')');
  const j = await r.json();
  const kw = (cfg.AMPHI_KEYWORD || '').toLowerCase();
  return (j.items || [])
    .map((e) => ({
      title: e.summary || '(sans titre)',
      start: Date.parse(e.start?.dateTime || e.start?.date),
      end: Date.parse(e.end?.dateTime || e.end?.date),
      meet: e.hangoutLink || e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || null,
    }))
    .filter((e) => e.end > Date.now() && (!kw || e.title.toLowerCase().includes(kw)));
}

export function currentAndNext(events) {
  const now = Date.now();
  const cur = events.find((e) => e.start - 15 * 60e3 <= now && e.end > now) || null;
  const next = events.filter((e) => e !== cur && e.start > now).slice(0, 3);
  return { cur, next };
}
export const fmtTime = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const fmtDay = (t) => {
  const d = new Date(t), today = new Date();
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (d.toDateString() === tm.toDateString()) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};
