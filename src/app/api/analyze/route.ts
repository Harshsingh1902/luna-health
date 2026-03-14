import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Luna, an AI health companion for women. When analyzing images:
- For nutrition labels: break down key nutrients, highlight what's good/bad for hormonal health, and give a recommendation
- For health reports or lab results: explain what the values mean in plain language and note any values that should be discussed with a doctor
- For food photos: estimate nutritional content, note if it's cycle-phase friendly, and suggest improvements
- For symptom photos (skin, etc.): describe what you observe and recommend whether to see a doctor
- Always be thorough but accessible, and remind users to consult healthcare providers for medical decisions.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { imageData, mediaType, prompt } = body;

    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${imageData}`,
              },
            },
            {
              type: 'text',
              text: prompt || 'Please analyze this image and provide relevant health insights.',
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    });

    const analysis = response.choices[0]?.message?.content ?? '';
    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Analyze API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
