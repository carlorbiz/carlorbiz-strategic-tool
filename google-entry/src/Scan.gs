/**
 * Scan: walk the configured Drive folder, read each new or changed file, ask
 * Gemini what it says about each commitment, and append evidence rows for a
 * human to confirm or reject. Delta-only: a file is re-read only when its
 * modifiedTime changes.
 */

function scanDrive() {
  return withLock_('scan', scanDrive_);
}

function scanDrive_() {
  const ss = SpreadsheetApp.getActive();
  const started = new Date();
  const settings = settings_(ss);
  checkSchema_(settings);
  const folderId = settings['Drive folder ID'];
  if (!folderId) throw new Error('Settings > Drive folder ID is empty.');
  const commitments = commitments_(ss).filter(c => c.status !== 'archived');
  if (!commitments.length) throw new Error('No active commitments on the Commitments sheet.');

  const evidence = ss.getSheetByName(SHEET_EVIDENCE);
  const seen = seenVersions_(evidence);
  const files = listFiles_(folderId);

  let read = 0, skipped = 0, rows = 0, tokIn = 0, tokOut = 0, model = geminiModel_();
  let outcome = 'complete';
  const errors = [];

  for (const f of files) {
    if (new Date() - started > RUN_TIME_BUDGET_MS) { outcome = 'time budget reached; rerun to continue'; break; }
    if (seen[f.id] === f.modifiedTime) { skipped++; continue; }
    let parts;
    try { parts = fileParts_(f); } catch (e) { errors.push(f.name + ': ' + e.message); skipped++; continue; }
    if (!parts) { skipped++; continue; }
    try {
      const r = assessDocument_(f, parts, commitments, settings);
      tokIn += r.tokensIn; tokOut += r.tokensOut; model = r.model;
      rows += writeEvidence_(evidence, f, r.data, started);
      read++;
    } catch (e) {
      errors.push(f.name + ': ' + e.message);
    }
  }

  const note = errors.length ? outcome + '; ' + errors.length + ' error(s): ' + errors.slice(0, 3).join(' | ') : outcome;
  logScan_(ss, [fmt_(started), 'scan', files.length, read, skipped, rows, tokIn, tokOut, model, note, '']);
  setSetting_(ss, 'Last scan', fmt_(started) + ' (' + read + ' read, ' + rows + ' rows)');
  return { files: files.length, read: read, skipped: skipped, rows: rows, errors: errors };
}

/** Map of fileId -> modifiedTime already recorded on the Evidence sheet. */
function seenVersions_(sheet) {
  const out = {};
  if (sheet.getLastRow() < 2) return out;
  const idCol = EVIDENCE_HEADERS.indexOf('File ID') + 1;
  const verCol = EVIDENCE_HEADERS.indexOf('Version') + 1;
  const vals = sheet.getRange(2, idCol, sheet.getLastRow() - 1, verCol - idCol + 1).getValues();
  vals.forEach(r => { if (r[0]) out[r[0]] = r[verCol - idCol]; });
  return out;
}

/** Recursive listing through the Drive advanced service; Shared Drives included. */
function listFiles_(folderId) {
  const out = [];
  const walk = (id, depth) => {
    if (depth > MAX_FOLDER_DEPTH) return;
    let pageToken = null;
    do {
      const res = Drive.Files.list({
        q: "'" + id + "' in parents and trashed = false",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
        pageSize: 200,
        pageToken: pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, size)',
      });
      (res.files || []).forEach(f => {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (f.name !== REPORTS_FOLDER_NAME) walk(f.id, depth + 1);
        } else {
          out.push(f);
        }
      });
      pageToken = res.nextPageToken;
    } while (pageToken);
  };
  walk(folderId, 0);
  return out;
}

/**
 * Turns a Drive file into Gemini parts. Returns null for types we do not read.
 * Google Docs, Slides and Sheets export as text; PDFs go inline; plain text
 * types are read directly; Office files are converted through a temporary Google
 * Doc in the reports folder, which is trashed as soon as the text is out.
 */
