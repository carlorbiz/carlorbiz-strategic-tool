import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLM } from "../_shared/llm.ts";
import type { LLMConfig } from "../_shared/llm.ts";

// ─── Environment ──────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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

// ─── LLM prompts ──────────────────────────────────────────────

const QUESTION_ANALYSIS_PROMPT = `You are a survey analyst for a strategic planning evidence platform. Analyse the responses to a single survey question.

Given a question header and a list of responses, produce:
1. "themes": an array of 2-6 theme objects, each with { "theme": string, "count": number, "example_quotes": string[] (1-3 verbatim quotes) }
2. "sentiment": { "positive": number, "neutral": number, "negative": number, "mixed": number } — counts, not percentages
3. "notable_quotes": array of 1-5 standout verbatim responses that capture key sentiments or insights
4. "summary": a 1-2 sentence plain-English summary of what respondents said

Return ONLY a JSON object with these four keys. No other text.`;

const SURVEY_SUMMARY_PROMPT = `You are a survey analyst for a strategic planning evidence platform. Given per-question summaries from a survey, write a 2-3 sentence overall summary capturing the key findings, dominant themes, and any notable tensions or surprises. Be specific — cite question topics and quantify where possible. Return ONLY the summary text, no quotes, no prefix.`;

const SURVEY_CHUNK_PROMPT = `You are a knowledge extraction specialist. Given a survey question summary (themes, sentiment, notable quotes), produce 1-3 knowledge chunks that capture the key findings as standalone facts.

Rules:
1. Each chunk must be self-contained and understandable without context
2. Reference the question topic and the survey name
3. Include specific figures or quoted evidence where available

Output a JSON array of objects, each with:
- "chunk_text": the self-contained knowledge statement
- "chunk_summary": a one-sentence summary
- "topic_tags": relevant tags as lowercase strings

Return ONLY the JSON array.`;

// ─── CSV parser ───────────────────────────────────────────────

interface ParsedSheet {
  sheet_name: string;
  headers: string[];
  rows: Record<string, string>[];
}

