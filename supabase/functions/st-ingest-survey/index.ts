// =============================================================================
// Carlorbiz Strategic Tool — Survey ingestion (background + multi-LLM)
// supabase/functions/st-ingest-survey/index.ts
//
// CHANGE (2026-05-19, v3):
//   - Synchronous part returns 202 Accepted after parsing the file and
//     batch-inserting response cells. No more 150-second gateway timeouts
//     hanging the browser.
//   - LLM analysis (per-question themes + overall summary + chunk extraction)
//     runs in EdgeRuntime.waitUntil() after the response goes out.
//   - Frontend polls st_surveys.status until it flips from 'ingesting' to
//     'ingested' or 'failed'.
//   - Model split: Gemini 2.5 Flash for per-question analysis (~20 calls)
//     and chunk extraction (~20 calls). Claude Sonnet 4 for the single
//     overall-survey summary (prose quality matters; cost is rounding error).
//     Aligns with the standing multi-LLM policy: never Anthropic-only;
//     Gemini required for cost rotation.
//   - Per-question and chunk calls run with concurrency=5 (Promise.all
//     semaphore). 20 questions x ~3 sec per Flash call serially = 60s;
//     with concurrency 5, ~15s. Same speedup applied to chunk extraction.
//   - Response inserts now batched (500 rows per insert) rather than one
//     INSERT per cell. 1481 rows used to take ~150s; now ~2s.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") || "";

// ─── CORS ─────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Auth ─────────────────────────────────────────────────────
async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing bearer token");

  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return "service-role";
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed");
    const payload = JSON.parse(atob(parts[1]));
    if (payload.role === "service_role") return "service-role";
    const userId = payload.sub;
    if (!userId) throw new Error("no sub claim");
    return userId;
  } catch {
    throw new Error("Invalid bearer token");
  }
}

// ─── Model configs ────────────────────────────────────────────
// Per-question analysis + chunk extraction: Gemini 2.5 Flash. Cheap, fast,
// reliable JSON output for structured extraction. ~40 calls per survey, so
// latency dominates total time.
// Overall summary: Claude Sonnet 4. Single call, prose quality matters for
// the board-readable summary.

const FLASH_CONFIG: LLMConfig = {
  provider: "google",
  model: "gemini-2.5-flash",
  apiKey: GOOGLE_API_KEY,
};

const SONNET_CONFIG: LLMConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKey: ANTHROPIC_API_KEY,
};

// ─── LLM prompts ──────────────────────────────────────────────

const QUESTION_ANALYSIS_PROMPT = `You are a survey analyst for a strategic planning evidence platform. Analyse the responses to a single survey question.

Given a question header and a list of responses, produce:
1. "themes": an array of 2-6 theme objects, each with { "theme": string, "count": number, "example_quotes": string[] (1-3 verbatim quotes) }
2. "sentiment": { "positive": number, "neutral": number, "negative": number, "mixed": number } — counts, not percentages
3. "notable_quotes": array of 1-5 standout verbatim responses that capture key sentiments or insights
4. "summary": a 1-2 sentence plain-English summary of what respondents said

Australian English throughout. No em-dashes. Return ONLY a JSON object with these four keys. No other text.`;

const SURVEY_SUMMARY_PROMPT = `You are a survey analyst for a strategic planning evidence platform. Given per-question summaries from a survey, write a 2-3 sentence overall summary capturing the key findings, dominant themes, and any notable tensions or surprises. Be specific. Cite question topics and quantify where possible. Australian English. No em-dashes. Return ONLY the summary text, no quotes, no prefix.`;

const SURVEY_CHUNK_PROMPT = `You are a knowledge extraction specialist. Given a survey question summary (themes, sentiment, notable quotes), produce 1-3 knowledge chunks that capture the key findings as standalone facts.

Rules:
1. Each chunk must be self-contained and understandable without context
2. Reference the question topic and the survey name
3. Include specific figures or quoted evidence where available

Output a JSON array of objects, each with:
- "chunk_text": the self-contained knowledge statement
- "chunk_summary": a one-sentence summary
- "topic_tags": relevant tags as lowercase strings

Australian English. No em-dashes. Return ONLY the JSON array.`;

// ─── CSV parser ───────────────────────────────────────────────

interface ParsedSheet {
  sheet_name: string;
  headers: string[];
  rows: Record<string, string>[];
}

function parseCSV(text: string, sheetName = "Sheet1"): ParsedSheet {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { sheet_name: sheetName, headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });

  return { sheet_name: sheetName, headers, rows };
}

