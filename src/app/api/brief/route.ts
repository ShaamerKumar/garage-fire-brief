import { NextResponse } from 'next/server';
import { lookupPlace, PlacesError } from '@/lib/places';
import { research } from '@/lib/research';
import type { Brief } from '@/lib/schema';

/**
 * Research runs ~15-25s in the wild. The platform default would cut a slow
 * department off mid-flight, so give it room to fail cleanly instead.
 */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let placeId: string;
  try {
    ({ placeId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a placeId.' }, { status: 400 });
  }

  placeId = placeId?.trim();
  if (!placeId) {
    return NextResponse.json({ error: 'Enter a Google Place ID.' }, { status: 400 });
  }

  try {
    const department = await lookupPlace(placeId);
    const { sections, gaps } = await research(department);
    const brief: Brief = {
      department,
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
