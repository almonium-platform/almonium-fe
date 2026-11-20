// Writes the PostHog key and host into one environment file before a build.
//   POSTHOG_KEY=phc_... [POSTHOG_HOST=https://eu.i.posthog.com] node scripts/inject-posthog-env.mjs <file>
// With no POSTHOG_KEY the file is left alone, so analytics stays a no-op.
import {readFileSync, writeFileSync} from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inject-posthog-env.mjs <environment file>');
  process.exit(1);
}
const key = (process.env.POSTHOG_KEY ?? '').trim();
const host = (process.env.POSTHOG_HOST ?? '').trim();
if (!key) {
  console.log(`POSTHOG_KEY is not set; ${file} keeps analytics off.`);
  process.exit(0);
}
const safe = /^[A-Za-z0-9_\-:/.]+$/;
if (!safe.test(key) || (host && !safe.test(host))) {
  console.error('POSTHOG_KEY or POSTHOG_HOST holds unexpected characters.');
  process.exit(1);
}

let source = readFileSync(file, 'utf8');
const block = /(posthog: \{\s*key: )'[^']*'(,\s*host: )'[^']*'/;
if (!block.test(source)) {
  console.error(`${file} has no posthog block to fill.`);
  process.exit(1);
}
source = source.replace(block, (_, before, middle) => {
  const current = /host: '([^']*)'/.exec(_)?.[1] ?? '';
  return `${before}'${key}'${middle}'${host || current}'`;
});
writeFileSync(file, source);
console.log(`PostHog analytics enabled in ${file}${host ? ` (host ${host})` : ''}.`);
