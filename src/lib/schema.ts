/** A URL only proves the page was fetched; the verbatim `quote` is what makes the claim checkable. */
export type Fact = {
  claim: string;
  quote: string;
  sourceUrl: string;
  sourceTitle: string;
};

export const SECTIONS = [
  'leadership',
  'fleet',
  'funding',
  'news',
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  leadership: 'Who runs it',
  fleet: 'Current fleet',
  funding: 'Budget & grants',
  news: 'Recent activity',
};

export type Department = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
  website?: string;
  lat: number;
  lng: number;
};

export type Source = {
  url: string;
  title: string;
  text: string;
};

export type Brief = {
  department: Department;
  /** One-line reason to call, synthesized from verified facts only. Empty when unavailable. */
  headline: string;
  sections: Record<Section, Fact[]>;
  /** Sections we searched but found nothing verifiable for. */
  gaps: Section[];
  generatedAt: string;
};

export type BriefResponse = Brief | { error: string };

/** Markers become spaces, never nothing, so words never get joined. Pipes are left to the caller. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)#{1,6}(?=\s|$)/g, ' ')
    .replace(/(^|\s)>+(?=\s|$)/g, ' ')
    .replace(/[*_`]/g, ' ');
}

/** A model copying a span verbatim quotes what the page reads as, not its markup, so both sides are stripped before comparing. */
export function normalize(s: string): string {
  return stripMarkdown(
    s
      .toLowerCase()
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐-―]/g, '-'),
  )
    // Blunter than display on purpose: in-word # and > go too, so a quote matches whether or not the model copied them.
    .replace(/[#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Below this, a quote matches by accident and proves nothing. */
const MIN_QUOTE_CHARS = 15;

export function quoteAppearsIn(quote: string, sourceText: string): boolean {
  const q = normalize(quote);
  if (q.length < MIN_QUOTE_CHARS) return false;
  return normalize(sourceText).includes(q);
}

/** Null when the URL cannot be parsed, so callers choose their own fallback. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
