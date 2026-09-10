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
  const site =
    dept.website && URL.canParse(dept.website)
      ? new URL(dept.website).hostname.replace(/^www\./, '')
      : null;
  // Small departments often have no site of their own; their roster, budget and
  // bid notices live on the town's site instead. Skipping that was leaving the
  // best material undiscovered for exactly the hardest cases.
  const townQuery = { q: `${where} town fire department chief apparatus budget`, opts: {} };

  return {
    leadership: [
      { q: `"${dept.name}" ${where} fire chief officers leadership`, opts: {} },
      ...(site
        ? [{ q: `${dept.name} chief staff`, opts: { includeDomains: [site] } }]
        : [townQuery]),
      {
        q: `"${dept.name}" ${where} new fire chief appointed sworn in officers elected`,
        opts: { timeRange: 'year' },
      },
    ],
    fleet: [
      {
        q: `"${dept.name}" ${where} apparatus engine ladder truck rescue fleet`,
        opts: {},
      },
      ...(site
        ? [{ q: `${dept.name} apparatus fleet`, opts: { includeDomains: [site] } }]
        : [{ q: `"${dept.name}" ${where} roster apparatus units`, opts: {} }]),
      {
        q: `"${dept.name}" ${where} apparatus retired out of service replaced sold new truck delivered placed in service`,
        opts: { timeRange: 'year' },
      },
    ],
    funding: [
      { q: `"${dept.name}" ${where} grant awarded funding received`, opts: {} },
      // Procurement notices are the strongest buying signal there is: a department
      // taking bids on a new apparatus is a department about to have a surplus one.
      {
        q: `${where} fire department request for bids RFP apparatus tanker engine surplus`,
        opts: {},
      },
      {
        q: `${where} fire department surplus apparatus for sale GovDeals Municibid auction used fire truck`,
        opts: {},
      },
    ],
    news: [
      { q: `"${dept.name}" ${where} news`, opts: { timeRange: 'month' } },
      { q: `${dept.city} ${dept.state} fire department new engine truck delivered`, opts: { timeRange: 'year' } },
      {
        q: `"${dept.name}" ${where} open house anniversary fundraiser banquet station renovation merger consolidation`,
        opts: { timeRange: 'year' },
      },
    ],
  };
}

const GUIDANCE: Record<Section, string> = {
  leadership:
    'Who runs this department: chief, deputy/assistant chiefs, president, board, or commissioners. Names and titles. Recent appointments are especially valuable.',
  fleet:
    'What apparatus this department currently operates: engines, ladders/trucks, rescues, tankers, ambulances, brush units. Include model years, manufacturers, and unit numbers when stated. Note anything described as aging, out of service, or being replaced.',
  funding:
    'Money moving in either direction. IN: AFG/SAFER or other grant awards, budget allocations, bond or referendum activity, approved apparatus purchases, fundraising. OUT — and this is the highest-value signal of all: any sign the department is disposing of apparatus. Sealed bids or requests for bids on a surplus vehicle, an auction listing, a unit listed for sale, an apparatus marked retired or out of service. A department already selling a truck is a department that needs this AE today. Amounts, unit details, and deadlines matter.',
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
1. LOCATION decides identity, not the exact name string. The same department is written many ways: "Volunteer" added or dropped, "Fire Co" / "Fire Company" / "Fire Department" / "FD", or just the town's name. Treat a source as the target when it describes a fire department in ${dept.city}, ${dept.state} — matching the street address above is conclusive. Conversely, a department with a nearly identical name in a DIFFERENT town or state is NOT the target; ignore it entirely. Fire department names repeat across the country, so check the place, every time.
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
  const sources = dedupe(groups).slice(0, 9);

  onProgress?.({ section, status: 'reading' });
  const facts = await extract(dept, section, sources).catch(() => []);

  onProgress?.({ section, status: 'done', found: facts.length });
  return facts;
}

/**
 * Synthesizes the one line the AE actually wants: why call today. It is fed only
 * claims that already survived quote verification — never raw page text — so it
 * has no material from which to invent an unsourced claim. Any failure yields ''
 * rather than throwing: a missing summary must never cost the AE a working brief.
 */
export async function summarize(
  dept: Department,
  sections: Record<Section, Fact[]>,
): Promise<string> {
  const populated = SECTIONS.filter((s) => sections[s].length);
  if (!populated.length) return '';

  const facts = populated
    .map((s) => `${s.toUpperCase()}\n${sections[s].map((f) => `- ${f.claim}`).join('\n')}`)
    .join('\n\n');

  const prompt = `You are briefing an account executive who sells surplus specialty vehicle disposal to fire departments — he helps them sell apparatus they no longer need. He is about to place a cold call to the department below and has time to read exactly one line first.

DEPARTMENT:
  Name: ${dept.name}
  Address: ${dept.address}
  City/State: ${dept.city}, ${dept.state}

VERIFIED FACTS — the only material you may use:
${facts}

Write one or two sentences telling him why to call this department today.

RULES — these are strict:
1. Use only the facts above. Do not add, infer, estimate, or embellish anything they do not state.
2. Name specifics: unit numbers, model years, dollar amounts, dates, names.
3. Lead with a buying signal if the facts contain one. Strongest first:
   a. The department is already selling, auctioning, or taking bids on surplus apparatus.
   b. Apparatus is out of service, retired, or awaiting disposal — a unit they own and cannot use is already surplus in fact, even if not yet listed for sale.
   c. New apparatus was recently delivered or is on order — whatever it replaces is now surplus.
   d. Apparatus in the fleet is 20 or more years old.
   e. Grant or budget money recently arrived.
4. If the facts contain no real buying signal, say so plainly and point at the best conversational opener instead, in this shape: No buying signal found — lead with <the opener>. Do NOT manufacture urgency the facts do not support. An honest empty hand is the correct answer.
5. Do not end on speculation about what the department wants, plans, or might do. Never write "suggesting", "likely", "may be looking to", "probably", or "could be". If a closing clause earns its place, make it the question the AE should ask, not a guess about their state. Bad: "...which means they likely have a replaced apparatus now available for disposal." Good: "...ask what happened to the engine it replaced."
6. Plain prose only. No preamble, no markdown, no bullet points, no quotation marks around your response.`;

  try {
    const res = await fetch(GATEWAY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0,
      }),
      cache: 'no-store',
    });

    if (!res.ok) return '';

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text.trim() : '';
  } catch {
    return '';
  }
}

export async function research(
  dept: Department,
  onProgress?: (p: Progress) => void,
): Promise<{ sections: Record<Section, Fact[]>; gaps: Section[]; headline: string }> {
  const results = await Promise.all(
    SECTIONS.map((s) => researchSection(dept, s, onProgress)),
  );

  const sections = Object.fromEntries(
    SECTIONS.map((s, i) => [s, results[i]]),
  ) as Record<Section, Fact[]>;

  const headline = await summarize(dept, sections);

  return { sections, gaps: SECTIONS.filter((s) => sections[s].length === 0), headline };
}
