/**
 * Drift report: read the Evidence sheet against the commitments, compute the
 * deterministic signals (silence, imbalance, staleness) in the sheet, ask Gemini
 * for the judgement calls (scope creep, tension, emerging themes, narrative) on a
 * compact digest, and write a Google Doc into the reports folder in the client's
 * Drive. Rejected rows are excluded; unsigned rows are carried as unconfirmed.
 */

function driftReport() {
  const ss = SpreadsheetApp.getActive();
  const started = new Date();
  const settings = settings_(ss);
  const folderId = settings['Drive folder ID'];
  if (!folderId) throw new Error('Settings > Drive folder ID is empty.');
  const windowDays = parseInt(settings['Drift window (days)'], 10) || 90;
  const assistant = settings['Assistant name'] || 'CJ';
  const org = settings['Organisation name'] || 'the organisation';
  const commitments = commitments_(ss).filter(c => c.status !== 'archived');
  if (!commitments.length) throw new Error('No active commitments on the Commitments sheet.');

  const rows = evidenceRows_(ss);
  const cutoff = new Date(started.getTime() - windowDays * 86400000);
  const digest = buildDigest_(commitments, rows, cutoff);

  const r = geminiJson_(driftSystem_(assistant), [{ text: 'ORGANISATION: ' + org + '\nWINDOW: last ' + windowDays + ' days\n\nDIGEST (JSON):\n' + JSON.stringify(digest) }], DRIFT_SCHEMA);
  const doc = writeReportDoc_(folderId, org, assistant, windowDays, digest, r.data, started, rows.length);

  logScan_(ss, [fmt_(started), 'drift report', '', '', '', rows.length, r.tokensIn, r.tokensOut, r.model, 'complete', doc.url]);
  setSetting_(ss, 'Last drift report', fmt_(started) + ' ' + doc.url);
  return doc.url;
}

function evidenceRows_(ss) {
  const sh = ss.getSheetByName(SHEET_EVIDENCE);
  if (!sh || sh.getLastRow() < 2) return [];
  const H = EVIDENCE_HEADERS;
  return sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues().map(v => ({
    file: v[H.indexOf('File')], link: v[H.indexOf('Link')], modified: v[H.indexOf('Modified')],
    commitment: String(v[H.indexOf('Commitment')]).trim(), signal: String(v[H.indexOf('Signal')]).trim(),
    excerpt: v[H.indexOf('Excerpt')], confidence: v[H.indexOf('Confidence')], note: v[H.indexOf('Note')],
    signoff: String(v[H.indexOf('Sign-off')]).trim(),
  })).filter(r => r.signal && r.signal !== 'summary' && r.signal !== 'unrelated' && r.signoff !== 'Rejected');
}

function buildDigest_(commitments, rows, cutoff) {
  const asDate = s => (s instanceof Date) ? s : new Date(String(s));
  const per = commitments.map(c => {
    const mine = rows.filter(r => r.commitment.toLowerCase() === c.title.toLowerCase());
    const inWindow = mine.filter(r => asDate(r.modified) >= cutoff);
    const latest = mine.reduce((m, r) => { const d = asDate(r.modified); return (!m || d > m) ? d : m; }, null);
    const counts = {};
    inWindow.forEach(r => { counts[r.signal] = (counts[r.signal] || 0) + 1; });
    return {
      title: c.title, level: c.level, success_signal: c.successSignal,
      mentions_in_window: inWindow.length, confirmed: inWindow.filter(r => r.signoff === 'Confirmed').length,
      unconfirmed: inWindow.filter(r => !r.signoff).length,
      last_evidence: latest ? Utilities.formatDate(latest, Session.getScriptTimeZone(), 'yyyy-MM-dd') : null,
      signal_counts: counts,
      silent: inWindow.length === 0,
      excerpts: inWindow.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 12)
        .map(r => ({ file: r.file, signal: r.signal, excerpt: r.excerpt, note: r.note, status: r.signoff || 'unconfirmed' })),
    };
  });
  const total = per.reduce((s, p) => s + p.mentions_in_window, 0);
  per.forEach(p => { p.share_of_evidence = total ? Math.round(100 * p.mentions_in_window / total) : 0; });
  const unassigned = rows.filter(r => !commitments.some(c => c.title.toLowerCase() === r.commitment.toLowerCase()) && asDate(r.modified) >= cutoff)
    .slice(0, 15).map(r => ({ file: r.file, commitment_as_written: r.commitment, signal: r.signal, excerpt: r.excerpt }));
  return { commitments: per, evidence_rows_in_window: total, unassigned_evidence: unassigned };
}

