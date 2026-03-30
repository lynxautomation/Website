const { google } = require("googleapis");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    const { vorname, nachname, email, telefon, unternehmen, thema, nachricht, einwilligung } = data;

    // Service Account aus Environment Variable laden
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const datum = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    const name = `${vorname} ${nachname}`.trim();

    // Zeile in Google Sheet eintragen
    // Spalten: A: Datum | B: Name | C: Telefon | D: E-Mail | E: Thema | F: Anliegen | G: Einwilligung
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Leads!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[datum, name, telefon || "–", email, thema, nachricht || "–", einwilligung ? "Ja" : "Nein"]],
      },
    });

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
