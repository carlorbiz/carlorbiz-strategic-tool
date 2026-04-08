import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  question: `You are Nera, an AI assistant embedded in a live strategic planning workshop facilitated by Carla.
You have access to the workshop's strategic plan data, stakeholder pre-meeting input, and all decisions made during the session.
Answer questions about the data, provide analysis, and help the facilitator make informed decisions.
Be concise, data-driven, and actionable. Reference specific data points when available.`,

  swot_categorisation: `You are Nera, performing SWOT analysis for a strategic planning workshop.
Categorise the provided text into Strengths, Weaknesses, Opportunities, and Threats.
For each item:
1. Assign a SWOT category
2. Assign a priority: HIGH, MEDIUM, or LOW
3. Provide a brief rationale

Format your response as a structured analysis with clear headings.
Use the exact priority labels: HIGH, MEDIUM, LOW.`,

  narrative_summary: `You are Nera, generating a narrative summary for a Board strategy document.
Based on the workshop decisions, stakeholder input, and analysis provided, create a professional
narrative suitable for inclusion in a Board-approved strategy document.
The summary should:
1. Be written in formal but accessible language
2. Reference specific decisions and their rationale
3. Include impact analysis where relevant
4. Follow a logical flow from context → decisions → expected outcomes
5. Be suitable for executive-level readers`,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, session_id, user_id, workshop_session_id, context } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Determine chat function from context or query prefix
    let chatFunction = 'question';
    let cleanQuery = query;

    if (query.startsWith('[SWOT Analysis Request] ')) {
      chatFunction = 'swot_categorisation';
      cleanQuery = query.replace('[SWOT Analysis Request] ', '');
    } else if (query.startsWith('[Narrative Summary Request] ')) {
      chatFunction = 'narrative_summary';
      cleanQuery = query.replace('[Narrative Summary Request] ', '');
    }

    // Fetch workshop context from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let workshopContext = '';

    if (workshop_session_id) {
      // Get decisions
      const { data: decisions } = await supabase
        .from('workshop_decisions')
        .select('*')
        .eq('session_id', workshop_session_id);

      if (decisions?.length) {
        workshopContext += '\n\nWorkshop Decisions:\n';
        decisions.forEach((d: any) => {
          workshopContext += `- [${d.priority}] ${d.title} (${d.status}): ${d.description || ''}\n`;
        });
      }

      // Get stakeholder inputs
      const { data: inputs } = await supabase
        .from('stakeholder_inputs')
        .select('conversation_history, insights_extracted')
        .eq('session_id', workshop_session_id);

      if (inputs?.length) {
        workshopContext += '\n\nPre-Meeting Stakeholder Input:\n';
        inputs.forEach((input: any) => {
          if (input.insights_extracted) {
            workshopContext += JSON.stringify(input.insights_extracted) + '\n';
          } else if (input.conversation_history) {
            const userMessages = input.conversation_history
              .filter((m: any) => m.role === 'user')
              .map((m: any) => m.content);
            workshopContext += userMessages.join('\n') + '\n';
          }
        });
      }

      // Get OCR text from photos
      const { data: photos } = await supabase
        .from('workshop_photos')
        .select('ocr_text, swot_category, priority')
        .eq('session_id', workshop_session_id)
        .eq('ocr_status', 'completed');

      if (photos?.length) {
        workshopContext += '\n\nOCR-Extracted Workshop Materials:\n';
        photos.forEach((p: any) => {
          if (p.ocr_text) {
            workshopContext += `- ${p.ocr_text}`;
            if (p.swot_category) workshopContext += ` [SWOT: ${p.swot_category}]`;
            if (p.priority) workshopContext += ` [Priority: ${p.priority}]`;
            workshopContext += '\n';
          }
        });
      }
    }

    const systemPrompt = SYSTEM_PROMPTS[chatFunction] + workshopContext;

    // Call LLM
    const llmApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('OPENROUTER_API_KEY');
    const isAnthropic = !!Deno.env.get('ANTHROPIC_API_KEY');
    const llmBaseUrl = isAnthropic
      ? 'https://api.anthropic.com/v1/messages'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendSSE = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendSSE('meta', { type: chatFunction, session_id });

          const requestBody = isAnthropic
            ? {
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                system: systemPrompt,
                messages: [{ role: 'user', content: cleanQuery }],
                stream: true,
              }
            : {
                model: 'anthropic/claude-sonnet-4-20250514',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: cleanQuery },
                ],
                stream: true,
              };

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isAnthropic) {
            headers['x-api-key'] = llmApiKey!;
            headers['anthropic-version'] = '2023-06-01';
          } else {
            headers['Authorization'] = `Bearer ${llmApiKey}`;
          }

          const response = await fetch(llmBaseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
          });

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullResponse = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  const delta = isAnthropic
                    ? parsed.delta?.text
                    : parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    fullResponse += delta;
                    sendSSE('delta', { text: delta });
                  }
                } catch {
                  // Skip
                }
              }
            }
          }

          // Save chat message
          if (workshop_session_id) {
            await supabase.from('workshop_chat_messages').insert([
              {
                session_id: workshop_session_id,
                role: 'user',
                content: cleanQuery,
                chat_function: chatFunction,
              },
              {
                session_id: workshop_session_id,
                role: 'assistant',
                content: fullResponse,
                chat_function: chatFunction,
              },
            ]);
          }

          sendSSE('done', {});
          controller.close();
        } catch (err) {
          sendSSE('error', { message: err.message || 'Internal error' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
