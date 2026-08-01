// Netlify serverless proxy — avoids browser CORS on adsb.lol
// Place at: netlify/functions/flights.js in your GitHub repo
// Netlify calls it at: /.netlify/functions/flights?lat=42.87&lon=-85.67&radius=50

exports.handler = async (event) => {
  const { lat, lon, radius = '50' } = event.queryStringParameters || {};
  if (!lat || !lon) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing lat or lon' }) };
  }
  try {
    const r    = await fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radius}`);
    const body = await r.text();
    return {
      statusCode: r.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body,
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};
