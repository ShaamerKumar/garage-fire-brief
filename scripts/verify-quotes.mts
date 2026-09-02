/**
 * Sanity checks for quote verification — the mechanic the whole brief rests on.
 * Run: npx tsx scripts/verify-quotes.mts
 *
 * Both directions matter. Too strict and true facts vanish silently (a rejected
 * fact looks identical to "found nothing"); too loose and invented quotes pass.
 */
import { quoteAppearsIn } from '../src/lib/schema';

const page = `Thomas Jugan

###### Fire Chief

Lance Meehan

###### Assistant Chief

Engine 271 is equipped with a **1500 gpm** Hale Pump and a 750 gallon water tank.
See [our roster](https://wavfc.org/roster) for details.`;

const cases: [string, string, boolean][] = [
  ['markdown heading stripped', 'Thomas Jugan\n\nFire Chief', true],
  ['exact, markup included', 'Thomas Jugan\n\n###### Fire Chief', true],
  ['bold markers dropped', 'Engine 271 is equipped with a 1500 gpm Hale Pump', true],
  ['link text kept, url dropped', 'See our roster for details', true],
  ['invented quote', 'Thomas Jugan retired in 2024 after 30 years', false],
  ['plausible but absent', 'Engine 271 is equipped with a 2000 gpm Waterous pump', false],
  ['too short to prove anything', 'Fire Chief', false],
];

let failed = 0;
for (const [label, quote, expected] of cases) {
  const got = quoteAppearsIn(quote, page);
  if (got !== expected) failed++;
  console.log(`${got === expected ? 'ok  ' : 'FAIL'} ${label} (expected ${expected}, got ${got})`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
