import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are Luna, a warm and knowledgeable AI health companion for women. Keep responses conversational, empathetic, and concise. Always be supportive and actionable. Avoid markdown formatting — speak naturally.`;

export async function POST(request: NextRequest) {
  try {
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { transcript, conversationHistory = [] } = body;

    if (!transcript) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
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
