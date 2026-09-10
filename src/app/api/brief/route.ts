import { NextResponse } from 'next/server';
import { lookupPlace, PlacesError } from '@/lib/places';
import { research } from '@/lib/research';
import type { Brief } from '@/lib/schema';

// Research runs ~15-25s; 60s bounds a runaway request well under the 300s platform ceiling.
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a placeId.' }, { status: 400 });
  }

  const raw =
    typeof body === 'object' && body !== null && 'placeId' in body ? body.placeId : undefined;
  const placeId = typeof raw === 'string' ? raw.trim() : '';
  if (!placeId) {
    return NextResponse.json({ error: 'Enter a Google Place ID.' }, { status: 400 });
  }

  try {
    const department = await lookupPlace(placeId);
    const { sections, gaps, headline } = await research(department);
    const brief: Brief = {
      department,
      headline,
      sections,
      gaps,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(brief);
  } catch (err) {
    if (err instanceof PlacesError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('brief failed', err);
    return NextResponse.json(
      { error: 'Research failed. Try again in a moment.' },
      { status: 500 },
    );
  }
}