function parseJSONSurvey(text: string): ParsedSheet {
  const data = JSON.parse(text);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("JSON survey must be an array of response objects");
  }
  const headers = Object.keys(data[0]);
  const rows = data.map((item: Record<string, unknown>) => {
    const row: Record<string, string> = {};
    headers.forEach((h) => {
      row[h] = item[h] != null ? String(item[h]) : "";
    });
    return row;
  });
  return { sheet_name: "Sheet1", headers, rows };
}

// ─── Parallel runner with concurrency limit ───────────────────
// Simple worker-pool pattern. Returns results in the same order as the
// input items array. Errors from fn() are not caught here — fn should
// handle its own errors and return a safe value (e.g. null).
async function runParallel<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const _userId = await requireAuth(req);
    const { survey_id } = await req.json();

    if (!survey_id) {
      return jsonResponse({ error: "survey_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch the survey record
    const { data: survey, error: surveyErr } = await supabase
      .from("st_surveys")
      .select("*")
      .eq("id", survey_id)
      .single();

    if (surveyErr || !survey) {
      return jsonResponse({ error: "Survey not found" }, 404);
    }

    // 2. Mark as ingesting
    await supabase
      .from("st_surveys")
      .update({ status: "ingesting" })
      .eq("id", survey_id);

    // 3. Download file from storage
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("st-surveys")
      .download(survey.file_path);

    if (fileErr || !fileData) {
      await markFailed(supabase, survey_id, "Failed to download file from storage");
      return jsonResponse({ error: "Failed to download file" }, 500);
    }

    // 4. Parse the file into normalised sheets
    let sheets: ParsedSheet[];
    try {
      sheets = await parseFile(fileData, survey.file_type);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Parse error";
      await markFailed(supabase, survey_id, msg);
      return jsonResponse({ error: `File parsing failed: ${msg}` }, 500);
    }

    if (sheets.length === 0 || sheets.every((s) => s.rows.length === 0)) {
      await markFailed(supabase, survey_id, "No data rows found in file");
      return jsonResponse({ error: "Survey file contains no data" }, 400);
    }

    // 5. Build response rows + accumulate per-question buckets
    const allQuestionHeaders = new Map<string, string[]>();
    const rowsToInsert: Array<Record<string, unknown>> = [];

    for (const sheet of sheets) {
      for (let ri = 0; ri < sheet.rows.length; ri++) {
        const row = sheet.rows[ri];
        for (const header of sheet.headers) {
          const value = row[header];
          if (!value || value.trim().length === 0) continue;
          rowsToInsert.push({
            survey_id,
            sheet_name: sheet.sheet_name,
            question_header: header,
            response_value: value,
            respondent_index: ri,
          });
          if (!allQuestionHeaders.has(header)) {
            allQuestionHeaders.set(header, []);
          }
          allQuestionHeaders.get(header)!.push(value);
        }
      }
    }

    // 6. Batch insert responses (500 rows per call). Previously one insert
    //    per cell which killed the 150s timeout on any survey above ~1000
    //    response cells.
    const BATCH_SIZE = 500;
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("st_survey_responses")
        .insert(batch);
      if (error) {
        await markFailed(
          supabase,
          survey_id,
          `Response insert failed: ${error.message}`,
        );
        return jsonResponse(
          { error: `Response insert failed: ${error.message}` },
          500,
        );
      }
    }

    const totalResponses = rowsToInsert.length;
    const questionList = [...allQuestionHeaders.entries()].map((
      [header, responses],
    ) => ({
      header,
      responses,
    }));

    // 7. Hand off to background. EdgeRuntime.waitUntil keeps the function
    //    alive past the response, so the browser gets its 202 immediately
    //    and the LLM analysis continues server-side.
    const bgPromise = runBackgroundAnalysis(
      supabase,
      survey,
      questionList,
      totalResponses,
    );
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") {
      er.waitUntil(bgPromise);
    } else {
      // Local-dev fallback: at least don't drop the promise on the floor.
      bgPromise.catch((e) => console.error("Background analysis failed:", e));
    }

    return jsonResponse(
      {
        success: true,
        survey_id,
        response_count: totalResponses,
        questions_total: questionList.filter((q) => q.responses.length >= 3)
          .length,
        status: "analysing",
        message:
          "File parsed and responses saved. LLM analysis running in background. Poll the survey row until status changes from 'ingesting' to 'ingested' or 'failed'.",
      },
      202,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-ingest-survey error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});

