// netlify/functions/airlabs.js — shared AirLabs route lookup
// Blob-cached 30 days across ALL devices + monthly budget guard.
import { getStore } from "@netlify/blobs";

const ALLOWED = ['https://inspiring-chimera-6095cd.netlify.app'];
const KEY = '7b14d0aa-9dbb-45cc-bcd0-31acac5a4e38';
const MONTHLY_BUDGET = 950;   // stop before the 1,000 cap

export default async (req) => {
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  if (origin && !ALLOWED.some(a => origin.startsWith(a)))
    return new Response('Forbidden', { status: 403 });

  const url = new URL(req.url);
  const cs = (url.searchParams.get('cs') || '').toUpperCase();
  if (!/^[A-Z]{2,3}\d[A-Z0-9]*$/.test(cs)) return json({ route: null });

  const store = getStore('routes');

  // Cache hit? (30-day TTL)
  const cached = await store.get(cs, { type: 'json' }).catch(() => null);
  if (cached && cached.t > Date.now() - 30 * 86400000) {
    return json({ route: cached.r, cached: true });
  }

  // Budget check
  const month = new Date().toISOString().slice(0, 7);
  const budget = (await store.get('budget_' + month, { type: 'json' }).catch(() => null)) || { n: 0 };
  if (budget.n >= MONTHLY_BUDGET) return json({ route: null, budget: 'exhausted' });

  // AirLabs call
  let route = null;
  try {
    const r = await fetch(`https://airlabs.co/api/v9/flight?flight_icao=${cs}&api_key=${KEY}`);
    if (r.ok) {
      const d = await r.json();
      const f = d.response;
      if (f?.dep_iata && f?.arr_iata) route = { from: f.dep_iata, to: f.arr_iata };
    }
  } catch (e) {}

  budget.n++;
  await store.setJSON('budget_' + month, budget).catch(() => {});
  // Cache even nulls briefly (12h) so unknowns don't drain budget all day
  await store.setJSON(cs, { r: route, t: route ? Date.now() : Date.now() - 29.5 * 86400000 }).catch(() => {});

  return json({ route, spent: budget.n });
};

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED[0] },
  });
}
