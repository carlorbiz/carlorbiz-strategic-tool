/** The Strategy Engine menu on the Sheet. Every action reports back in a dialog. */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Strategy Engine')
    .addItem('1. Set up sheets', 'menuSetup')
    .addItem('2. Set Gemini key', 'menuSetKey')
    .addItem('3. Test the Gemini connection', 'menuPing')
    .addSeparator()
    .addItem('Scan the Drive folder now', 'menuScan')
    .addItem('Write a drift report now', 'menuDrift')
    .addSeparator()
    .addItem('Schedule: daily scan + Monday report', 'menuInstall')
    .addItem('Schedule: remove', 'menuRemove')
    .addSeparator()
    .addItem('Load sample commitments (test only)', 'menuSample')
    .addItem('About', 'menuAbout')
    .addToUi();
}

function run_(fn) {
  const ui = SpreadsheetApp.getUi();
  try {
    const out = fn();
    ui.alert('Strategy Engine', typeof out === 'string' ? out : JSON.stringify(out, null, 2), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Strategy Engine: something stopped', e.message, ui.ButtonSet.OK);
  }
}

function menuSetup() { run_(setupSheets); }
function menuPing() { run_(geminiPing_); }
function menuInstall() { run_(installSchedule); }
function menuRemove() { run_(removeSchedule); }
function menuSample() { run_(loadSampleCommitments); }

function menuScan() {
  run_(() => {
    const r = scanDrive();
    return r.files + ' files seen, ' + r.read + ' read, ' + r.skipped + ' unchanged or unreadable, ' + r.rows + ' evidence rows written.' +
      (r.errors.length ? '\n\nErrors:\n' + r.errors.join('\n') : '') + '\n\nNext: open the Evidence sheet and mark rows Confirmed or Rejected.';
  });
}

function menuDrift() { run_(() => 'Drift report written: ' + driftReport()); }

function menuSetKey() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Gemini API key', 'Paste the organisation\'s Gemini API key (Google AI Studio or a Vertex-enabled project). It is stored in this script\'s properties, never in a cell.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const key = res.getResponseText().trim();
  if (!key) return;
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  const m = ui.prompt('Gemini model (optional)', 'Leave blank for ' + GEMINI_DEFAULT_MODEL + ', or type a model id.', ui.ButtonSet.OK_CANCEL);
  const model = m.getSelectedButton() === ui.Button.OK ? m.getResponseText().trim() : '';
  if (model) PropertiesService.getScriptProperties().setProperty('GEMINI_MODEL', model);
  else PropertiesService.getScriptProperties().deleteProperty('GEMINI_MODEL');
  ui.alert('Strategy Engine', 'Key saved. Model: ' + geminiModel_() + '. Use "Test the Gemini connection" to check it.', ui.ButtonSet.OK);
}

function menuAbout() {
  SpreadsheetApp.getUi().alert('MTMOT Strategy Engine: Google Drive entry option',
    'Reads the documents in one Drive folder against your strategic commitments, writes the evidence here for a person to confirm, ' +
    'and writes a drift report back into your Drive. Everything runs in your Google Workspace on your own Gemini key; MTMOT holds none of your data.\n\n' +
    'Make the Most of Today - mtmot.com', SpreadsheetApp.getUi().ButtonSet.OK);
}
