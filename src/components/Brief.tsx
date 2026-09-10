import {
  SECTIONS,
  SECTION_LABELS,
  hostOf,
  stripMarkdown,
  type Brief,
  type Fact,
} from '@/lib/schema';

/** A quote spanning a structural boundary is never contiguous on the rendered page, so only a fragment is findable there. */
function quoteFragments(quote: string): string[] {
  return quote
    .split(/\n+|\s*\|\s*/)
    .map((part) => stripMarkdown(part).replace(/\s+/g, ' ').trim())
    .filter((part, i, all) => part.length >= 3 && all.indexOf(part) === i);
}

const LINK_FOCUS =
  'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600';

function FactRow({ fact }: { fact: Fact }) {
  return (
    <li className="-mx-2 rounded-md px-2 py-2 transition-colors hover:bg-neutral-50">
      <p className="text-[15px] font-medium leading-relaxed text-neutral-900">{fact.claim}</p>
      <a
        href={fact.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={fact.sourceTitle}
        className={`mt-1.5 inline-block max-w-full break-words text-xs font-medium text-neutral-500 underline-offset-2 hover:text-orange-700 hover:underline ${LINK_FOCUS}`}
      >
        {hostOf(fact.sourceUrl) ?? fact.sourceUrl}
      </a>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        {quoteFragments(fact.quote).map((fragment, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-neutral-300">·</span>}
            <mark className="rounded-sm bg-amber-100/60 px-1 italic text-neutral-600">
              {fragment}
            </mark>
          </span>
        ))}
      </p>
    </li>
  );
}

export default function BriefView({ brief }: { brief: Brief }) {
  const { department: d } = brief;
  const total = SECTIONS.reduce((n, s) => n + brief.sections[s].length, 0);

  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight break-words text-neutral-900">
          {d.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{d.address}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {d.phone && (
            <a
              href={`tel:${d.phone}`}
              className={`font-medium text-orange-700 hover:underline ${LINK_FOCUS}`}
            >
              {d.phone}
            </a>
          )}
          {d.website && (
            <a
              href={d.website}
              target="_blank"
              rel="noopener noreferrer"
              className={`max-w-full break-words text-neutral-600 hover:text-orange-700 hover:underline ${LINK_FOCUS}`}
            >
              {hostOf(d.website) ?? d.website}
            </a>
          )}
          <span className="text-neutral-600">
            {total} sourced {total === 1 ? 'fact' : 'facts'}
          </span>
        </div>
      </header>

      {brief.headline && (
        <section className="mt-6 rounded-lg border border-orange-200 bg-orange-50 p-5 sm:p-6">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-orange-700">
              Why call today
            </h2>
            <p className="inline-flex items-center gap-1 text-[11px] leading-tight text-neutral-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                className="h-3.5 w-3.5 shrink-0 text-orange-700/70"
              >
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.4v3.6" strokeLinecap="round" />
                <circle cx="8" cy="5.1" r="0.85" fill="currentColor" stroke="none" />
              </svg>
              Generated with AI from the sourced facts below
            </p>
          </div>
          <p className="text-xl font-semibold leading-snug tracking-tight text-neutral-900 sm:text-2xl">
            {brief.headline}
          </p>
        </section>
      )}

      <div className="mt-2 divide-y divide-neutral-100">
        {SECTIONS.map((section) => {
          const facts = brief.sections[section];
          return (
            <section key={section} className="py-5">
              <h2 className="mb-3 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                {SECTION_LABELS[section]}
                {facts.length > 0 && (
                  <span className="font-normal tracking-normal text-neutral-400">
                    {facts.length}
                  </span>
                )}
              </h2>
              {facts.length ? (
                <ul className="space-y-1">
                  {facts.map((f, i) => (
                    <FactRow key={i} fact={f} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-600">
                  Nothing verifiable found. Worth asking on the call.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-600">
        Researched live {new Date(brief.generatedAt).toLocaleString()}. Every claim links to
        its source, and the highlighted text under it is the exact wording from that source
        page.
      </footer>
    </article>
  );
}
