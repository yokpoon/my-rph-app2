import { NextRequest, NextResponse } from 'next/server';
import { generateDeterministicRph } from '@/lib/promptEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { grade, className, subjectName, sk, sps, pedagogy, customNote } = body;

    if (!grade || !subjectName || !sk || !Array.isArray(sps) || sps.length === 0) {
      return NextResponse.json(
        { error: 'Maklumat tidak lengkap (Tahun, Subjek, SK, dan SP diperlukan).' },
        { status: 400 }
      );
    }

    // Generate structured SJK(C) lesson plan (works immediately without requiring external API keys)
    const generated = generateDeterministicRph({
      grade,
      className,
      subjectName,
      sk,
      sps,
      pedagogy,
      customNote,
    });

    return NextResponse.json({
      success: true,
      meta: {
        grade,
        className,
        subjectName,
        sk,
        sps,
        generatedAt: new Date().toISOString(),
      },
      rph: generated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ralat pelayan semasa menjana RPH.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