// ─── Background analysis ──────────────────────────────────────
// Runs after the synchronous 202 response. Uses Gemini 2.5 Flash for the
// per-question analysis loop and chunk extraction (40+ structured-output
// calls, latency dominates). Uses Claude Sonnet 4 for the single overall
// summary call (prose quality matters there; cost is rounding error).

interface QuestionSummary {
  header: string;
  response_count: number;
  themes: unknown[];
  sentiment: Record<string, number>;
  notable_quotes: string[];
  summary: string;
}

async function runBackgroundAnalysis(
  supabase: ReturnType<typeof createClient>,
  // deno-lint-ignore no-explicit-any
  survey: any,
  questionList: Array<{ header: string; responses: string[] }>,
  totalResponses: number,
): Promise<void> {
  try {
    const eligible = questionList.filter((q) => q.responses.length >= 3);
    console.log(
      `[bg] Survey ${survey.id}: analysing ${eligible.length} questions of ${questionList.length} total (skipped questions with <3 responses)`,
    );

    if (!GOOGLE_API_KEY) {
      throw new Error(
        "GOOGLE_API_KEY not configured — per-question analysis requires Gemini Flash",
      );
    }

    // 7. Per-question Gemini Flash analysis, concurrency 5
    const analysisResults = await runParallel(
      eligible,
      5,
      async (q): Promise<QuestionSummary | null> => {
        try {
          const input = `Question: "${q.header}"\n\nResponses (${q.responses.length} total):\n${
            q.responses
              .slice(0, 200) // Cap at 200 responses to stay within context
              .map((r, i) => `${i + 1}. ${r}`)
              .join("\n")
          }`;
          const result = await callLLM(
            FLASH_CONFIG,
            QUESTION_ANALYSIS_PROMPT,
            [{ role: "user", content: input }],
            4000,
          );
          const parsed = parseJSONFromLLM(result);
          if (!parsed) return null;
          return {
            header: q.header,
            response_count: q.responses.length,
            themes: parsed.themes ?? [],
            sentiment: parsed.sentiment ?? {},
            notable_quotes: parsed.notable_quotes ?? [],
            summary: parsed.summary ?? "",
          };
        } catch (e) {
          console.error(
            `[bg] Question analysis failed for "${q.header}":`,
            e instanceof Error ? e.message : e,
          );
          return null;
        }
      },
    );

    const questionSummaries: QuestionSummary[] = [];
    for (const r of analysisResults) {
      if (!r) continue;
      questionSummaries.push(r);
      await supabase.from("st_survey_question_summaries").insert({
        survey_id: survey.id,
        question_header: r.header,
        response_count: r.response_count,
        themes: r.themes,
        sentiment: r.sentiment,
        notable_quotes: r.notable_quotes,
        summary: r.summary,
      });
    }
    console.log(
      `[bg] Survey ${survey.id}: ${questionSummaries.length} question summaries persisted`,
    );

    // 8. Overall survey summary — Sonnet (single call)
    let overallSummary = "";
    if (questionSummaries.length > 0) {
      try {
        const summaryInput = questionSummaries
          .map((qs) =>
            `Q: "${qs.header}" (${qs.response_count} responses)\nSummary: ${qs.summary}`
          )
          .join("\n\n");
        overallSummary = await callLLM(
          SONNET_CONFIG,
          SURVEY_SUMMARY_PROMPT,
          [{ role: "user", content: summaryInput }],
          500,
        );
        overallSummary = overallSummary.trim().replace(/^["']|["']$/g, "");
      } catch (e) {
        console.error(
          `[bg] Overall summary failed:`,
          e instanceof Error ? e.message : e,
        );
        overallSummary =
          `Survey with ${totalResponses} responses across ${questionSummaries.length} questions.`;
      }
    } else {
      overallSummary =
        `Survey with ${totalResponses} responses. No questions met the minimum response threshold (3) for individual analysis.`;
    }

    // 9. Chunk extraction (Gemini Flash, concurrency 5)
    const chunkResults = await runParallel(
      questionSummaries,
      5,
      async (qs) => {
        try {
          const chunkInput =
            `Survey: "${survey.name}" (${survey.period ?? "no period"})\nQuestion: "${qs.header}"\nResponse count: ${qs.response_count}\nSummary: ${qs.summary}\nThemes: ${
              JSON.stringify(qs.themes)
            }\nNotable quotes: ${JSON.stringify(qs.notable_quotes)}`;
          const result = await callLLM(
            FLASH_CONFIG,
            SURVEY_CHUNK_PROMPT,
            [{ role: "user", content: chunkInput }],
            3000,
          );
          return { qs, chunks: parseChunksFromLLM(result) };
        } catch (e) {
          console.error(
            `[bg] Chunk extraction failed for "${qs.header}":`,
            e instanceof Error ? e.message : e,
          );
          return {
            qs,
            chunks: [] as Array<
              { chunk_text: string; chunk_summary: string; topic_tags: string[] }
            >,
          };
        }
      },
    );

    const chunksToInsert: Array<Record<string, unknown>> = [];
    for (const { qs, chunks } of chunkResults) {
      for (const chunk of chunks) {
        chunksToInsert.push({
          source_app: "strategic-tool",
          engagement_id: survey.engagement_id,
          source_type: "survey",
          source_id: survey.id,
          document_source: survey.name,
          section_reference: qs.header,
          chunk_text: chunk.chunk_text,
          chunk_summary: chunk.chunk_summary,
          topic_tags: chunk.topic_tags,
          content_type: "survey",
          is_active: true,
          extraction_version: "st-survey-1.1",
        });
      }
    }
    let chunksCreated = 0;
    if (chunksToInsert.length > 0) {
      const { error } = await supabase
        .from("knowledge_chunks")
        .insert(chunksToInsert);
      if (!error) {
        chunksCreated = chunksToInsert.length;
      } else {
        console.error(`[bg] Chunk insert failed:`, error.message);
      }
    }
    console.log(`[bg] Survey ${survey.id}: ${chunksCreated} chunks created`);

    // 10. Final update — mark ingested
    await supabase
      .from("st_surveys")
      .update({
        status: "ingested",
        response_count: totalResponses,
        overall_summary: overallSummary,
        processed_at: new Date().toISOString(),
      })
      .eq("id", survey.id);

    console.log(`[bg] Survey ${survey.id}: ingestion complete`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[bg] Survey ${survey.id}: fatal error —`, msg);
    await markFailed(
      supabase,
      survey.id,
      `Background analysis failed: ${msg}`,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────

async function parseFile(blob: Blob, fileType: string): Promise<ParsedSheet[]> {
  const text = await blob.text();

  switch (fileType) {
    case "csv":
      return [parseCSV(text)];

    case "json":
      return [parseJSONSurvey(text)];

    case "xlsx":
    case "xls": {
      // Use SheetJS ESM build for Deno
      const XLSX = await import(
        "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"
      );
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: "array",
      });

      return workbook.SheetNames.map((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, unknown>[][] = XLSX.utils.sheet_to_json(
          sheet,
          { defval: "" },
        );
        if (jsonData.length === 0) {
          return { sheet_name: sheetName, headers: [], rows: [] };
        }

        const headers = Object.keys(jsonData[0]);
        const rows = jsonData.map((row) => {
          const out: Record<string, string> = {};
          headers.forEach((h) => {
            out[h] = row[h] != null ? String(row[h]) : "";
          });
          return out;
        });

        return { sheet_name: sheetName, headers, rows };
      });
    }

    default:
      // Try as CSV fallback
      return [parseCSV(text)];
  }
}

function parseJSONFromLLM(response: string): Record<string, unknown> | null {
  const trimmed = response.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    console.error("Failed to parse LLM JSON:", jsonStr.slice(0, 200));
    return null;
  }
}

function parseChunksFromLLM(
  response: string,
): Array<{ chunk_text: string; chunk_summary: string; topic_tags: string[] }> {
  const trimmed = response.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && "chunk_text" in item,
      )
      .map((item) => ({
        chunk_text: String(item.chunk_text || ""),
        chunk_summary: String(item.chunk_summary || ""),
        topic_tags: Array.isArray(item.topic_tags)
          ? item.topic_tags.map(String)
          : [],
      }));
  } catch {
    console.error("Failed to parse chunk JSON:", jsonStr.slice(0, 200));
    return [];
  }
}

async function markFailed(
  supabase: ReturnType<typeof createClient>,
  surveyId: string,
  reason: string,
): Promise<void> {
  console.error(`Survey ${surveyId} ingestion failed: ${reason}`);
  await supabase
    .from("st_surveys")
    .update({
      status: "failed",
      overall_summary: `Ingestion failed: ${reason}`,
      processed_at: new Date().toISOString(),
    })
    .eq("id", surveyId);
}
