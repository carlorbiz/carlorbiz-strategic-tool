/**
 * MTMOT Strategy Engine: Google Drive entry option.
 *
 * Everything runs inside the client's own Google Workspace: this Sheet is the
 * store, the client's Shared Drive (or folder) is the evidence corpus, Gemini
 * is called on the client's own API key, and the drift report is written back
 * into their Drive. Nothing leaves the tenant and MTMOT holds no client data.
 *
 * Sheets:
 *   Settings     key/value configuration (folder, window, assistant name)
 *   Commitments  the strategic commitments (pillars) the corpus is read against
 *   Evidence     one row per piece of evidence Gemini found, with a human sign-off column
 *   Scans        a log line per scan and per drift report
 */

const SHEET_SETTINGS = 'Settings';
const SHEET_COMMITMENTS = 'Commitments';
const SHEET_EVIDENCE = 'Evidence';
const SHEET_SCANS = 'Scans';

const REPORTS_FOLDER_NAME = 'Strategy Engine reports';

// Model id lives in Script Properties (GEMINI_MODEL); this is only the fallback,
// mirroring GEMINI_FAST_MODEL in the full engine (law 5: cheapest adequate model).
const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash-lite';

// Bounds that keep one run inside Apps Script quotas (6 minutes, 50 MB payload).
const MAX_TEXT_CHARS = 400000;        // characters of document text sent per file
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const RUN_TIME_BUDGET_MS = 5 * 60 * 1000;
const MAX_FOLDER_DEPTH = 6;

const SETTINGS_DEFAULTS = [
  ['Drive folder ID', '', 'The ID of the Shared Drive folder (or My Drive folder) to read. The part of the URL after /folders/.'],
  ['Assistant name', 'CJ', 'How the analyst introduces itself in reports.'],
  ['Organisation name', '', 'Used in report titles.'],
  ['Drift window (days)', '90', 'A commitment with no evidence inside this window is flagged as silent.'],
  ['Scan schedule', 'daily 06:00', 'Set by the menu. Informational.'],
  ['Last scan', '', 'Written by the script.'],
  ['Last drift report', '', 'Written by the script.'],
];

const EVIDENCE_HEADERS = [
  'Scanned at', 'File', 'Link', 'Modified', 'Type', 'Commitment', 'Signal',
  'Excerpt', 'Confidence', 'Note', 'Sign-off', 'Reviewer', 'Reviewed at', 'File ID', 'Version',
];
const EVIDENCE_SIGNALS = ['summary', 'supports', 'progress', 'risk', 'scope_extension', 'tension', 'unrelated'];
const SIGNOFF_OPTIONS = ['Confirmed', 'Rejected'];

const COMMITMENT_HEADERS = ['Title', 'Description', 'Success signal', 'Level', 'Status'];
const COMMITMENT_LEVELS = ['organisational', 'departmental', 'programmatic'];

const SCAN_HEADERS = ['When', 'Kind', 'Files seen', 'Files read', 'Skipped', 'Evidence rows', 'Tokens in', 'Tokens out', 'Model', 'Outcome', 'Link'];

function settings_(ss) {
  const sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh) throw new Error('Run "Set up sheets" first (Strategy Engine menu).');
  const rows = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues();
  const out = {};
  rows.forEach(r => { if (r[0]) out[String(r[0]).trim()] = String(r[1]).trim(); });
  return out;
}

function setSetting_(ss, key, value) {
  const sh = ss.getSheetByName(SHEET_SETTINGS);
  const keys = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]).trim());
  const i = keys.indexOf(key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(value);
  else sh.appendRow([key, value, '']);
}

function commitments_(ss) {
  const sh = ss.getSheetByName(SHEET_COMMITMENTS);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, COMMITMENT_HEADERS.length).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({
      title: String(r[0]).trim(),
      description: String(r[1]).trim(),
      successSignal: String(r[2]).trim(),
      level: String(r[3]).trim() || 'departmental',
      status: String(r[4]).trim() || 'active',
    }));
}

function logScan_(ss, row) {
  const sh = ss.getSheetByName(SHEET_SCANS);
  sh.appendRow(row);
}

function fmt_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}
