/**
 * Lynx Automation Solutions – Lead Function
 * Netlify Function: netlify/functions/lead.js
 * Keine externen Dependencies – läuft mit Node.js built-ins + fetch
 */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    const { vorname, nachname, email, telefon, unternehmen, thema, nachricht, einwilligung } = data;

    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const sheetId        = process.env.GOOGLE_SHEET_ID;

    // ── JWT Access Token holen ─────────────────────────────────────────────
    const token = await getAccessToken(serviceAccount);

    // ── Zeile aufbauen ────────────────────────────────────────────────────
    const datum = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    const name  = `${vorname || ""} ${nachname || ""}`.trim();

    // Spalten: A: Datum | B: Name | C: Telefon | D: E-Mail | E: Thema | F: Anliegen | G: Einwilligung
    const row = [
      datum,
      name,
      telefon      || "–",
      email        || "–",
      thema        || "–",
      nachricht    || "–",
      einwilligung ? "Ja" : "Nein",
    ];

    // ── In Google Sheet schreiben ─────────────────────────────────────────
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Leads!A:G:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets API: ${res.status} – ${err}`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };

  } catch (err) {
    console.error("lead.js Fehler:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};

// ── JWT Helper (ohne googleapis) ──────────────────────────────────────────
async function getAccessToken(sa) {
  const now    = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim  = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));

  const signingInput = `${header}.${claim}`;
  const signature    = await rsaSign(signingInput, sa.private_key);
  const jwt          = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const json = await res.json();
  if (!json.access_token) throw new Error("Token-Fehler: " + JSON.stringify(json));
  return json.access_token;
}

function b64url(str) {
  return Buffer.from(str).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function rsaSign(data, pemKey) {
  const crypto  = require("crypto");
  const sign    = crypto.createSign("RSA-SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign(pemKey);
  return sig.toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
