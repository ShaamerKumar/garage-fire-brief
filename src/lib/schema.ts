/**
 * A single sourced statement on the brief.
 *
 * `quote` is verbatim text from the source page. It is what makes the citation
 * checkable: we string-match it back against the fetched page content and drop
 * any fact whose quote is not actually present. A URL alone only proves the page
 * was fetched, not that it says what we claim.
 */
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
  sections: Record<Section, Fact[]>;
  /** Sections we searched but found nothing verifiable for — shown as explicit gaps. */
  gaps: Section[];
  generatedAt: string;
};

/**
 * Normalize for quote matching. Source text arrives as markdown with inconsistent
 * whitespace, and models routinely straighten curly quotes and dashes when copying
 * a quote out, so an exact === comparison rejects quotes that are genuinely present.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `quote` genuinely appears in `sourceText`. */
export function quoteAppearsIn(quote: string, sourceText: string): boolean {
  const q = normalize(quote);
  // Very short quotes match by accident and prove nothing.
  if (q.length < 15) return false;
  return normalize(sourceText).includes(q);
}
