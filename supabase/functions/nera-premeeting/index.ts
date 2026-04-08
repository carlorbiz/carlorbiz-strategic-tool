import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Nera, an AI facilitator for the Carlorbiz Strategic Planning Toolkit.
You are conducting a pre-meeting stakeholder engagement conversation to gather input before a Board strategic planning workshop.

Your role is to:
1. Ask thoughtful, open-ended questions that draw out rich stakeholder insights
2. Listen actively and probe deeper when stakeholders share important observations
3. Cover key strategic areas: challenges, opportunities, priorities, community needs, workforce issues
4. Maintain a warm, professional, and encouraging tone
5. Summarise key themes as they emerge
6. Thank participants for their contributions

Important guidelines:
- This is a Nera-conversation, not a survey — be conversational and adaptive
- Ask one question at a time
- Build on what the participant shares
- If they give brief answers, gently probe for more detail
- After 5-7 exchanges, begin to summarise themes and ask if there's anything else
- All input will feed directly into the workshop session

Current context: Pre-meeting stakeholder engagement for strategic planning.`;

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

    // Get conversation history from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let conversationHistory: { role: string; content: string }[] = [];

    if (session_id) {
      const { data } = await supabase
        .from('stakeholder_inputs')
        .select('conversation_history')
        .eq('nera_session_id', session_id)
        .single();

      if (data?.conversation_history) {
        conversationHistory = data.conversation_history;
      }
    }

    // Build messages for LLM
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: query },
    ];

    // Call LLM (Anthropic via OpenRouter or direct)
    const llmApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('OPENROUTER_API_KEY');
    const llmBaseUrl = Deno.env.get('ANTHROPIC_API_KEY')
      ? 'https://api.anthropic.com/v1/messages'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const isAnthropic = !!Deno.env.get('ANTHROPIC_API_KEY');

    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendSSE = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          sendSSE('meta', { type: 'nera_conversation', session_id });

          if (isAnthropic) {
            // Anthropic Messages API with streaming
            const response = await fetch(llmBaseUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': llmApiKey!,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: conversationHistory
                  .map((m: any) => ({ role: m.role, content: m.content }))
                  .concat([{ role: 'user', content: query }]),
                stream: true,
              }),
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
                    if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                      fullResponse += parsed.delta.text;
                      sendSSE('delta', { text: parsed.delta.text });
                    }
                  } catch {
                    // Skip malformed events
                  }
                }
              }
            }

            // Save updated conversation
            const updatedHistory = [
              ...conversationHistory,
              { role: 'user', content: query },
              { role: 'assistant', content: fullResponse },
            ];

            await supabase.from('stakeholder_inputs').upsert(
              {
                session_id: workshop_session_id,
                user_id: user_id || null,
                input_type: 'nera_conversation',
                nera_session_id: session_id,
                conversation_history: updatedHistory,
                content: { message_count: updatedHistory.length },
                status: 'in_progress',
              },
              { onConflict: 'nera_session_id' },
            );
          } else {
            // OpenRouter / OpenAI-compatible API
            const response = await fetch(llmBaseUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${llmApiKey}`,
              },
              body: JSON.stringify({
                model: 'anthropic/claude-sonnet-4-20250514',
                messages,
                stream: true,
              }),
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
                    const delta = parsed.choices?.[0]?.delta?.content;
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

            // Save updated conversation
            const updatedHistory = [
              ...conversationHistory,
              { role: 'user', content: query },
              { role: 'assistant', content: fullResponse },
            ];

            await supabase.from('stakeholder_inputs').upsert(
              {
                session_id: workshop_session_id,
                user_id: user_id || null,
                input_type: 'nera_conversation',
                nera_session_id: session_id,
                conversation_history: updatedHistory,
                content: { message_count: updatedHistory.length },
                status: 'in_progress',
              },
              { onConflict: 'nera_session_id' },
            );
          }

          sendSSE('done', {});
          controller.close();
        } catch (err) {
          const sendSSE = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };
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
