import {
  SECTIONS,
  quoteAppearsIn,
  type Department,
  type Fact,
  type Section,
  type Source,
} from './schema';
import { dedupe, search, type SearchOptions } from './tavily';

const GATEWAY = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';

/**
 * Queries are geo-pinned on purpose. Fire department names repeat heavily across
 * states ("Washington Fire Department" exists in many), and a result about the
 * wrong one looks identical to a correct result: real URL, plausible content,
 * citation that validates. City and state in every query is the cheapest defense.
 */
function queriesFor(dept: Department): Record<Section, { q: string; opts: SearchOptions }[]> {
  const where = `${dept.city} ${dept.state}`;
  const site = dept.website ? new URL(dept.website).hostname.replace(/^www\./, '') : null;

  return {
    leadership: [
      { q: `"${dept.name}" ${where} fire chief officers leadership`, opts: {} },
      ...(site ? [{ q: `${dept.name} chief staff`, opts: { includeDomains: [site] } }] : []),
    ],
    fleet: [
      {
        q: `"${dept.name}" ${where} apparatus engine ladder truck rescue fleet`,
        opts: {},
      },
      ...(site ? [{ q: `${dept.name} apparatus fleet`, opts: { includeDomains: [site] } }] : []),
    ],
    funding: [
      { q: `"${dept.name}" grant award funding ${where}`, opts: {} },
      {
        q: `${dept.name} ${dept.city} AFG SAFER assistance to firefighters grant`,
        opts: { includeDomains: ['fema.gov', 'firegrantsupport.com'] },
      },
      {
        q: `"${dept.name}" ${where} apparatus purchase approved funds new engine cost`,
        opts: { timeRange: 'year' },
      },
    ],
    news: [
      { q: `"${dept.name}" ${where} news`, opts: { timeRange: 'month' } },
      { q: `${dept.city} ${dept.state} fire department new engine truck delivered`, opts: { timeRange: 'year' } },
    ],
  };
}

const GUIDANCE: Record<Section, string> = {
  leadership:
    'Who runs this department: chief, deputy/assistant chiefs, president, board, or commissioners. Names and titles. Recent appointments are especially valuable.',
  fleet:
    'What apparatus this department currently operates: engines, ladders/trucks, rescues, tankers, ambulances, brush units. Include model years, manufacturers, and unit numbers when stated. Note anything described as aging, out of service, or being replaced.',
  funding:
    'Money: AFG/SAFER or other grant awards, budget allocations, bond or referendum activity, approved apparatus purchases, fundraising for new vehicles. Amounts and dates matter.',
  news:
    'Recent, specific, dated activity at this department. Two kinds both count: sales signals (apparatus delivered or ordered, station project, incident that stressed the fleet) and conversation openers (community events, traditions, milestones, long-serving members). An AE who can open with something the department is proud of gets a better call.',
};

type RawFact = { claim: string; quote: string; sourceUrl: string };

/**
 * Ask the model to extract facts, then keep only those whose verbatim quote is
 * actually present in the source we fetched. The model is capable of producing a
 * plausible claim attached to a real URL that does not support it; verifying the
 * quote is what turns "cited" into "sourced".
 */
async function extract(
  dept: Department,
  section: Section,
  sources: Source[],
): Promise<Fact[]> {
  if (!sources.length) return [];

  const corpus = sources
    .map((s, i) => `<source index="${i}" url="${s.url}" title="${s.title}">\n${s.text}\n</source>`)
    .join('\n\n');

  const prompt = `You are preparing a sales brief for an account executive who sells specialty vehicle disposal — helping fire departments sell surplus apparatus.

TARGET DEPARTMENT (the only one that counts):
  Name: ${dept.name}
  Address: ${dept.address}
  City/State: ${dept.city}, ${dept.state}

Extract facts for the section "${section}": ${GUIDANCE[section]}

RULES — these are strict:
1. Only facts about the target department above. Departments in other towns or states with similar names are NOT the target. If a source is about a different department, ignore it entirely.
2. Every fact needs a "quote": a span of text copied EXACTLY, character for character, from the source. Do not paraphrase, reword, fix typos, or join text from different parts of the page. If you cannot copy an exact span, omit the fact.
3. "sourceUrl" must be the url attribute of the source the quote came from.
4. "claim" is your own one-sentence statement of the fact, written for a salesperson to read aloud. Be specific: names, numbers, dates.
5. Prefer specific and recent over general. Skip boilerplate, mission statements, and "we are a volunteer department founded in ..." history unless it is genuinely notable.
6. Return at most 4 facts. Fewer is better than padded. Return an empty array if the sources contain nothing solid.

Respond with ONLY a JSON array, no prose:
[{"claim": "...", "quote": "...", "sourceUrl": "..."}]

SOURCES:
${corpus}`;

  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0,
    }),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const body = await res.json();
  const text: string = body.choices?.[0]?.message?.content ?? '';
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);

  let raw: RawFact[];
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }

  const byUrl = new Map(sources.map((s) => [s.url, s]));
  const seen = new Set<string>();

  return raw.flatMap((f) => {
    const source = byUrl.get(f.sourceUrl);
    // Citation must point at a source we actually fetched...
    if (!source) return [];
    // ...and the quote must really be on that page.
    if (!quoteAppearsIn(f.quote, source.text)) return [];
    const key = f.claim.toLowerCase().slice(0, 60);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ claim: f.claim, quote: f.quote, sourceUrl: source.url, sourceTitle: source.title }];
  });
}

export type Progress = { section: Section; status: 'searching' | 'reading' | 'done'; found?: number };

export async function researchSection(
  dept: Department,
  section: Section,
  onProgress?: (p: Progress) => void,
): Promise<Fact[]> {
  onProgress?.({ section, status: 'searching' });
  const groups = await Promise.all(
    queriesFor(dept)[section].map((({ q, opts }) => search(q, opts).catch(() => []))),
  );
  const sources = dedupe(groups).slice(0, 6);

  onProgress?.({ section, status: 'reading' });
  const facts = await extract(dept, section, sources).catch(() => []);

  onProgress?.({ section, status: 'done', found: facts.length });
  return facts;
}

export async function research(
  dept: Department,
  onProgress?: (p: Progress) => void,
): Promise<{ sections: Record<Section, Fact[]>; gaps: Section[] }> {
  const results = await Promise.all(
    SECTIONS.map((s) => researchSection(dept, s, onProgress)),
  );

  const sections = Object.fromEntries(
    SECTIONS.map((s, i) => [s, results[i]]),
  ) as Record<Section, Fact[]>;

  return { sections, gaps: SECTIONS.filter((s) => sections[s].length === 0) };
}
