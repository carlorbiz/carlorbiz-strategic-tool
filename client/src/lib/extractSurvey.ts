// ── Client-side survey file parsing (CC-347 Slice 0b, item 4) ────────────────
//
// The sovereignty keystone applied to surveys the same way extractText.ts
// applies it to documents: the raw respondent-level file (xlsx/xls/csv/json)
// is parsed HERE, in the browser. The file itself never reaches the
// platform — only the parsed sheet structure (headers + rows, the exact
// shape st-ingest-survey used to produce itself by downloading and parsing
// the stored file) is sent to the ingestion function.
//
// Two libraries, chosen because both are needed and neither alone covers
// every format the survey uploader accepts:
//   - papaparse (npm registry, actively maintained) for CSV — a purpose-built
//     CSV parser handles quoting/escaping edge cases more robustly than a
//     hand-rolled one, and is what most "small well-known CSV library"
//     searches land on.
//   - xlsx (SheetJS, installed from its official cdn.sheetjs.com distribution
//     — the npm registry's own "xlsx" package has been stuck at the
//     pre-CVE-fix 0.18.5 for years; SheetJS moved current releases to their
//     own CDN) for .xlsx/.xls, since nothing else in the ecosystem parses
//     the binary/OOXML spreadsheet formats. This is the same library and the
//     same major version (0.20.3) the server-side path already loads at
//     runtime from cdn.sheetjs.com in st-ingest-survey/index.ts — moving it
//     into the browser bundle at build time is strictly safer than the
//     status quo (no runtime third-party script fetch at all, in either
//     place, once this ships).
//
// JSON survey exports need no library — JSON.parse is enough, mirroring the
// server's parseJSONSurvey.
//
// Both papaparse and xlsx are dynamically imported inside the functions that
// need them (same pattern as extractText.ts's pdfjs-dist/mammoth) so a CSV
// or JSON survey never pulls the (larger) xlsx parser into the loaded bundle.

export interface ParsedSheet {
  sheet_name: string;
  headers: string[];
  rows: Record<string, string>[];
}

export interface SurveyExtractionResult {
  sheets: ParsedSheet[];
  warnings: string[];
}

/** File extensions the browser-side survey path can parse. */
export const SURVEY_EXTRACTABLE_EXTENSIONS = ['csv', 'json', 'xlsx', 'xls'];

export function isSurveyExtractable(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return SURVEY_EXTRACTABLE_EXTENSIONS.includes(ext);
}

export async function extractSurveyFromFile(file: File): Promise<SurveyExtractionResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv') return extractCsv(file);
  if (ext === 'json') return extractJson(file);
  if (ext === 'xlsx' || ext === 'xls') return extractXlsx(file);

  // Fall back to CSV parsing, mirroring the server's historical default.
  return extractCsv(file);
}

async function extractCsv(file: File): Promise<SurveyExtractionResult> {
  const Papa = (await import('papaparse')).default;
  const text = await file.text();
  const warnings: string[] = [];

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    warnings.push(
      `${result.errors.length} row(s) had parsing issues and may be incomplete — check the source file if response counts look low.`,
    );
  }

  const headers = result.meta.fields ?? [];
  const rows = (result.data ?? []).map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((h) => {
      out[h] = row[h] != null ? String(row[h]) : '';
    });
    return out;
  });

  return { sheets: [{ sheet_name: 'Sheet1', headers, rows }], warnings };
}

async function extractJson(file: File): Promise<SurveyExtractionResult> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON survey must be an array of response objects');
  }
  const headers = Object.keys(data[0]);
  const rows = data.map((item: Record<string, unknown>) => {
    const row: Record<string, string> = {};
    headers.forEach((h) => {
      row[h] = item[h] != null ? String(item[h]) : '';
    });
    return row;
  });
  return { sheets: [{ sheet_name: 'Sheet1', headers, rows }], warnings: [] };
}

async function extractXlsx(file: File): Promise<SurveyExtractionResult> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const warnings: string[] = [];

  const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (jsonData.length === 0) {
      return { sheet_name: sheetName, headers: [], rows: [] };
    }

    const headers = Object.keys(jsonData[0]);
    const rows = jsonData.map((row) => {
      const out: Record<string, string> = {};
      headers.forEach((h) => {
        out[h] = row[h] != null ? String(row[h]) : '';
      });
      return out;
    });

    return { sheet_name: sheetName, headers, rows };
  });

  if (sheets.every((s) => s.rows.length === 0)) {
    warnings.push('No data rows found in any sheet of this workbook.');
  }

  return { sheets, warnings };
}
