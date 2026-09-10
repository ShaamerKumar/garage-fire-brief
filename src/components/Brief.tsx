import { SECTIONS, SECTION_LABELS, type Brief, type Fact } from '@/lib/schema';

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function FactRow({ fact }: { fact: Fact }) {
  return (
    <li className="group border-l-2 border-neutral-200 pl-4 transition-colors hover:border-orange-500">
      <p className="text-[15px] leading-relaxed text-neutral-900">{fact.claim}</p>
      <a
        href={fact.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-baseline gap-1.5 text-xs text-neutral-500 underline-offset-2 hover:text-orange-700 hover:underline"
      >
        <span className="font-medium">{hostOf(fact.sourceUrl)}</span>
        <span className="truncate text-neutral-400">{fact.sourceTitle}</span>
      </a>
      {/* The verbatim quote is the proof behind the claim — an AE asked
          "where'd you hear that?" can read it out without leaving the page. */}
      <blockquote className="mt-1.5 hidden border-l border-neutral-200 pl-3 text-xs italic leading-relaxed text-neutral-500 group-hover:block">
        &ldquo;{fact.quote.replace(/\s+/g, ' ').trim()}&rdquo;
      </blockquote>
    </li>
  );
}

export default function BriefView({ brief }: { brief: Brief }) {
  const { department: d } = brief;
  const total = SECTIONS.reduce((n, s) => n + brief.sections[s].length, 0);

  return (
    <article className="mx-auto max-w-3xl">
      <header className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{d.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">{d.address}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {d.phone && (
            <a href={`tel:${d.phone}`} className="font-medium text-orange-700 hover:underline">
              {d.phone}
            </a>
          )}
          {d.website && (
            <a
              href={d.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 hover:text-orange-700 hover:underline"
            >
              {hostOf(d.website)}
            </a>
          )}
          <span className="text-neutral-400">
            {total} sourced {total === 1 ? 'fact' : 'facts'}
          </span>
        </div>
      </header>

      {brief.headline && (
        <section className="mt-5 rounded-md border-l-2 border-orange-500 bg-orange-50/70 py-4 pl-4 pr-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-orange-700">
              Why call today
            </h2>
            <p className="inline-flex items-center gap-1 text-[11px] leading-tight text-neutral-500">
              <svg
                role="img"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                className="h-3.5 w-3.5 shrink-0 text-orange-700/70"
              >
                <title>Disclosure</title>
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.4v3.6" strokeLinecap="round" />
                <circle cx="8" cy="5.1" r="0.85" fill="currentColor" stroke="none" />
              </svg>
              Generated with AI from the sourced facts below
            </p>
          </div>
          <p className="text-lg font-medium leading-snug text-neutral-900">{brief.headline}</p>
        </section>
      )}

      <div className="divide-y divide-neutral-100">
        {SECTIONS.map((section) => {
          const facts = brief.sections[section];
          return (
            <section key={section} className="py-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                {SECTION_LABELS[section]}
              </h2>
              {facts.length ? (
                <ul className="space-y-4">
                  {facts.map((f, i) => (
                    <FactRow key={i} fact={f} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400">
                  Nothing verifiable found. Worth asking on the call.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-400">
        Researched live {new Date(brief.generatedAt).toLocaleString()}. Every claim links to
        its source; hover a fact to see the exact supporting quote.
      </footer>
    </article>
  );
}
