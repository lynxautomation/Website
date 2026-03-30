/**
 * Lynx Automation Solutions – Chatbot Widget
 * Einbindung: <script src="lynx-chatbot.js"></script> vor </body>
 * Kein weiterer Setup-Aufwand erforderlich.
 */

(function () {
  const CHAT_API = "/.netlify/functions/chat";


  const SYSTEM_PROMPT = `Du bist der KI-Assistent von Lynx Automation Solutions – einem Unternehmen, das intelligente Chatbot-Lösungen für Unternehmenswebsites entwickelt.

Deine Aufgabe: Besucher freundlich und professionell informieren, Vertrauen aufbauen und Demo-Anfragen generieren.

=== LEISTUNGSMODELLE ===

Modell 1 – Intelligenter Webchat:
- FAQ-Bot mit wöchentlicher Wissensbasis-Aktualisierung
- DSGVO-konform, Datenhaltung in Deutschland
- Nahtlose Integration in bestehende Websites
- Ideal für Unternehmen, die Kundenanfragen automatisieren möchten
- Preis: Einrichtungspauschale + monatliche Servicegebühr

Modell 2 – Chat + Lead Engine:
- Alle Funktionen von Modell 1
- Zusätzlich: Automatische Lead-Erfassung in Echtzeit
- Leads landen direkt in Google Sheets (Name, E-Mail, Interesse)
- Keine manuelle Nachbearbeitung, kein Lead geht verloren
- Ideal für Unternehmen mit aktivem Vertrieb

=== EINRICHTUNGSPROZESS ===
1. Erstgespräch & Bedarfsanalyse (kostenlos, ~30 Min.)
2. Individuelle Konfiguration des Chatbots auf Ihre Inhalte
3. Technische Integration in Ihre Website
4. Test-Phase & Feinabstimmung
5. Go-Live + laufender Support

=== KONTAKT ===
E-Mail: info@lynx-automation.de

=== LEAD-ERFASSUNG ===
Wenn ein Besucher eine Demo anfragen möchte oder Kontakt aufnehmen will, antworte kurz und freundlich und schreibe am Ende deiner Antwort EXAKT diesen Tag (nichts weglassen, nichts verändern):
<<<SHOW_LEAD_FORM>>>

Das System zeigt dann automatisch ein Kontaktformular an. Du musst NICHT nach Name, E-Mail oder Anliegen fragen – das übernimmt das Formular.

=== TONALITÄT ===
- Professionell, modern, auf Augenhöhe
- Klar und prägnant (keine langen Monologe)
- Deutsch, Du-Form erlaubt wenn der Besucher es vorgibt
- Begeistere für KI-Automatisierung, ohne zu übertreiben
- Verwende KEIN Markdown wie #, ##, --- in deinen Antworten
- Für Aufzählungen nutze einfache Zahlen (1. 2. 3.) ohne ** drum herum
- Fett (**text**) nur sparsam für wirklich wichtige Begriffe`;

  // ── STATE ─────────────────────────────────────────────────────────────────
  let messages = [];
  let isOpen = false;
  let isTyping = false;
  let leadCaptured = false;
  let greeted = false;

  // ── STYLES ───────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

    #lynx-chat-root * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }

    /* BUBBLE */
    #lynx-bubble {
      position: fixed; bottom: 28px; right: 90px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #5b3fa0 0%, #7c5cc4 100%);
      box-shadow: 0 4px 24px rgba(91,63,160,0.55), 0 0 0 0 rgba(124,92,196,0.4);
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: lynx-pulse 3s ease-in-out infinite;
    }
    #lynx-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(91,63,160,0.7), 0 0 0 6px rgba(124,92,196,0.15);
    }
    @keyframes lynx-pulse {
      0%, 100% { box-shadow: 0 4px 24px rgba(91,63,160,0.55), 0 0 0 0 rgba(124,92,196,0.4); }
      50% { box-shadow: 0 4px 24px rgba(91,63,160,0.55), 0 0 0 10px rgba(124,92,196,0); }
    }
    #lynx-bubble svg { width: 28px; height: 28px; }

    /* WINDOW */
    #lynx-window {
      position: fixed; bottom: 100px; right: 90px; z-index: 99998;
      width: 380px; max-width: calc(100vw - 40px);
      height: 560px; max-height: calc(100vh - 130px);
      background: #0d1b3e;
      border: 1px solid rgba(179,157,219,0.18);
      border-radius: 18px;
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,63,160,0.2);
      transform-origin: bottom right;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
      opacity: 0; transform: scale(0.85) translateY(12px); pointer-events: none;
    }
    #lynx-window.open { opacity: 1; transform: scale(1) translateY(0); pointer-events: all; }

    /* HEADER */
    #lynx-header {
      padding: 16px 18px;
      background: linear-gradient(135deg, rgba(91,63,160,0.3) 0%, rgba(22,36,84,0.8) 100%);
      border-bottom: 1px solid rgba(179,157,219,0.12);
      display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    #lynx-header-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #5b3fa0, #7c5cc4);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 12px rgba(91,63,160,0.5);
    }
    #lynx-header-avatar svg { width: 20px; height: 20px; }
    #lynx-header-info { flex: 1; }
    #lynx-header-name { font-size: 14px; font-weight: 500; color: #f5f3ff; line-height: 1.2; }
    #lynx-header-status { font-size: 11px; color: #9d7fe0; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
    #lynx-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4cda64; display: inline-block; box-shadow: 0 0 5px #4cda64; }
    #lynx-close {
      background: none; border: none; cursor: pointer;
      color: rgba(160,160,184,0.7); padding: 4px; border-radius: 6px;
      transition: color 0.15s, background 0.15s;
      display: flex; align-items: center;
    }
    #lynx-close:hover { color: #f5f3ff; background: rgba(255,255,255,0.07); }

    /* MESSAGES */
    #lynx-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #lynx-messages::-webkit-scrollbar { width: 4px; }
    #lynx-messages::-webkit-scrollbar-track { background: transparent; }
    #lynx-messages::-webkit-scrollbar-thumb { background: rgba(124,92,196,0.3); border-radius: 2px; }

    .lynx-msg { display: flex; flex-direction: column; max-width: 85%; animation: lynx-fade-in 0.2s ease; }
    @keyframes lynx-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .lynx-msg.bot { align-self: flex-start; }
    .lynx-msg.user { align-self: flex-end; }

    .lynx-bubble-text {
      padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.55;
    }
    .bot .lynx-bubble-text {
      background: rgba(22,36,84,0.75);
      border: 1px solid rgba(179,157,219,0.13);
      color: #e8e4ff;
      border-bottom-left-radius: 4px;
    }
    .user .lynx-bubble-text {
      background: linear-gradient(135deg, #5b3fa0, #7c5cc4);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .lynx-msg-time { font-size: 10px; color: rgba(160,160,184,0.5); margin-top: 3px; padding: 0 4px; }
    .lynx-privacy { font-size: 11px; color: #888880; background: rgba(22,36,84,0.4); border: 1px solid rgba(179,157,219,0.08); border-radius: 10px; padding: 8px 12px; align-self: flex-start; line-height: 1.5; max-width: 90%; animation: lynx-fade-in 0.2s ease; }
    .lynx-privacy a { color: #7c5cc4; text-decoration: underline; }
    .bot .lynx-msg-time { align-self: flex-start; }
    .user .lynx-msg-time { align-self: flex-end; }

    /* TYPING */
    #lynx-typing {
      display: none; align-self: flex-start; padding: 10px 14px;
      background: rgba(22,36,84,0.75); border: 1px solid rgba(179,157,219,0.13);
      border-radius: 14px; border-bottom-left-radius: 4px; gap: 5px; align-items: center;
    }
    #lynx-typing.show { display: flex; animation: lynx-fade-in 0.2s ease; }
    .lynx-dot { width: 6px; height: 6px; border-radius: 50%; background: #7c5cc4; animation: lynx-bounce 1.2s ease-in-out infinite; }
    .lynx-dot:nth-child(2) { animation-delay: 0.2s; }
    .lynx-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lynx-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }

    /* CHIPS */
    #lynx-chips {
      padding: 0 14px 10px; display: flex; flex-wrap: wrap; gap: 7px; flex-shrink: 0;
    }
    .lynx-chip {
      padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 400;
      background: rgba(91,63,160,0.15); border: 1px solid rgba(124,92,196,0.35);
      color: #b39ddb; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
      font-family: 'DM Sans', sans-serif;
    }
    .lynx-chip:hover { background: rgba(91,63,160,0.35); border-color: rgba(124,92,196,0.7); color: #f5f3ff; }

    /* INPUT AREA */
    #lynx-input-area {
      padding: 12px 14px; border-top: 1px solid rgba(179,157,219,0.1);
      display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
      background: rgba(13,27,62,0.6);
    }
    #lynx-input {
      flex: 1; background: rgba(22,36,84,0.7); border: 1px solid rgba(124,92,196,0.25);
      border-radius: 12px; padding: 9px 12px; font-size: 13px; color: #f5f3ff;
      outline: none; resize: none; font-family: 'DM Sans', sans-serif;
      line-height: 1.4; height: 38px; max-height: 90px; overflow-y: auto;
      transition: border-color 0.15s;
    }
    #lynx-input::placeholder { color: rgba(160,160,184,0.5); }
    #lynx-input:focus { border-color: rgba(124,92,196,0.6); }
    #lynx-send {
      width: 38px; height: 38px; border-radius: 10px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #5b3fa0, #7c5cc4);
      color: #fff; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s, transform 0.15s; flex-shrink: 0;
    }
    #lynx-send:hover { opacity: 0.88; transform: scale(0.97); }
    #lynx-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }


    /* ── LEAD FORM ──────────────────────────────────────────── */
    #lynx-chat-root .lynx-lead-form {
      background: rgba(22,36,84,0.9); border: 1px solid rgba(124,92,196,0.25);
      border-radius: 14px; padding: 14px; margin: 4px 0;
      display: flex; flex-direction: column; gap: 9px;
      align-self: flex-start; width: 100%;
      animation: lynx-fade-in 0.25s ease;
    }
    #lynx-chat-root .lynx-lead-form-title {
      font-size: 13px; font-weight: 500; color: #b39ddb; margin-bottom: 2px;
    }
    #lynx-chat-root .lynx-lead-form input,
    #lynx-chat-root .lynx-lead-form textarea {
      width: 100% !important; padding: 8px 10px !important;
      border: 1px solid rgba(124,92,196,0.25) !important; border-radius: 8px !important;
      font-family: 'DM Sans', sans-serif !important; font-size: 12.5px !important;
      background: rgba(13,27,62,0.85) !important; color: #f5f3ff !important;
      outline: none !important; transition: border-color .2s !important;
      resize: none !important; box-shadow: none !important;
      line-height: 1.4 !important; height: auto !important;
    }
    #lynx-chat-root .lynx-lead-form textarea {
      min-height: 62px !important; max-height: 62px !important;
    }
    #lynx-chat-root .lynx-lead-form input::placeholder,
    #lynx-chat-root .lynx-lead-form textarea::placeholder { color: rgba(160,160,184,0.45) !important; }
    #lynx-chat-root .lynx-lead-form input:focus,
    #lynx-chat-root .lynx-lead-form textarea:focus { border-color: rgba(124,92,196,0.6) !important; }
    #lynx-chat-root .lynx-consent-row {
      display: flex !important; align-items: flex-start !important; gap: 8px !important;
      background: rgba(91,63,160,0.15) !important; border-radius: 8px !important;
      padding: 9px 10px !important;
    }
    #lynx-chat-root .lynx-consent-row input[type="checkbox"] {
      width: 14px !important; height: 14px !important; flex-shrink: 0 !important;
      margin-top: 2px !important; accent-color: #7c5cc4 !important;
      cursor: pointer !important; padding: 0 !important;
    }
    #lynx-chat-root .lynx-consent-row label {
      font-size: 10.5px !important; color: #888880 !important;
      line-height: 1.5 !important; cursor: pointer !important;
      text-transform: none !important; font-weight: 400 !important;
      letter-spacing: 0 !important;
    }
    #lynx-chat-root .lynx-consent-row a { color: #7c5cc4 !important; text-decoration: underline !important; }
    #lynx-chat-root .lynx-lead-form-btn {
      background: linear-gradient(135deg, #5b3fa0, #7c5cc4) !important;
      color: #fff !important; border: none !important; border-radius: 9px !important;
      padding: 9px !important; font-family: 'DM Sans', sans-serif !important;
      font-size: 13px !important; font-weight: 600 !important;
      cursor: pointer !important; transition: opacity .2s !important;
      width: 100% !important; text-transform: none !important; letter-spacing: 0 !important;
    }
    #lynx-chat-root .lynx-lead-form-btn:disabled { opacity: .45 !important; cursor: not-allowed !important; }
    #lynx-chat-root .lynx-lead-form-btn:not(:disabled):hover { opacity: 0.85 !important; }
    #lynx-chat-root .lynx-lead-form-success {
      font-size: 12px !important; color: #7defa0 !important;
      text-align: center !important; padding: 6px 0 !important;
    }

    /* LEAD NOTIFICATION */
    #lynx-lead-toast {
      display: none; margin: 0 14px 8px;
      padding: 10px 13px; border-radius: 10px;
      background: rgba(76,218,100,0.12); border: 1px solid rgba(76,218,100,0.3);
      color: #7defa0; font-size: 12px; line-height: 1.4;
      animation: lynx-fade-in 0.3s ease;
    }
    #lynx-lead-toast.show { display: block; }
  `;

  // ── HTML ──────────────────────────────────────────────────────────────────
  const html = `
    <style>${css}</style>
    <div id="lynx-chat-root">
      <button id="lynx-bubble" aria-label="Chat öffnen">
        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="10" r="5" fill="white" opacity="0.9"/>
          <rect x="9" y="16" width="10" height="7" rx="2" fill="white" opacity="0.9"/>
          <circle cx="6" cy="19" r="2.5" fill="white" opacity="0.7"/>
          <circle cx="22" cy="19" r="2.5" fill="white" opacity="0.7"/>
          <circle cx="11.5" cy="9" r="1" fill="#5b3fa0"/>
          <circle cx="16.5" cy="9" r="1" fill="#5b3fa0"/>
          <rect x="12.5" y="11.5" width="3" height="1" rx="0.5" fill="#5b3fa0"/>
          <line x1="14" y1="5" x2="14" y2="3" stroke="white" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
          <circle cx="14" cy="2.5" r="1" fill="white" opacity="0.5"/>
        </svg>
      </button>

      <div id="lynx-window" role="dialog" aria-label="Lynx Chatbot">
        <div id="lynx-header">
          <div id="lynx-header-avatar">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="7" r="3.5" fill="white" opacity="0.9"/>
              <rect x="6.5" y="11" width="7" height="5" rx="1.5" fill="white" opacity="0.9"/>
              <circle cx="4" cy="13.5" r="1.8" fill="white" opacity="0.7"/>
              <circle cx="16" cy="13.5" r="1.8" fill="white" opacity="0.7"/>
              <circle cx="8.5" cy="6.5" r="0.7" fill="#5b3fa0"/>
              <circle cx="11.5" cy="6.5" r="0.7" fill="#5b3fa0"/>
            </svg>
          </div>
          <div id="lynx-header-info">
            <div id="lynx-header-name">Lynx KI-Assistent</div>
            <div id="lynx-header-status"><span id="lynx-status-dot"></span>Online &amp; bereit</div>
          </div>
          <button id="lynx-close" aria-label="Schließen">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div id="lynx-messages"></div>
        <div id="lynx-typing"><div class="lynx-dot"></div><div class="lynx-dot"></div><div class="lynx-dot"></div></div>

        <div id="lynx-lead-toast">✓ Anfrage übermittelt – wir melden uns bald bei dir!</div>

        <div id="lynx-chips">
          <button class="lynx-chip" data-msg="Was ist Modell 1?">Was ist Modell 1?</button>
          <button class="lynx-chip" data-msg="Was ist Modell 2?">Was ist Modell 2?</button>
          <button class="lynx-chip" data-msg="Wie läuft die Einrichtung ab?">Wie läuft die Einrichtung ab?</button>
          <button class="lynx-chip" data-msg="Ich möchte eine Demo anfragen">Demo anfragen</button>
        </div>

        <div id="lynx-input-area">
          <textarea id="lynx-input" rows="1" placeholder="Schreib eine Nachricht …" maxlength="800"></textarea>
          <button id="lynx-send" aria-label="Senden">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 8L2 2l3 6-3 6 12-6z" fill="white"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  // ── MOUNT ─────────────────────────────────────────────────────────────────
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  // ── ELEMENTS ──────────────────────────────────────────────────────────────
  const bubble  = document.getElementById("lynx-bubble");
  const win     = document.getElementById("lynx-window");
  const msgArea = document.getElementById("lynx-messages");
  const typing  = document.getElementById("lynx-typing");
  const input   = document.getElementById("lynx-input");
  const sendBtn = document.getElementById("lynx-send");
  const toast   = document.getElementById("lynx-lead-toast");

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function timestamp() {
    return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function addMessage(text, role) {
    const el = document.createElement("div");
    el.className = `lynx-msg ${role}`;

    // Strip lead JSON from displayed text
    const clean = text.replace(/<<<LEAD_JSON>>>[\s\S]*?<<<END_LEAD_JSON>>>/g, "").replace(/<<<SHOW_LEAD_FORM>>>/g, "").trim();

    // Simple markdown renderer
    function renderMarkdown(str) {
      return str
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")   // **bold**
        .replace(/\*(.+?)\*/g, "<em>$1</em>")                 // *italic*
        .replace(/^#{1,3}\s+(.+)$/gm, "<strong>$1</strong>")  // # headings → bold
        .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(179,157,219,0.15);margin:6px 0">') // ---
        .replace(/^(\d+\.\s.+)$/gm, '<div style="margin:2px 0">$1</div>') // numbered lists
        .replace(/\n/g, "<br>");
    }

    el.innerHTML = `<div class="lynx-bubble-text">${renderMarkdown(clean)}</div>
                    <span class="lynx-msg-time">${timestamp()}</span>`;
    msgArea.appendChild(el);
    msgArea.scrollTop = msgArea.scrollHeight;
    return el;
  }

  function extractLead(text) {
    const match = text.match(/<<<LEAD_JSON>>>([\s\S]*?)<<<END_LEAD_JSON>>>/);
    if (!match) return null;
    try { return JSON.parse(match[1].trim()); } catch { return null; }
  }

  function checkFormTrigger(text) {
    return text.includes('<<<SHOW_LEAD_FORM>>>');
  }

  function showLeadToast() {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 6000);
  }

  // ── LEAD FORM ─────────────────────────────────────────────────────────────
  function showLeadForm() {
    if (document.querySelector('.lynx-lead-form')) return; // only once

    const form = document.createElement('div');
    form.className = 'lynx-lead-form';
    form.innerHTML = `
      <div class="lynx-lead-form-title">📬 Demo anfragen</div>
      <input id="lf-name" type="text" placeholder="Dein Name" maxlength="80" style="width:100%">
      <input id="lf-email" type="email" placeholder="Deine E-Mail-Adresse" maxlength="120" style="width:100%">
      <textarea id="lf-note" placeholder="Dein Unternehmen / Anliegen (optional)"></textarea>
      <div class="lynx-consent-row">
        <input type="checkbox" id="lf-consent">
        <label for="lf-consent">Ich stimme zu, dass meine Daten (Name, Telefon, E-Mail, Anliegen) gespeichert und zur Kontaktaufnahme genutzt werden. Die Einwilligung kann jederzeit widerrufen werden. Weitere Infos in der <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a>.</label>
      </div>
      <button class="lynx-lead-form-btn" id="lf-submit" disabled>Anfrage absenden</button>
    `;
    msgArea.appendChild(form);
    msgArea.scrollTop = msgArea.scrollHeight;

    // Hide quick-reply chips when form is visible
    const chipsEl = document.getElementById('lynx-chips');
    if (chipsEl) chipsEl.style.display = 'none';

    const submitBtn  = document.getElementById('lf-submit');
    const consentBox = document.getElementById('lf-consent');

    consentBox.addEventListener('change', () => {
      submitBtn.disabled = !consentBox.checked;
    });

    submitBtn.addEventListener('click', async () => {
      const name  = document.getElementById('lf-name').value.trim();
      const email = document.getElementById('lf-email').value.trim();
      const note  = document.getElementById('lf-note').value.trim();

      if (!name || !email) {
        document.getElementById('lf-name').style.borderColor  = name  ? '' : 'rgba(255,100,100,0.6)';
        document.getElementById('lf-email').style.borderColor = email ? '' : 'rgba(255,100,100,0.6)';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet …';

      const consentDate = new Date().toISOString();
      await handleLead({ name, email, anliegen: note || '–', consentDate });

      form.innerHTML = '<div class="lynx-lead-form-success">✓ Vielen Dank! Wir melden uns bald bei dir.</div>';
      if (chipsEl) chipsEl.style.display = 'flex';
    });
  }

  function handleLead(lead) {
    if (leadCaptured) return;
    leadCaptured = true;

    // Payload passend zum Schema von lead.js
    const now = new Date().toISOString();
    const payload = {
      name:        lead.name         || "",
      phone:       "",
      email:       lead.email        || "",
      topic:       "Chatbot – Demo-Anfrage",
      note:        lead.anliegen     || "",
      date:        now,
      consentDate: lead.consentDate  || now,
    };

    fetch("/.netlify/functions/lead", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          console.log("[Lynx Lead] ✓ In Google Sheet eingetragen", payload);
        } else {
          console.warn("[Lynx Lead] Fehler:", res.error);
        }
      })
      .catch(err => console.error("[Lynx Lead] Netzwerkfehler:", err));

    showLeadToast();
  }

  // ── TOGGLE ────────────────────────────────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;
    win.classList.toggle("open", isOpen);
    if (isOpen && !greeted) { greeted = true; greet(); }
  }

  bubble.addEventListener("click", toggle);
  document.getElementById("lynx-close").addEventListener("click", toggle);

  // ── CHIPS ─────────────────────────────────────────────────────────────────
  document.querySelectorAll(".lynx-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (isTyping) return;
      sendMessage(chip.dataset.msg);
    });
  });

  // ── INPUT ─────────────────────────────────────────────────────────────────
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 100) + "px";
  });
  sendBtn.addEventListener("click", send);

  function send() {
    const text = input.value.trim();
    if (!text || isTyping) return;
    input.value = "";
    input.style.height = "auto";
    sendMessage(text);
  }

  // ── GREETING ──────────────────────────────────────────────────────────────
  function greet() {
    addMessage("Hallo! 👋 Ich bin der KI-Assistent von Lynx Automation Solutions.\n\nWie kann ich dir helfen? Wähle einen Themenpunkt oder stell mir direkt deine Frage.", "bot");
    // Datenschutzhinweis
    const privacy = document.createElement("div");
    privacy.className = "lynx-privacy";
    privacy.innerHTML = 'Ich bin ein KI-gestützter Chatbot und beantworte Fragen zu diesem Unternehmen. Deine Eingaben können technisch verarbeitet werden. Bitte gib keine sensiblen personenbezogenen Daten ein. Weitere Informationen findest du in der <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a>.';
    msgArea.appendChild(privacy);
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  // ── API CALL ──────────────────────────────────────────────────────────────
  async function sendMessage(userText) {
    addMessage(userText, "user");
    messages.push({ role: "user", content: userText });

    isTyping = true;
    sendBtn.disabled = true;
    typing.classList.add("show");
    msgArea.scrollTop = msgArea.scrollHeight;

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: messages,
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const reply = data.content?.find(b => b.type === "text")?.text || "Entschuldigung, ich konnte keine Antwort generieren.";

      messages.push({ role: "assistant", content: reply });

      const lead = extractLead(reply);
      if (lead) handleLead(lead);

      addMessage(reply, "bot");

      if (checkFormTrigger(reply)) showLeadForm();
    } catch (err) {
      addMessage("Entschuldigung, es gab einen technischen Fehler. Bitte schreib uns direkt an info@lynx-automation.de", "bot");
      console.error("[Lynx Chat]", err);
    } finally {
      isTyping = false;
      sendBtn.disabled = false;
      typing.classList.remove("show");
    }
  }
})();
