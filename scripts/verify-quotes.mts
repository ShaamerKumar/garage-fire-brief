/**
 * Sanity checks for quote verification — the mechanic the whole brief rests on.
 * Run: npx tsx scripts/verify-quotes.mts
 *
 * Both directions matter. Too strict and true facts vanish silently (a rejected
 * fact looks identical to "found nothing"); too loose and invented quotes pass.
 */
import { quoteAppearsIn, stripMarkdown } from '../src/lib/schema';

const page = `Thomas Jugan

###### Fire Chief

Lance Meehan

###### Assistant Chief

Engine 271 is equipped with a **1500 gpm** Hale Pump and a 750 gallon water tank.
See [our roster](https://wavfc.org/roster) for details.

![Engine 271](/img/e271.jpg) Engine 271 was placed in service in 2003.`;

const cases: [string, string, boolean][] = [
  ['markdown heading stripped', 'Thomas Jugan\n\nFire Chief', true],
  ['exact, markup included', 'Thomas Jugan\n\n###### Fire Chief', true],
  ['bold markers dropped', 'Engine 271 is equipped with a 1500 gpm Hale Pump', true],
  ['link text kept, url dropped', 'See our roster for details', true],
  ['invented quote', 'Thomas Jugan retired in 2024 after 30 years', false],
  ['plausible but absent', 'Engine 271 is equipped with a 2000 gpm Waterous pump', false],
  ['too short to prove anything', 'Fire Chief', false],
  ['link syntax copied verbatim', 'See [our roster](https://wavfc.org/roster) for details', true],
  ['image syntax copied verbatim', '![Engine 271](/img/e271.jpg) Engine 271 was placed in service', true],
];

// The same stripper the verifier uses, so a quote cannot pass the check in one shape and render in another.
const displayed = (s: string) => stripMarkdown(s).replace(/\s+/g, ' ').trim();

const stripCases: [string, string, string][] = [
  [
    'link keeps its text, drops the url',
    'See [our roster](https://wavfc.org/roster) for details.',
    'See our roster for details.',
  ],
  [
    'image keeps its alt, drops the path',
    '![Engine 271](/img/e271.jpg) is a 2003 Pierce.',
    'Engine 271 is a 2003 Pierce.',
  ],
  ['heading markers dropped', '###### Fire Chief', 'Fire Chief'],
  ['blockquote markers dropped', '> > Budget adopted in 2024', 'Budget adopted in 2024'],
  ['emphasis and code dropped', 'a **1500 gpm** `Hale` _pump_', 'a 1500 gpm Hale pump'],
  ['C# and F# left alone', 'Chief is C# certified and plays F#', 'Chief is C# certified and plays F#'],
  [
    'table pipes left to the caller',
    'Utility | 2021 Chevy Silverado 2500',
    'Utility | 2021 Chevy Silverado 2500',
  ],
];

let failed = 0;
for (const [label, quote, expected] of cases) {
  const got = quoteAppearsIn(quote, page);
  if (got !== expected) failed++;
  console.log(`${got === expected ? 'ok  ' : 'FAIL'} ${label} (expected ${expected}, got ${got})`);
}

for (const [label, input, expected] of stripCases) {
  const got = displayed(input);
  if (got !== expected) failed++;
  console.log(
    `${got === expected ? 'ok  ' : 'FAIL'} ${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)})`,
  );
}

const total = cases.length + stripCases.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
