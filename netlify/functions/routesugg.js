// netlify/functions/routesugg.js — real routes for an airline (LogoStream Routes API)
// GET ?iata=DL  ->  {routes:[{from,to},...]}   (cached per warm instance)
const ALLOWED = ['https://inspiring-chimera-6095cd.netlify.app'];
const KEY = 'T1-D428EF60-6B96-4389-A9B1-E9826B797716';
const cache = {};   // survives while the function instance is warm

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.referer || '';
  if (origin && !ALLOWED.some(a => origin.startsWith(a))) return { statusCode: 403, body: 'Forbidden' };
  const iata = (event.queryStringParameters?.iata || '').toUpperCase();
  if (!/^[A-Z0-9]{2}$/.test(iata)) return { statusCode: 400, body: 'iata required' };

  if (cache[iata] && cache[iata].t > Date.now() - 86400000) {
    return ok(cache[iata].routes);
  }
  try {
    const r = await fetch(`https://aviation-api.logostream.dev/v1/routes?airlineIata=${iata}&perPage=100`,
      { headers: { 'x-api-key': KEY } });
    if (!r.ok) return ok([]);   // wrong tier / no access: client falls back to hub guesses
    const d = await r.json();
    const routes = (d.data || [])
      .filter(x => x.departure_iata && x.arrival_iata)
      .map(x => ({ from: x.departure_iata, to: x.arrival_iata }));
    cache[iata] = { routes, t: Date.now() };
    return ok(routes);
  } catch (e) { return ok([]); }

  function ok(routes) {
    return { statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED[0] },
      body: JSON.stringify({ routes }) };
  }
};
