/**
 * Fails the build when a template names a Lucide icon that
 * SharedLucideIconsModule never registered.
 *
 * `LucideAngularModule.pick({...})` is an allow-list: it is what keeps the
 * bundle at ~4 KB of icon data instead of the ~115 KB the full set costs. The
 * cost of that is a silent failure — lucide-angular's getIcon() returns null
 * for an unregistered name, so the icon renders as empty space with nothing
 * logged. Five icons shipped that way before anyone noticed. This turns the
 * silence into a lint error.
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MODULE_PATH = join(ROOT, 'src/app/shared/shared-lucide-icons.module.ts');
const ICON_PACKAGE = join(ROOT, 'node_modules/lucide-angular/icons');
const LUCIDE_TAGS = 'lucide-icon|lucide-angular|i-lucide|span-lucide';

const kebab = (name) => name.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase();

function walk(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(html|ts)$/.test(entry.name) ? [path] : [];
  });
}

function registeredIcons() {
  const source = readFileSync(MODULE_PATH, 'utf8');
  const pick = source.split('LucideAngularModule.pick({')[1]?.split('}),')[0];
  if (!pick) throw new Error(`No LucideAngularModule.pick({...}) found in ${MODULE_PATH}`);
  // Entries are either `Archive,` or an alias form, `Infinity: InfinityIcon,`.
  return new Set(
    pick
      .split(',')
      .map((entry) => entry.split(':')[0].trim())
      .filter(Boolean)
      .map(kebab)
  );
}

// A name is required if a template hard-codes it, if it appears as a literal in
// a [name] binding, or if it is the value of an icon-ish property in TypeScript
// (`peopleIcon = 'users-round'`, `icon: 'message-circle'`) — the two ways a
// name reaches the component without being visible in the markup.
function requestedIcons(file) {
  const source = readFileSync(file, 'utf8');
  const names = new Set();

  if (file.endsWith('.html')) {
    for (const [tag] of source.matchAll(new RegExp(`<(?:${LUCIDE_TAGS})\\b[^>]*>`, 'g'))) {
      for (const [, name] of tag.matchAll(/\sname="([a-z0-9-]+)"/g)) names.add(name);
      for (const [, expression] of tag.matchAll(/\[name]="([^"]*)"/g)) {
        // Only literals in a result slot of the expression are icon names. In
        // `state === 'paused' ? 'play' : 'pause'` the first literal is a
        // comparison operand, so a literal counts only when it sits at the
        // start of the expression or just after a `?` or `:`.
        for (const [, name] of expression.matchAll(/(?:^|[?:])\s*'([a-z0-9-]+)'\s*(?=[?:]|$)/g)) {
          names.add(name);
        }
      }
    }
  } else {
    for (const [, name] of source.matchAll(/[a-zA-Z]*[Ii]con[a-zA-Z]*\s*[:=]\s*'([a-z0-9-]+)'/g)) {
      names.add(name);
    }
  }

  return names;
}

const registered = registeredIcons();
const missing = new Map();

for (const file of walk(join(ROOT, 'src'))) {
  for (const name of requestedIcons(file)) {
    if (registered.has(name)) continue;
    if (!missing.has(name)) missing.set(name, new Set());
    missing.get(name).add(relative(ROOT, file));
  }
}

if (missing.size === 0) {
  console.log(`lucide icons: ${registered.size} registered, every referenced icon resolves.`);
  process.exit(0);
}

console.error('\nUnregistered Lucide icons — these render as empty space, silently:\n');
for (const [name, files] of [...missing].sort()) {
  const real = existsSync(join(ICON_PACKAGE, `${name}.d.ts`));
  const pascal = name.replace(/(^|-)([a-z0-9])/g, (_, __, char) => char.toUpperCase());
  const hint = real ? `add \`${pascal}\`` : `NOT a Lucide icon — typo?`;
  console.error(`  ${name}  (${hint})`);
  for (const file of [...files].sort()) console.error(`      ${file}`);
}
console.error(`\nRegister them in ${relative(ROOT, MODULE_PATH)} (import + pick map).\n`);
process.exit(1);