function fileParts_(f) {
  const mt = f.mimeType || '';
  const file = DriveApp.getFileById(f.id);
  const textPart = s => [{ text: 'DOCUMENT TEXT (' + f.name + '):\n' + clip_(s) }];

  if (mt === 'application/vnd.google-apps.document' || mt === 'application/vnd.google-apps.presentation') {
    return textPart(file.getAs(MimeType.PLAIN_TEXT).getDataAsString());
  }
  if (mt === 'application/vnd.google-apps.spreadsheet') {
    return textPart(file.getAs(MimeType.CSV).getDataAsString());
  }
  if (mt === 'application/pdf') {
    const blob = file.getBlob();
    if (blob.getBytes().length > MAX_PDF_BYTES) throw new Error('PDF over ' + (MAX_PDF_BYTES / 1048576) + ' MB; skipped.');
    return [{ text: 'DOCUMENT (' + f.name + ') is attached as a PDF.' },
            { inlineData: { mimeType: 'application/pdf', data: Utilities.base64Encode(blob.getBytes()) } }];
  }
  if (/^text\//.test(mt) || mt === 'application/json' || /\.(md|txt|csv|json)$/i.test(f.name)) {
    return textPart(file.getBlob().getDataAsString());
  }
  if (/officedocument\.(wordprocessingml|presentationml|spreadsheetml)/.test(mt) || /\.(docx|pptx|xlsx)$/i.test(f.name)) {
    return textPart(convertedText_(f));
  }
  return null; // images, video, zips and anything else are not read
}

function convertedText_(f) {
  const target = /presentation|\.pptx$/i.test(f.mimeType + f.name) ? 'application/vnd.google-apps.presentation'
    : /spreadsheet|\.xlsx$/i.test(f.mimeType + f.name) ? 'application/vnd.google-apps.spreadsheet'
    : 'application/vnd.google-apps.document';
  const copy = Drive.Files.copy({ name: '_conversion ' + f.name, mimeType: target }, f.id, { supportsAllDrives: true });
  try {
    const tmp = DriveApp.getFileById(copy.id);
    return target.endsWith('spreadsheet') ? tmp.getAs(MimeType.CSV).getDataAsString() : tmp.getAs(MimeType.PLAIN_TEXT).getDataAsString();
  } finally {
    Drive.Files.remove(copy.id, { supportsAllDrives: true });
  }
}

function clip_(s) {
  s = String(s || '');
  return s.length > MAX_TEXT_CHARS ? s.slice(0, MAX_TEXT_CHARS) + '\n[TRUNCATED at ' + MAX_TEXT_CHARS + ' characters]' : s;
}

const ASSESS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    contains_personal_data: { type: 'boolean' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          commitment: { type: 'string' },
          signal: { type: 'string', enum: ['supports', 'progress', 'risk', 'scope_extension', 'tension', 'unrelated'] },
          excerpt: { type: 'string' },
          confidence: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['commitment', 'signal', 'excerpt', 'confidence'],
      },
    },
  },
  required: ['summary', 'evidence', 'contains_personal_data'],
};

function assessDocument_(f, parts, commitments, settings) {
  const assistant = settings['Assistant name'] || 'CJ';
  const list = commitments.map((c, i) => (i + 1) + '. ' + c.title + (c.description ? ' - ' + c.description : '') +
    (c.successSignal ? ' (success looks like: ' + c.successSignal + ')' : '')).join('\n');
  const system = 'You are ' + assistant + ', a strategic governance analyst reading one document from an organisation\'s Drive. ' +
    'Your job is to find evidence about the organisation\'s stated commitments, not to summarise the document for its own sake. ' +
    'Quote excerpts verbatim (40 words or fewer). Use the commitment titles exactly as given. ' +
    'Signals: supports (the document advances or resources the commitment), progress (a reported result or milestone), ' +
    'risk (a threat, delay, resourcing gap or dependency), scope_extension (the commitment is being stretched to cover new ground), ' +
    'tension (the document pulls against another commitment or against this one), unrelated (use once, with commitment "none", only when nothing in the document bears on any commitment). ' +
    'Confidence is 0 to 1. Flag contains_personal_data if the document holds names of individuals with health, employment or other personal details. Return only JSON.';
  const user = [{ text: 'COMMITMENTS:\n' + list + '\n\nFile: ' + f.name + ' (modified ' + f.modifiedTime + ')\n' }].concat(parts);
  return geminiJson_(system, user, ASSESS_SCHEMA);
}

function writeEvidence_(sheet, f, data, when) {
  const stamp = fmt_(when);
  const type = (f.mimeType || '').split('/').pop().replace('vnd.google-apps.', '');
  const base = [stamp, f.name, f.webViewLink || '', (f.modifiedTime || '').slice(0, 10), type, PACK_DOCUMENTS];
  const tail = ['', '', '', f.id, f.modifiedTime];
  const rows = [];
  rows.push(base.concat(['', 'summary', data.summary || '', '', data.contains_personal_data ? 'Contains personal data: handle under the organisation\'s privacy policy.' : ''], tail));
  (data.evidence || []).forEach(e => {
    rows.push(base.concat([e.commitment || '', e.signal || '', e.excerpt || '', e.confidence == null ? '' : Math.round(e.confidence * 100) / 100, e.note || ''], tail));
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, EVIDENCE_HEADERS.length).setValues(rows);
  return rows.length;
}
