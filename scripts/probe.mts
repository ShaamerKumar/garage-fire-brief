import { lookupPlace } from '../src/lib/places';
import { research } from '../src/lib/research';

const dept = await lookupPlace(process.argv[2]);
console.log('DEPT:', dept.name, '|', dept.city, dept.state, '|', dept.website ?? 'no site');
const t = Date.now();
const { sections, gaps } = await research(dept, (p) =>
  console.log(`  [${p.section}] ${p.status}${p.found !== undefined ? ` found=${p.found}` : ''}`),
);
console.log(`\nElapsed ${((Date.now() - t) / 1000).toFixed(1)}s   gaps: ${gaps.join(', ') || 'none'}\n`);
for (const [s, facts] of Object.entries(sections)) {
  console.log(`### ${s}`);
  for (const f of facts) console.log(`  • ${f.claim}\n    "${f.quote.slice(0, 90)}…"\n    ${f.sourceUrl}`);
}
