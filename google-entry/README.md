# Strategy Engine: Google Drive entry option

An entry-level version of the MTMOT Strategy Engine that runs entirely inside the client organisation's own Google Workspace. It is not a replacement for the full engine (Supabase, 30 edge functions, consultant stages, interview engine, Nera chat, surveys); it is the lightest shape that delivers the engine's core promise, drift-watching an organisation's strategy against its own documents, and a step up into the full engine and the board offer.

Built 8 Nov 2026 on Carla's direction (CC-487): build and test it as an entry option, not as a shift of the whole engine.

## What it is

One Google Sheet with a bound Apps Script. The client:

1. Writes their strategic commitments on the **Commitments** sheet (title, description, success signal, level).
2. Points **Settings** at one Drive folder (a Shared Drive folder or a My Drive folder).
3. Pastes the organisation's own Gemini API key once (stored in script properties, never in a cell).

Then, daily, the script reads every new or changed document in that folder (Docs, Slides, Sheets, PDFs, text, Office files) and asks Gemini what each says about each commitment. Evidence lands on the **Evidence** sheet, one row per excerpt, with a **Sign-off** column a person marks Confirmed or Rejected. Weekly, a **drift report** Google Doc is written back into a `Strategy Engine reports` folder inside the watched folder: silence, imbalance, staleness computed in the sheet; scope creep, tension, emerging themes and the board narrative from Gemini on a digest of the confirmed and unconfirmed excerpts.

## Why this shape

- **Law 6.** MTMOT holds none of the client's data. The Sheet, the Drive, the key, the spend and the access control are all the client's. The honest promise is literal: we never see it.
- **Minimum engineering.** No servers, no database, no deploy pipeline, no Marketplace review. Apps Script is free; Gemini is billed to the client's own Google account, with a free tier that covers a small organisation's corpus.
- **Google-only first.** One platform, done properly, the way mobile apps launch on one store.
- **Volume.** Install is a copy of a Sheet plus a key paste, so it can be sold at a lower ticket in volume, and it keeps the engine's vocabulary (commitments, evidence, drift signals) so a client who steps up recognises everything.

## What it drops against the full engine

Engagement stages and the consultant workflow, the interview engine, Nera/CJ chat over the corpus, surveys and stakeholder inputs, campaign access tokens, multi-engagement tenancy, PII scanning beyond a flag, vector search (Gemini's long context reads whole documents instead, capped at 400k characters a file), and any UI beyond the Sheet and the report Doc.

## Install (the client, or Carla for a test): about 10 minutes, desktop

1. Create a new Google Sheet in the organisation's Workspace. Name it, for example, `Strategy Engine`.
2. Extensions > Apps Script. Delete the default `Code.gs` content.
3. In the Apps Script editor, Project Settings (the cog) > tick **Show "appsscript.json" manifest file in editor**.
4. Back in the editor, replace the contents of `appsscript.json` with `src/appsscript.json` from this folder.
5. Add a script file for each of `Config.gs`, `Gemini.gs`, `Scan.gs`, `Drift.gs`, `Setup.gs`, `Menu.gs` (File > + > Script, name it, paste). Save all.
6. Services (the + beside Services) > **Drive API** > version v3 > Add. (The manifest already declares it; this step makes the editor agree.)
7. Reload the Sheet. A **Strategy Engine** menu appears. Run **1. Set up sheets**; approve the permissions prompt (it asks for Drive, Docs, external requests and triggers, all inside the organisation's account).
8. Settings sheet: paste the **Drive folder ID** (the part of the folder URL after `/folders/`), the organisation name, and the drift window.
9. Commitments sheet: enter the commitments (or, for a test, menu > **Load sample commitments**).
10. Menu > **2. Set Gemini key**: paste a key from Google AI Studio (aistudio.google.com, "Get API key") created in the organisation's Google account. Then **3. Test the Gemini connection**.
11. Menu > **Scan the Drive folder now**. Read the Evidence sheet; mark a few rows Confirmed or Rejected.
12. Menu > **Write a drift report now**. The Doc link is in the dialog and on the Scans sheet.
13. Menu > **Schedule: daily scan + Monday report** to run it unattended.

Alternative to steps 2 to 6 for anyone with Node: `npm i -g @google/clasp`, `clasp login`, then from this folder `clasp create --type sheets --title "Strategy Engine" --rootDir src` and `clasp push`.

## Test plan (synthetic corpus in `test-corpus/`)

Four documents for a fictional organisation, Northbank Community Health, written to exercise each signal: a strategic plan that names four commitments, a board paper that reports progress on two and a risk on one, a team update that stretches one commitment's scope, and a facilities notice that mentions none, so that **Financial sustainability** stays silent. Expected on the drift report: at least one `silence` signal, one `scope_extension` row in the Evidence sheet for "One digital front door", a `risk` row for "Grow and keep our rural workforce", and a narrative that does not invent activity for the silent commitment.

Copy `test-corpus/` into the watched folder, load the sample commitments, scan, sign off a few rows, run the report. Record what Gemini produced, the token counts on the Scans sheet, and what you would change.

## Known limits

- Apps Script runs for at most 6 minutes per execution; the scan stops at 5 and resumes on the next run (delta-only, so nothing is re-read).
- Files over 15 MB (PDF) or 50 MB payload are skipped and logged.
- Office files are converted through a temporary Google Doc in the organisation's Drive and trashed immediately; a client who objects can convert their files to Google formats instead.
- Shared Drive access follows the installing user's permissions, so install it as a user who can see the whole folder.
- Gemini can be wrong. Every row has a sign-off column and the report says what is unconfirmed; this is the design, not a disclaimer.

## Spend

Zero to MTMOT. Apps Script and Drive are included in Workspace. Gemini is billed to the key's owner; the model defaults to the fast tier used by the full engine and can be changed from the key dialog. Token counts for every scan and report are on the Scans sheet so the client sees their own cost.