function parseCSV(text: string, sheetName = "Sheet1"): ParsedSheet {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { sheet_name: sheetName, headers: [], rows: [] };

  // Simple CSV parse: handle quoted fields
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

// ─── JSON survey parser ───────────────────────────────────────

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

    // 5. Write normalised responses to st_survey_responses
    let totalResponses = 0;
    const allQuestionHeaders: Map<string, string[]> = new Map(); // header → response values

    for (const sheet of sheets) {
      for (let ri = 0; ri < sheet.rows.length; ri++) {
        const row = sheet.rows[ri];
        for (const header of sheet.headers) {
          const value = row[header];
          if (!value || value.trim().length === 0) continue;

          await supabase.from("st_survey_responses").insert({
            survey_id,
            sheet_name: sheet.sheet_name,
            question_header: header,
            response_value: value,
            respondent_index: ri,
          });
          totalResponses++;

          // Accumulate for per-question analysis
          if (!allQuestionHeaders.has(header)) {
            allQuestionHeaders.set(header, []);
          }
          allQuestionHeaders.get(header)!.push(value);
        }
      }
    }

    // 6. LLM config
    const llmConfig: LLMConfig = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: ANTHROPIC_API_KEY,
    };

    // 7. Per-question LLM analysis
    const questionSummaries: Array<{
      question_header: string;
      response_count: number;
      themes: unknown[];
      sentiment: Record<string, number>;
      notable_quotes: string[];
      summary: string;
    }> = [];

    for (const [header, responses] of allQuestionHeaders) {
      // Skip questions with fewer than 3 responses — not enough for analysis
      if (responses.length < 3) continue;

      try {
        const input = `Question: "${header}"\n\nResponses (${responses.length} total):\n${responses
          .slice(0, 200) // Cap at 200 responses to stay within context
          .map((r, i) => `${i + 1}. ${r}`)
          .join("\n")}`;

        const result = await callLLM(
          llmConfig,
          QUESTION_ANALYSIS_PROMPT,
          [{ role: "user", content: input }],
          4000
        );

        const parsed = parseJSONFromLLM(result);
        if (parsed) {
          const qSummary = {
            question_header: header,
            response_count: responses.length,
            themes: parsed.themes ?? [],
            sentiment: parsed.sentiment ?? {},
            notable_quotes: parsed.notable_quotes ?? [],
            summary: parsed.summary ?? "",
          };

          await supabase.from("st_survey_question_summaries").insert({
            survey_id,
            question_header: header,
            response_count: responses.length,
            themes: qSummary.themes,
            sentiment: qSummary.sentiment,
            notable_quotes: qSummary.notable_quotes,
            summary: qSummary.summary,
          });

          questionSummaries.push(qSummary);
        }
      } catch (e) {
        console.error(`Failed to analyse question "${header}":`, e);
        // Non-fatal: continue with other questions
      }
    }

    // 8. Overall survey summary
    let overallSummary = "";
    if (questionSummaries.length > 0) {
      try {
        const summaryInput = questionSummaries
          .map((qs) => `Q: "${qs.question_header}" (${qs.response_count} responses)\nSummary: ${qs.summary}`)
          .join("\n\n");

        overallSummary = await callLLM(
          llmConfig,
          SURVEY_SUMMARY_PROMPT,
          [{ role: "user", content: summaryInput }],
          500
        );
        overallSummary = overallSummary.trim().replace(/^["']|["']$/g, "");
      } catch {
        overallSummary = `Survey with ${totalResponses} responses across ${questionSummaries.length} questions.`;
      }
    }

    // 9. Chunk into knowledge_chunks
    let chunksCreated = 0;
    for (const qs of questionSummaries) {
      try {
        const chunkInput = `Survey: "${survey.name}" (${survey.period ?? "no period"})\nQuestion: "${qs.question_header}"\nResponse count: ${qs.response_count}\nSummary: ${qs.summary}\nThemes: ${JSON.stringify(qs.themes)}\nNotable quotes: ${JSON.stringify(qs.notable_quotes)}`;

        const result = await callLLM(
          llmConfig,
          SURVEY_CHUNK_PROMPT,
          [{ role: "user", content: chunkInput }],
          3000
        );

        const chunks = parseChunksFromLLM(result);
        for (const chunk of chunks) {
          const { error: chunkErr } = await supabase
            .from("knowledge_chunks")
            .insert({
              source_app: "strategic-tool",
              engagement_id: survey.engagement_id,
              source_type: "survey",
              source_id: survey_id,
              document_source: survey.name,
              section_reference: qs.question_header,
              chunk_text: chunk.chunk_text,
              chunk_summary: chunk.chunk_summary,
              topic_tags: chunk.topic_tags,
              content_type: "survey",
              is_active: true,
              extraction_version: "st-survey-1.0",
            });
          if (!chunkErr) chunksCreated++;
        }
      } catch (e) {
        console.error(`Failed to chunk question "${qs.question_header}":`, e);
      }
    }

    // 10. Update survey record
    await supabase
      .from("st_surveys")
      .update({
        status: "ingested",
        response_count: totalResponses,
        overall_summary: overallSummary,
        processed_at: new Date().toISOString(),
      })
      .eq("id", survey_id);

    return jsonResponse({
      success: true,
      survey_id,
      response_count: totalResponses,
      questions_analysed: questionSummaries.length,
      chunks_created: chunksCreated,
      summary: overallSummary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("st-ingest-survey error:", e);
    return jsonResponse({ error: msg }, 500);
  }
});

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
          { defval: "" }
        );
        if (jsonData.length === 0)
          return { sheet_name: sheetName, headers: [], rows: [] };

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
  response: string
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
          typeof item === "object" && item !== null && "chunk_text" in item
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
  reason: string
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
