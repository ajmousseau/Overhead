// netlify/functions/airlabs.js — shared AirLabs lookup (CommonJS, blobs optional)
const ALLOWED = ['https://inspiring-chimera-6095cd.netlify.app'];
const KEY = '7b14d0aa-9dbb-45cc-bcd0-31acac5a4e38';
const MONTHLY_BUDGET = 24000;

// Blobs if available; otherwise warm-instance memory cache
let store = null;
try {
  const { getStore } = require('@netlify/blobs');
  store = getStore('routes');
} catch (e) { /* dependency absent: memory only */ }
const mem = {};

async function cacheGet(k) {
  if (store) { try { return await store.get(k, { type: 'json' }); } catch (e) {} }
  return mem[k] || null;
}
async function cacheSet(k, v) {
  if (store) { try { await store.setJSON(k, v); return; } catch (e) {} }
  mem[k] = v;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.referer || '';
  if (origin && !ALLOWED.some(a => origin.startsWith(a)))
    return resp(403, { error: 'forbidden' });

  const cs = (event.queryStringParameters?.cs || '').toUpperCase();
  if (!/^[A-Z]{2,3}\d[A-Z0-9]*$/.test(cs)) return resp(200, { route: null, why: 'bad-cs' });

  const cached = await cacheGet(cs);
  if (cached && cached.t > Date.now() - 30 * 86400000)
    return resp(200, { route: cached.r, cached: true });

  const month = new Date().toISOString().slice(0, 7);
  const budget = (await cacheGet('budget_' + month)) || { n: 0 };
  if (budget.n >= MONTHLY_BUDGET) return resp(200, { route: null, why: 'budget' });

  let route = null, why = 'airlabs-empty';
  try {
    const r = await fetch(`https://airlabs.co/api/v9/flight?flight_icao=${cs}&api_key=${KEY}`);
    if (r.ok) {
      const d = await r.json();
      if (d.error) why = 'airlabs-error:' + (d.error.message || d.error.code || 'unknown');
      const f = d.response;
      if (f?.dep_iata && f?.arr_iata) { route = { from: f.dep_iata, to: f.arr_iata }; why = 'ok'; }
    } else why = 'airlabs-http-' + r.status;
  } catch (e) { why = 'airlabs-fetch-fail'; }

  budget.n++;
  await cacheSet('budget_' + month, budget);
  await cacheSet(cs, { r: route, t: route ? Date.now() : Date.now() - (30 * 86400000 - 3600000) });

  return resp(200, { route, why, spent: budget.n });
};

function resp(status, body) {
  return { statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED[0] },
    body: JSON.stringify(body) };
}
