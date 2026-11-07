/**
 * Gemini on the client's own key. The key lives in Script Properties (set via the
 * menu), never in a sheet cell and never in this source. Spend is the client's.
 */

function geminiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('No Gemini key set. Strategy Engine menu > Set Gemini key.');
  return key;
}

function geminiModel_() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;
}

/**
 * Calls generateContent and returns parsed JSON plus token counts.
 * @param {string} systemText  system instruction
 * @param {Array<Object>} userParts  Gemini parts: [{text}, {inlineData:{mimeType,data}}]
 * @param {Object} schema  response JSON schema (OpenAPI subset)
 */
function geminiJson_(systemText, userParts, schema) {
  const model = geminiModel_();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': geminiKey_() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const raw = res.getContentText();
  let json;
  try { json = JSON.parse(raw); } catch (e) { throw new Error('Gemini returned non-JSON (' + code + '): ' + raw.slice(0, 300)); }
  if (code !== 200) {
    const msg = (json.error && json.error.message) || raw.slice(0, 300);
    throw new Error('Gemini ' + code + ': ' + msg);
  }
  const cand = (json.candidates || [])[0];
  if (!cand || !cand.content) throw new Error('Gemini returned no candidate (blocked or empty).');
  const text = cand.content.parts.map(p => p.text || '').join('');
  const usage = json.usageMetadata || {};
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Gemini JSON did not parse: ' + text.slice(0, 300)); }
  return {
    data: data,
    tokensIn: usage.promptTokenCount || 0,
    tokensOut: usage.candidatesTokenCount || 0,
    model: model,
  };
}

/** Lightweight connectivity check used by the menu. */
function geminiPing_() {
  const r = geminiJson_('Reply with JSON.', [{ text: 'Return {"ok": true}.' }],
    { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] });
  return r.model + ' answered; ' + r.tokensIn + ' tokens in, ' + r.tokensOut + ' out.';
}
