// netlify/functions/routes.js — full tiered route resolution, server-side
// POST {planes:[{callsign,lat,lng}]} -> {routes:{CALLSIGN:{from,to}}}
// Tier 1: adsb.lol routeset (batch). Tier 2: hexdb.io per straggler.
const ALLOWED = ['https://inspiring-chimera-6095cd.netlify.app'];

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.referer || '';
  if (origin && !ALLOWED.some(a => origin.startsWith(a))) return { statusCode: 403, body: 'Forbidden' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };

  let planes = [];
  try { planes = (JSON.parse(event.body || '{}').planes || []).slice(0, 10); } catch (e) {}
  const routes = {};

  // ── Tier 1: routeset batch ──
  try {
    const r = await fetch('https://api.adsb.lol/api/0/routeset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planes }),
    });
    if (r.ok) {
      const d = await r.json();
      (Array.isArray(d) ? d : []).forEach(e => {
        const cs = (e.callsign || '').toUpperCase();
        if (e.plausible === 0 || e.plausible === false) return;
        let codes = (e._airport_codes_iata || '').split('-').filter(c => c && c !== 'unknown');
        if (codes.length < 2) return;
        let from = codes[0], to = codes[codes.length - 1];
        if (from === to && codes.length >= 3) to = codes[1];
        if (from !== to) routes[cs] = { from, to };
      });
    }
  } catch (e) {}

  // ── Tier 2: hexdb for anything still unknown ──
  const conv = c => (c.length === 4 && (c[0] === 'K' || c[0] === 'C')) ? c.slice(1) : c;
  for (const p of planes) {
    const cs = (p.callsign || '').toUpperCase();
    if (routes[cs]) continue;
    try {
      const r = await fetch(`https://hexdb.io/api/v1/route/icao/${encodeURIComponent(cs)}`);
      if (!r.ok) continue;
      const d = await r.json();
      const codes = (d.route || '').split('-').filter(Boolean);
      if (codes.length >= 2) {
        let f = conv(codes[0]), t = conv(codes[codes.length - 1]);
        if (f === t && codes.length >= 3) t = conv(codes[1]);
        if (f !== t) routes[cs] = { from: f, to: t };
      }
    } catch (e) {}
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED[0] },
    body: JSON.stringify({ routes }),
  };
};
