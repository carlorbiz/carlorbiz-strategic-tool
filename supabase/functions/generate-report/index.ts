import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPORT_SYSTEM_PROMPT = `You are Nera, generating a Board-approved strategy document for a strategic planning workshop facilitated by Carla.

Generate a comprehensive strategy report in Markdown format with the following sections:

1. **Executive Summary** — High-level overview of the workshop outcomes
2. **Strategic Context** — Background and current situation
3. **Stakeholder Input Summary** — Key themes from pre-meeting engagement
4. **Workshop Decisions** — All decisions made, organised by category and priority
5. **SWOT Analysis** — Consolidated strengths, weaknesses, opportunities, threats
6. **Impact Analysis** — Expected outcomes of approved decisions
7. **Prioritised Initiatives** — Ranked list of approved initiatives with timelines
8. **Recommendations** — Next steps and implementation guidance
9. **Appendix** — Supporting data and methodology

Use professional, formal language suitable for Board-level readers.
Reference specific decisions, data points, and stakeholder quotes where available.
Use the exact priority labels: HIGH, MEDIUM, LOW.`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, report_type = 'board_strategy' } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Gather all workshop data
    const [
      { data: session },
      { data: decisions },
      { data: inputs },
      { data: photos },
      { data: chatMessages },
    ] = await Promise.all([
      supabase.from('workshop_sessions').select('*').eq('id', session_id).single(),
      supabase.from('workshop_decisions').select('*').eq('session_id', session_id).order('priority'),
      supabase.from('stakeholder_inputs').select('*').eq('session_id', session_id),
      supabase.from('workshop_photos').select('*').eq('session_id', session_id).eq('ocr_status', 'completed'),
      supabase.from('workshop_chat_messages').select('*').eq('session_id', session_id).eq('chat_function', 'narrative_summary'),
    ]);

    // Build context for the LLM
    let context = `Workshop: ${session?.name || 'Strategic Planning Workshop'}\n`;
    context += `Client: ${session?.client_name || 'N/A'}\n`;
    context += `Date: ${new Date().toLocaleDateString('en-AU', { dateStyle: 'long' })}\n\n`;

    if (decisions?.length) {
      context += '## Workshop Decisions\n';
      decisions.forEach((d: any) => {
        context += `- **[${d.priority}] ${d.title}** (${d.status})\n`;
        if (d.description) context += `  ${d.description}\n`;
        if (d.impact_analysis) context += `  Impact: ${JSON.stringify(d.impact_analysis)}\n`;
      });
      context += '\n';
    }

    if (inputs?.length) {
      context += '## Pre-Meeting Stakeholder Input\n';
      inputs.forEach((input: any) => {
        if (input.insights_extracted) {
          context += JSON.stringify(input.insights_extracted) + '\n';
        } else if (input.conversation_history) {
          const userMsgs = input.conversation_history
            .filter((m: any) => m.role === 'user')
            .map((m: any) => `- ${m.content}`);
          context += userMsgs.join('\n') + '\n';
        }
      });
      context += '\n';
    }

    if (photos?.length) {
      context += '## OCR-Extracted Materials\n';
      photos.forEach((p: any) => {
        if (p.ocr_text) {
          context += `- ${p.ocr_text}`;
          if (p.swot_category) context += ` [${p.swot_category.toUpperCase()}]`;
          if (p.priority) context += ` [${p.priority}]`;
          context += '\n';
        }
      });
      context += '\n';
    }

    if (chatMessages?.length) {
      context += '## AI-Generated Narrative Summaries\n';
      chatMessages
        .filter((m: any) => m.role === 'assistant')
        .forEach((m: any) => {
          context += m.content + '\n\n';
        });
    }

    // Generate report via LLM (streaming)
    const llmApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('OPENROUTER_API_KEY');
    const isAnthropic = !!Deno.env.get('ANTHROPIC_API_KEY');
    const llmBaseUrl = isAnthropic
      ? 'https://api.anthropic.com/v1/messages'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isAnthropic) {
      headers['x-api-key'] = llmApiKey!;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${llmApiKey}`;
    }

    const requestBody = isAnthropic
      ? {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: REPORT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Generate a ${report_type} report based on this workshop data:\n\n${context}` }],
        }
      : {
          model: 'anthropic/claude-sonnet-4-20250514',
          messages: [
            { role: 'system', content: REPORT_SYSTEM_PROMPT },
            { role: 'user', content: `Generate a ${report_type} report based on this workshop data:\n\n${context}` },
          ],
        };

    const llmResponse = await fetch(llmBaseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const llmData = await llmResponse.json();
    const reportContent = isAnthropic
      ? llmData.content?.[0]?.text || ''
      : llmData.choices?.[0]?.message?.content || '';

    // Save report
    const { data: report } = await supabase
      .from('workshop_reports')
      .insert({
        session_id,
        title: `${session?.name || 'Workshop'} — Strategy Report`,
        report_type,
        content: {
          markdown: reportContent,
          generated_at: new Date().toISOString(),
          data_sources: {
            decisions_count: decisions?.length || 0,
            inputs_count: inputs?.length || 0,
            photos_count: photos?.length || 0,
          },
        },
        status: 'draft',
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report?.id,
        content: reportContent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Report generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
