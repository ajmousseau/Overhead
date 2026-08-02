// netlify/functions/fr24.js — resolve a flight to FR24's internal id
// Primary match: Mode-S hex (exact, hardware-level). Fallback: callsign / IATA flight no.
exports.handler = async (event) => {
  const { lat, lon, cs, hex } = event.queryStringParameters || {};
  if (!lat || !lon) return { statusCode: 400, body: 'Missing lat/lon' };
  const la = parseFloat(lat), lo = parseFloat(lon);
  const bounds = `${(la+0.4).toFixed(3)},${(la-0.4).toFixed(3)},${(lo-0.6).toFixed(3)},${(lo+0.6).toFixed(3)}`;
  const url = `https://data-cloud.flightradar24.com/zones/fcgi/feed.js?bounds=${bounds}&faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=0&air=1&vehicles=0&estimated=1&maxage=14400&gliders=0&stats=0`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' } });
    if (!r.ok) throw new Error('feed ' + r.status);
    const d = await r.json();
    const wantHex = (hex || '').trim().toLowerCase();
    const wantCs  = (cs  || '').trim().toUpperCase();
    let byHex = null, byName = null;
    for (const [key, v] of Object.entries(d)) {
      if (!Array.isArray(v) || v.length < 17) continue;
      const fHex = String(v[0] || '').toLowerCase();
      const callsign = String(v[16] || '').toUpperCase();
      const flightNo = String(v[13] || '').toUpperCase();
      if (wantHex && fHex === wantHex) { byHex = key; break; }
      if (wantCs && !byName && (callsign === wantCs || flightNo === wantCs)) byName = key;
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ id: byHex || byName }),
    };
  } catch (err) {
    return { statusCode: 502, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};
