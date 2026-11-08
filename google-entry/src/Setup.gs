/**
 * Setup: build the four sheets, add validation, install or remove the schedule.
 * Safe to rerun: existing sheets and rows are kept, missing ones are added.
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActive();

  const settings = sheet_(ss, SHEET_SETTINGS, ['Setting', 'Value', 'What it does']);
  const have = settings.getLastRow() > 1 ? settings.getRange(2, 1, settings.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  SETTINGS_DEFAULTS.forEach(d => { if (have.indexOf(d[0]) < 0) settings.appendRow(d); });
  const current = parseInt(settings_(ss)['Schema version'], 10);
  if (isNaN(current) || current < SCHEMA_VERSION) setSetting_(ss, 'Schema version', String(SCHEMA_VERSION)); // migrations go here as versions grow
  settings.setColumnWidths(1, 1, 180).setColumnWidths(2, 1, 320).setColumnWidths(3, 1, 420);

  const commitments = sheet_(ss, SHEET_COMMITMENTS, COMMITMENT_HEADERS);
  commitments.setColumnWidths(1, 1, 260).setColumnWidths(2, 1, 420).setColumnWidths(3, 1, 320);
  commitments.getRange('D2:D500').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(COMMITMENT_LEVELS, true).setAllowInvalid(false).build());
  commitments.getRange('E2:E500').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['active', 'archived'], true).setAllowInvalid(false).build());

  const evidence = sheet_(ss, SHEET_EVIDENCE, EVIDENCE_HEADERS);
  evidence.setColumnWidths(2, 1, 220).setColumnWidths(8, 1, 420).setColumnWidths(10, 1, 260);
  const signoffCol = EVIDENCE_HEADERS.indexOf('Sign-off') + 1;
  evidence.getRange(2, signoffCol, 5000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(SIGNOFF_OPTIONS, true).setAllowInvalid(false).build());
  evidence.hideColumns(EVIDENCE_HEADERS.indexOf('File ID') + 1, 2);

  sheet_(ss, SHEET_SCANS, SCAN_HEADERS);

  const first = ss.getSheets()[0];
  if (first.getName() === 'Sheet1' && first.getLastRow() === 0) ss.deleteSheet(first);
  return 'Sheets ready. Fill Settings (Drive folder ID) and Commitments, set the Gemini key, then run a scan.';
}

function sheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#0D0D1A').setFontColor('#E8C547');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Writes the synthetic Northbank commitments so the test corpus has something to be read against. */
function loadSampleCommitments() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_COMMITMENTS);
  if (!sh) throw new Error('Run "Set up sheets" first.');
  if (sh.getLastRow() > 1) throw new Error('Commitments sheet already has rows; clear it first if you want the sample set.');
  sh.getRange(2, 1, 4, COMMITMENT_HEADERS.length).setValues([
    ['Bring care closer to home', 'Shift 20% of outpatient activity to community and home settings by 2028.', 'Home and community episodes as a share of total outpatient activity.', 'organisational', 'active'],
    ['One digital front door', 'A single booking, record and messaging experience for every patient and carer.', 'Share of appointments booked through the front door; patient effort score.', 'organisational', 'active'],
    ['Grow and keep our rural workforce', 'Recruit, train and retain clinicians for the three rural sites.', 'Vacancy rate and 12-month retention at rural sites.', 'departmental', 'active'],
    ['Financial sustainability', 'Return to a balanced operating result by FY28 without service cuts.', 'Operating margin; activity-based funding capture.', 'organisational', 'active'],
  ]);
  return 'Four sample commitments loaded (synthetic Northbank Community Health).';
}

function installSchedule() {
  removeSchedule();
  ScriptApp.newTrigger('scanDrive').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('driftReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  setSetting_(SpreadsheetApp.getActive(), 'Scan schedule', 'daily 06:00; drift report Mondays 07:00');
  return 'Scheduled: scan daily at 06:00, drift report Mondays at 07:00 (script time zone).';
}

function removeSchedule() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  setSetting_(SpreadsheetApp.getActive(), 'Scan schedule', 'none (manual)');
  return 'Schedule removed.';
}
