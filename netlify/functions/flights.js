// netlify/functions/flights.js — adsb.lol proxy, origin-restricted
const ALLOWED = ['https://inspiring-chimera-6095cd.netlify.app'];
exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.referer || '';
  const ok = ALLOWED.some(a => origin.startsWith(a)) || !origin; // same-origin fetches may omit Origin
  if (!ok) return { statusCode: 403, body: 'Forbidden' };
  const { lat, lon, radius = '50' } = event.queryStringParameters || {};
  if (!lat || !lon) return { statusCode: 400, body: 'Missing lat/lon' };
  try {
    const r = await fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radius}`);
    const body = await r.text();
    return { statusCode: r.status,
      headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin': ALLOWED[0] },
      body };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};
