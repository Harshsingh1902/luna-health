import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// Use the fastest model for voice — low latency is key
const GROQ_VOICE_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are Luna, a warm and knowledgeable AI health companion for women. You specialize in women's health including menstrual cycles, hormonal health, mood, nutrition, and sleep. Keep responses conversational, empathetic, and concise (2-3 paragraphs max since this is a voice conversation). Always be supportive and actionable. Avoid using markdown formatting like bullet points or headers — speak naturally.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { transcript, conversationHistory = [] } = body;

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const response = await groq.chat.completions.create({
      model: GROQ_VOICE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: transcript },
      ],
      max_tokens: 512,
      temperature: 0.7,
      stream: false,
    });

    const text = response.choices[0]?.message?.content ?? '';

    return NextResponse.json({ text, usage: response.usage });
  } catch (error: any) {
    console.error('Voice API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
