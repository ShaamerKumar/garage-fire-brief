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
  /** One-line reason to call, synthesized from verified facts only. Empty when unavailable. */
  headline: string;
  sections: Record<Section, Fact[]>;
  /** Sections we searched but found nothing verifiable for — shown as explicit gaps. */
  gaps: Section[];
  generatedAt: string;
};

/**
 * Normalize for quote matching.
 *
 * Sources arrive as markdown. A model asked to copy a span verbatim reliably
 * quotes what the page *reads* as, not its markup: given "Thomas Jugan\n\n######
 * Fire Chief" it returns "Thomas Jugan\n\nFire Chief". Comparing raw strings
 * therefore rejects facts that are genuinely on the page — and because a rejected
 * fact just vanishes, that failure is invisible. So strip markup and punctuation
 * variants from both sides before comparing.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    // Markdown the model drops when quoting: headings, emphasis, code, quotes,
    // table pipes, list bullets, and link/image brackets.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]/g, ' ')
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
