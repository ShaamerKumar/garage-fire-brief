import type { Source } from './schema';

const ENDPOINT = 'https://api.tavily.com/search';

/**
 * Aggregators and review sites. They rank well for department names but carry no
 * sales-relevant facts, and they block extraction so `raw_content` comes back empty.
 */
const JUNK_DOMAINS = [
  'mapquest.com',
  'zoominfo.com',
  'yelp.com',
  'yellowpages.com',
  'bbb.org',
  'indeed.com',
  'glassdoor.com',
  'buzzfile.com',
  'manta.com',
];

type TavilyResult = {
  url: string;
  title: string;
  content: string;
  raw_content: string | null;
  score: number;
};

export type SearchOptions = {
  includeDomains?: string[];
  /** 'day' | 'week' | 'month' | 'year' — used to bias news queries toward recency. */
  timeRange?: string;
  maxResults?: number;
};

export async function search(
  query: string,
  opts: SearchOptions = {},
): Promise<Source[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not set');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      max_results: opts.maxResults ?? 8,
      search_depth: 'advanced',
      // Must be boolean. The documented "markdown" string silently returns null.
      include_raw_content: true,
      ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}),
      ...(opts.timeRange ? { time_range: opts.timeRange } : {}),
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Tavily error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data: { results?: TavilyResult[] } = await res.json();
  return (data.results ?? []).flatMap((r) => {
    // Some results (notably social) return an opaque token where a URL belongs.
    // An un-linkable citation is worse than no fact, so drop them.
    if (!r.url?.startsWith('http')) return [];
    if (JUNK_DOMAINS.some((d) => r.url.includes(d))) return [];

    // Prefer extracted page text; fall back to the snippet when extraction was blocked.
    const text = r.raw_content?.trim() || r.content?.trim() || '';
    if (text.length < 200) return [];

    return [{ url: r.url, title: r.title || r.url, text: text.slice(0, 12_000) }];
  });
}

/**
 * Merge result sets from parallel queries, round-robin.
 *
 * Concatenating and truncating lets one broad query fill every slot: a generic
 * "fire grants" search returns six FEMA program pages and crowds out the narrow
 * query that found the actual bid notice. Interleaving guarantees each query
 * contributes its best result before any query contributes its second.
 */
export function dedupe(groups: Source[][]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  const depth = Math.max(0, ...groups.map((g) => g.length));

  for (let rank = 0; rank < depth; rank++) {
    for (const group of groups) {
      const s = group[rank];
      if (!s || seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}
