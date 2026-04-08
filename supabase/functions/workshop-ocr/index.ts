import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SYSTEM_PROMPT = `You are an OCR and analysis assistant for a strategic planning workshop.
You will receive an image of workshop materials (sticky notes, whiteboards, handwritten notes).

Your tasks:
1. Extract ALL text visible in the image accurately
2. Categorise each item into a SWOT category: strength, weakness, opportunity, or threat
3. Assign a priority level: HIGH, MEDIUM, or LOW
4. Group related items together

Return your response as JSON with this structure:
{
  "ocr_text": "Full extracted text",
  "items": [
    {
      "text": "Individual item text",
      "swot_category": "strength|weakness|opportunity|threat",
      "priority": "HIGH|MEDIUM|LOW",
      "confidence": 0.95
    }
  ],
  "overall_priority": "HIGH|MEDIUM|LOW",
  "overall_swot": "strength|weakness|opportunity|threat",
  "summary": "Brief summary of the content"
}`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photo_id, image_url } = await req.json();

    if (!photo_id || !image_url) {
      return new Response(
        JSON.stringify({ error: 'photo_id and image_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mark as processing
    await supabase
      .from('workshop_photos')
      .update({ ocr_status: 'processing' })
      .eq('id', photo_id);

    // Use Gemini for vision OCR (best for handwriting)
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    let ocrResult: any;

    if (geminiKey) {
      // Gemini Vision API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: OCR_SYSTEM_PROMPT },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: await fetchImageAsBase64(image_url),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      ocrResult = JSON.parse(text);
    } else if (anthropicKey) {
      // Anthropic Vision API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: OCR_SYSTEM_PROMPT },
                {
                  type: 'image',
                  source: { type: 'url', url: image_url },
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '{}';
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [null, text];
      ocrResult = JSON.parse(jsonMatch[1] || '{}');
    } else {
      throw new Error('No vision API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY required)');
    }

    // Update the photo record with OCR results
    await supabase
      .from('workshop_photos')
      .update({
        ocr_status: 'completed',
        ocr_text: ocrResult.ocr_text || '',
        ocr_confidence: ocrResult.items?.[0]?.confidence || null,
        priority: ocrResult.overall_priority || null,
        swot_category: ocrResult.overall_swot || null,
        tags: ocrResult.items?.map((i: any) => i.swot_category).filter(Boolean) || [],
      })
      .eq('id', photo_id);

    // Create knowledge chunks from OCR results for Nera AI
    if (ocrResult.items?.length) {
      const chunks = ocrResult.items.map((item: any) => ({
        session_id: null, // Will be set by the caller
        source_type: 'ocr_text',
        source_id: photo_id,
        title: `OCR: ${item.text?.slice(0, 50)}`,
        content: item.text,
        metadata: {
          swot_category: item.swot_category,
          priority: item.priority,
          confidence: item.confidence,
        },
      }));

      // Get session_id from the photo
      const { data: photo } = await supabase
        .from('workshop_photos')
        .select('session_id')
        .eq('id', photo_id)
        .single();

      if (photo?.session_id) {
        for (const chunk of chunks) {
          chunk.session_id = photo.session_id;
        }
        await supabase.from('knowledge_chunks').insert(chunks);
      }
    }

    return new Response(
      JSON.stringify({ success: true, result: ocrResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Mark as failed if we have the photo_id
    try {
      const { photo_id } = await req.clone().json();
      if (photo_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from('workshop_photos')
          .update({ ocr_status: 'failed' })
          .eq('id', photo_id);
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ error: err.message || 'OCR processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
