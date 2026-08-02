// netlify/functions/fr24.js — resolve a callsign near lat/lon to FR24's flight id
exports.handler = async (event) => {
  const { lat, lon, cs } = event.queryStringParameters || {};
  if (!lat || !lon || !cs) return { statusCode: 400, body: 'Missing lat/lon/cs' };
  const la = parseFloat(lat), lo = parseFloat(lon);
  // bounds = north,south,west,east
  const bounds = `${(la+0.4).toFixed(3)},${(la-0.4).toFixed(3)},${(lo-0.6).toFixed(3)},${(lo+0.6).toFixed(3)}`;
  const url = `https://data-cloud.flightradar24.com/zones/fcgi/feed.js?bounds=${bounds}&faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=0&air=1&vehicles=0&estimated=1&maxage=14400&gliders=0&stats=0`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' } });
    if (!r.ok) throw new Error('feed ' + r.status);
    const d = await r.json();
    const want = cs.trim().toUpperCase();
    let found = null;
    for (const [key, v] of Object.entries(d)) {
      if (!Array.isArray(v) || v.length < 17) continue;
      const callsign = String(v[16] || '').toUpperCase();
      const flightNo = String(v[13] || '').toUpperCase();
      if (callsign === want || flightNo === want) { found = key; break; }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ id: found }),
    };
  } catch (err) {
    return { statusCode: 502, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};
