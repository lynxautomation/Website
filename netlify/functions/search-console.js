exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const SUPABASE_URL = 'https://mjibtbfrtpxjmybvdbwc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qaWJ0YmZydHB4am15YnZkYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDQzMjYsImV4cCI6MjEwNDE4MDMyNn0.Fqd4W4GxX3nNz1nJ7umftTboEpoQFLTKu9NEld3n2RM';

  try {
    // ── 1. Sitzungs-Token SERVERSEITIG verifizieren, genau wie bei portal-chat.js ──
    const accessToken = event.queryStringParameters && event.queryStringParameters.token;
    if (!accessToken) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Nicht eingeloggt.' }) };
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': SUPABASE_ANON_KEY }
    });
    if (!userRes.ok) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sitzung ungültig oder abgelaufen.' }) };
    }
    const verifiedUser = await userRes.json();

    // ── 2. Domain AUSSCHLIESSLICH aus der verifizierten Kundenzeile holen,
    //    niemals aus einem vom Client mitgeschickten Parameter ─────────────────
    const custRes = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?user_id=eq.${verifiedUser.id}&select=domain`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': SUPABASE_ANON_KEY } }
    );
    const custRows = await custRes.json();
    const customerDomain = Array.isArray(custRows) && custRows[0] && custRows[0].domain;

    if (!customerDomain) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Keine Domain für dieses Konto hinterlegt.' }) };
    }

    const siteUrl = `https://${customerDomain.replace(/\/$/, '')}/`;

    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    creds.private_key = creds.private_key.replace(/\\n/g, '\n');

    const token = await getGoogleToken(creds);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28); // letzte 28 Tage
    const fmt = d => d.toISOString().split('T')[0];

    // Top-Suchbegriffe
    const queryRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['query'],
          rowLimit: 8
        })
      }
    );

    if (!queryRes.ok) {
      const err = await queryRes.text();
      throw new Error(`Search Console API Fehler: ${err}`);
    }
    const queryData = await queryRes.json();

    // Gesamtzahlen für den Zeitraum
    const totalsRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate) })
      }
    );
    const totalsData = totalsRes.ok ? await totalsRes.json() : { rows: [] };
    const totalsRow = totalsData.rows && totalsData.rows[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        period: { start: fmt(startDate), end: fmt(endDate) },
        queries: (queryData.rows || []).map(r => ({
          query: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
          position: Math.round(r.position * 10) / 10
        })),
        totals: totalsRow
          ? { clicks: totalsRow.clicks, impressions: totalsRow.impressions, position: Math.round(totalsRow.position * 10) / 10 }
          : { clicks: 0, impressions: 0, position: 0 }
      })
    };

  } catch (err) {
    console.error('Search Console Fehler:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function getGoogleToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(creds.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Kein Access Token: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}
