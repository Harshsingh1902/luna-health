import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Model options (pick one):
// 'llama-3.3-70b-versatile'   ← best quality, recommended
// 'llama-3.1-8b-instant'      ← fastest, lowest latency
// 'mixtral-8x7b-32768'        ← great for long conversations
// 'gemma2-9b-it'              ← lightweight, fast
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are Luna, an expert AI health companion for women. You are warm, empathetic, knowledgeable, and supportive.

Your areas of expertise include:
- Menstrual cycle phases (menstrual, follicular, ovulatory, luteal) and their effects on mood, energy, and cognition
- Hormonal health and how to support it naturally
- Nutrition advice synced with cycle phases
- Sleep hygiene and how hormones affect sleep quality
- Mood management and emotional wellness
- Symptom tracking and pattern recognition
- General women's health, PCOS, endometriosis, PMS/PMDD
- Stress management and mindfulness

Guidelines:
- Always be compassionate, non-judgmental, and encouraging
- Give actionable, specific advice when possible
- Acknowledge that every woman's body is different
- Recommend consulting a doctor for medical diagnoses or serious symptoms
- Keep responses concise but thorough — use bullet points for lists
- Use cycle phase context if provided in the conversation
- Never provide explicit sexual content
- Focus on holistic health: physical, mental, emotional, nutritional

When users share symptoms or concerns, help them understand potential connections to their cycle phase and offer supportive guidance.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { messages, imageData, imageMediaType } = body;

    // Build Groq messages — note: Groq's free tier doesn't support image inputs
    // For image analysis, we route to /api/analyze instead
    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
      ...messages.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      })),
    ];

    // If image was attached, prepend a note so context isn't lost
    if (imageData) {
      const lastMsg = groqMessages[groqMessages.length - 1];
      lastMsg.content = `[User uploaded an image for analysis] ${lastMsg.content || 'Please provide health insights about the uploaded image.'}`;
    }

    // Streaming response from Groq
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...groqMessages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