function driftSystem_(assistant) {
  return 'You are ' + assistant + ', a strategic governance analyst. You are given a digest of evidence gathered from an organisation\'s own documents, ' +
    'grouped by strategic commitment, with counts the organisation has already computed. Produce a drift report for the board.\n\n' +
    'For each commitment, consider: silence (no evidence in the window: already computed, explain what it may mean, never invent activity), ' +
    'imbalance (one commitment dominating the evidence), scope_creep (the commitment stretching into new ground), staleness (last evidence long ago), ' +
    'tension (evidence pulling against another commitment), emerging_theme (recurring matter the commitments do not name, from the unassigned evidence).\n\n' +
    'Treat unconfirmed excerpts as weaker than confirmed ones and say so where it matters. Quote the digest, never beyond it. ' +
    'Severity: info, warning or critical. Write the narrative in two to four plain sentences a board member can act on. Return only JSON.';
}

const DRIFT_SCHEMA = {
  type: 'object',
  properties: {
    narrative: { type: 'string' },
    signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['silence', 'imbalance', 'scope_creep', 'staleness', 'tension', 'emerging_theme'] },
          commitment_title: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          message: { type: 'string' },
        },
        required: ['type', 'commitment_title', 'severity', 'message'],
      },
    },
    merge_suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { commitment_a: { type: 'string' }, commitment_b: { type: 'string' }, message: { type: 'string' } },
        required: ['commitment_a', 'commitment_b', 'message'],
      },
    },
    questions_for_the_board: { type: 'array', items: { type: 'string' } },
  },
  required: ['narrative', 'signals'],
};

function reportsFolderId_(parentId) {
  const res = Drive.Files.list({
    q: "'" + parentId + "' in parents and name = '" + REPORTS_FOLDER_NAME + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives', fields: 'files(id)',
  });
  if (res.files && res.files.length) return res.files[0].id;
  const made = Drive.Files.create({ name: REPORTS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, null, { supportsAllDrives: true });
  return made.id;
}

function writeReportDoc_(folderId, org, assistant, windowDays, digest, out, when, rowCount) {
  const title = 'Drift report - ' + org + ' - ' + Utilities.formatDate(when, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const created = Drive.Files.create({ name: title, mimeType: 'application/vnd.google-apps.document', parents: [reportsFolderId_(folderId)] }, null, { supportsAllDrives: true });
  const doc = DocumentApp.openById(created.id);
  const body = doc.getBody();
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Prepared by ' + assistant + ' from ' + rowCount + ' evidence rows in the organisation\'s own Drive, window of ' + windowDays + ' days. ' +
    'AI-assisted analysis: confirm a signal against the source document before acting on it.').setItalic(true);

  body.appendParagraph('Where the strategy stands').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(out.narrative || '');

  body.appendParagraph('Signals').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const sig = [['Severity', 'Type', 'Commitment', 'What the evidence shows']];
  (out.signals || []).sort((a, b) => sevRank_(b.severity) - sevRank_(a.severity))
    .forEach(s => sig.push([s.severity, s.type.replace('_', ' '), s.commitment_title, s.message]));
  if (sig.length === 1) sig.push(['', '', '', 'No signals raised.']);
  body.appendTable(sig);

  body.appendParagraph('Each commitment').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const tbl = [['Commitment', 'Evidence in window', 'Confirmed', 'Unconfirmed', 'Share', 'Last evidence', 'Silent']];
  digest.commitments.forEach(c => tbl.push([c.title, String(c.mentions_in_window), String(c.confirmed), String(c.unconfirmed),
    c.share_of_evidence + '%', c.last_evidence || 'none', c.silent ? 'yes' : '']));
  body.appendTable(tbl);

  if (out.merge_suggestions && out.merge_suggestions.length) {
    body.appendParagraph('Commitments that may be one').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    out.merge_suggestions.forEach(m => body.appendListItem(m.commitment_a + ' and ' + m.commitment_b + ': ' + m.message));
  }
  if (out.questions_for_the_board && out.questions_for_the_board.length) {
    body.appendParagraph('Questions for the board').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    out.questions_for_the_board.forEach(q => body.appendListItem(q));
  }
  if (digest.unassigned_evidence.length) {
    body.appendParagraph('Evidence that matched no commitment').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    digest.unassigned_evidence.forEach(u => body.appendListItem(u.file + ' (' + u.signal + ', "' + u.commitment_as_written + '"): ' + u.excerpt));
  }

  body.appendParagraph('Method').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Documents in the watched folder are read when added or changed. Each is assessed against the commitments on the Commitments sheet and the evidence is written to the Evidence sheet, where a reviewer marks each row Confirmed or Rejected. ' +
    'Rejected rows are excluded here; unsigned rows are counted as unconfirmed. Counts and silence are computed in the sheet; the narrative and the judgement signals are the analyst model\'s reading of the digest, limited to the excerpts it was given.').setFontSize(9);
  doc.saveAndClose();
  return { id: created.id, url: 'https://docs.google.com/document/d/' + created.id + '/edit' };
}

function sevRank_(s) { return s === 'critical' ? 3 : s === 'warning' ? 2 : 1; }
