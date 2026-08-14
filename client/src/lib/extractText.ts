// ── Client-side document text extraction ─────────────────────────────────────
//
// The sovereignty keystone of the Strategy Engine ingest path: the document is
// parsed HERE, in the client's browser. The file itself never leaves the
// client's machine — only the extracted text travels to the ingestion function,
// and only LLM-derived chunks are persisted. The platform is never the
// custodian of the source document.
//
// This also removes the old pipeline's top latency/crash causes: no serial
// server-side PDF→markdown conversion (2 pages per 40-80s LLM call), and no
// reading of DOCX ZIP binaries as text.

// pdfjs-dist and mammoth are heavy; they are dynamically imported inside the
// extraction functions so they only load when a file is actually parsed,
// keeping the engagement shell bundle light.

export interface ExtractionResult {
  text: string;
  /** pdf | docx | plain */
  method: 'pdf' | 'docx' | 'plain';
  pageCount?: number;
  warnings: string[];
}

/** File extensions the sovereign (client-side) path can extract. */
export const EXTRACTABLE_EXTENSIONS = ['pdf', 'doc', 'docx', 'md', 'markdown', 'txt', 'csv', 'json'];

export function isExtractable(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTRACTABLE_EXTENSIONS.includes(ext);
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf') return extractPdf(file);
  if (ext === 'docx' || ext === 'doc') return extractDocx(file, ext);

  // Plain-text formats: read directly.
  const text = await file.text();
  return { text, method: 'plain', warnings: [] };
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  const [pdfjsLib, pdfWorker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const warnings: string[] = [];
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // deno-lint-ignore no-explicit-any
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(`[Page ${i}]\n${pageText}`);
  }

  const text = pages.join('\n\n');
  const meaningfulChars = text.replace(/\[Page \d+\]/g, '').trim().length;

  // A text-based journal page carries thousands of characters. Under ~200
  // per page almost always means a scanned/image PDF with no text layer.
  if (meaningfulChars / doc.numPages < 200) {
    warnings.push(
      'This PDF appears to be scanned images with little or no embedded text. ' +
      'The extracted content is too thin to index faithfully — please export a ' +
      'text-based version from the original source and upload that instead.',
    );
  }

  return { text, method: 'pdf', pageCount: doc.numPages, warnings };
}

async function extractDocx(file: File, ext: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  if (ext === 'doc') {
    warnings.push(
      'Legacy .doc format — extraction may be incomplete. Saving the document as .docx or PDF gives a more faithful result.',
    );
  }
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  for (const m of result.messages ?? []) {
    if (m.type === 'warning') warnings.push(m.message);
  }
  return { text: result.value ?? '', method: 'docx', warnings };
}

// ── Segmenting (mirror of the edge function's splitIntoSegments) ─────────────

export function splitIntoSegments(text: string, maxChars = 10000): string[] {
  if (text.length <= maxChars) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      segments.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n\n', maxChars);
    if (splitAt < maxChars * 0.5) {
      splitAt = remaining.lastIndexOf('. ', maxChars);
    }
    if (splitAt < maxChars * 0.5) {
      splitAt = maxChars;
    }
    segments.push(remaining.slice(0, splitAt + 1));
    remaining = remaining.slice(splitAt + 1);
  }

  return segments;
}
