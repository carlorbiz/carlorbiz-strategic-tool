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

// The sheet layout is a contract. Bump when a column is added or moved and add a
// migration in Setup.gs; packs built later must never break an installed client.
const SCHEMA_VERSION = 1;
// Which pack wrote an evidence row. The documents pack is the base; research and
// systems packs write their own value here and the drift report groups by it.
const PACK_DOCUMENTS = 'documents';

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
  ['Schema version', String(SCHEMA_VERSION), 'Written by setup. The script refuses to run against a newer layout than it knows.'],
  ['Last scan', '', 'Written by the script.'],
  ['Last drift report', '', 'Written by the script.'],
];

const EVIDENCE_HEADERS = [
  'Scanned at', 'File', 'Link', 'Modified', 'Type', 'Source', 'Commitment', 'Signal',
  'Excerpt', 'Confidence', 'Note', 'Sign-off', 'Reviewer', 'Reviewed at', 'File ID', 'Version',
];

/**
 * One run at a time. Scheduled and menu runs share a script lock so an hourly
 * trigger never overlaps a slow scan and two reports are never written at once.
 */
function withLock_(label, fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) throw new Error('Another ' + label + ' is still running. Try again in a few minutes.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Refuses to run against a sheet layout newer than this code knows. */
function checkSchema_(settings) {
  const v = parseInt(settings['Schema version'], 10);
  if (isNaN(v)) throw new Error('Settings has no Schema version. Run "Set up sheets" again.');
  if (v > SCHEMA_VERSION) throw new Error('This sheet is layout version ' + v + ' but the script is version ' + SCHEMA_VERSION + '. Update the script files.');
  return v;
}
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
