/**
 * Generates tools/disabled-states-harness.html: a static page for clicking through every control that greys
 * out on a condition, with the line that says why.
 *
 * The app itself needs a signed-in account and live backend state to reach these screens, so this mirrors their
 * markup instead. The CSS is not mirrored — it is compiled from the real .less files at generation time, so a
 * style change shows up here the next time this runs:
 *
 *   node scripts/disabled-states-harness.mjs
 *
 * Stubbed, and therefore not evidence: Taiga textfields and switches, Font Awesome glyphs, and the shipping
 * fonts. Everything else — class names, copy, DOM order — is copied from the templates named on each card.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import less from 'less';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCOPES = {
  'language-setup': 'src/app/onboarding/language-setup/language-setup.component.less',
  'onboarding': 'src/app/onboarding/onboarding.component.less',
  'book-import': 'src/app/sections/read/book-import/book-import.component.less',
  'auth-settings': 'src/app/sections/settings/auth/auth-settings.component.less',
  'lang-settings': 'src/app/sections/settings/lang/lang-settings.component.less',
  'discover': 'src/app/sections/discover/discover.component.less',
};

async function appCss() {
  const source = [
    '@import "src/styles/variables.less";',
    '@import "src/styles/shared-styles.less";',
    ...Object.entries(SCOPES).map(([scope, path]) => `.scope-${scope} { @import "${path}"; }`),
  ].join('\n');
  const {css} = await less.render(source, {paths: [root], filename: 'harness.less'});
  return css;
}

/** Each card names the template it mirrors, so a reader can check the copy against the source. */
const CARDS = [
  {
    id: 'language-grid',
    title: 'Onboarding — the language grid at its pick limit',
    source: 'language-setup.component.html:11,25',
    rule: 'Policy block, so the grid says what would free a card up.',
    control: {label: 'atTargetLimit', type: 'checkbox', checked: true},
    body: `
      <div class="scope-language-setup harness-frame">
        <div class="card step language-step">
          <div class="language-grid">
            <button type="button" class="language-card selected">
              <span class="language-card-top"><span class="language-code">FR</span></span>
              <span class="language-name">French</span>
              <span class="language-features">Conjugation drills</span>
            </button>
            <button type="button" class="language-card" data-blocked>
              <span class="language-card-top"><span class="language-code">DE</span></span>
              <span class="language-name">German</span>
              <span class="language-features">Case tables</span>
            </button>
            <button type="button" class="language-card" data-blocked>
              <span class="language-card-top"><span class="language-code">ES</span></span>
              <span class="language-name">Spanish</span>
              <span class="language-features">Conjugation drills</span>
            </button>
          </div>
          <p class="limit-note" data-note>One language to start. Deselect it to pick a different one.</p>
        </div>
      </div>`,
  },
  {
    id: 'continue-button',
    title: 'Onboarding — Continue on an incomplete form',
    source: 'language-setup.component.html:83,104',
    rule: 'Form validity, so the button stays live and the click surfaces the field errors.',
    control: {label: 'languageForm.valid', type: 'checkbox', checked: false},
    body: `
      <div class="scope-language-setup harness-frame">
        <div class="harness-split">
          <div>
            <p class="harness-caption">Shipped — <code>[satisfiable]</code></p>
            <button type="button" class="solid-button" data-satisfiable>Continue</button>
          </div>
          <div>
            <p class="harness-caption">Before — <code>[disabled]</code>, no way in and nothing said</p>
            <button type="button" class="solid-button" disabled>Continue</button>
          </div>
        </div>
      </div>`,
  },
  {
    id: 'stepper',
    title: 'Onboarding — steps you have not reached yet',
    source: 'onboarding.component.html:27',
    rule: 'State block, one line for the whole nav rather than one per greyed step.',
    control: {label: 'hasLockedStep', type: 'checkbox', checked: true},
    body: `
      <div class="scope-onboarding harness-frame">
        <div class="stepper-container card">
          <nav class="setup-progress" aria-label="Profile setup progress">
            <button type="button" class="progress-step complete"><span class="progress-marker">✓</span><span>Languages</span></button>
            <span class="progress-separator">·</span>
            <button type="button" class="progress-step active"><span class="progress-marker">2</span><span>Interests</span></button>
            <span class="progress-separator">·</span>
            <button type="button" class="progress-step" data-blocked><span class="progress-marker">3</span><span>Welcome</span></button>
          </nav>
          <p class="stepper-note" data-note>Finish the step you are on to unlock the rest.</p>
        </div>
      </div>`,
  },
  {
    id: 'book-import',
    title: 'Read — Import book against the allowance',
    source: 'book-import.component.html:58',
    rule: 'Quota block, restated where the greyed button is rather than only in the card above it.',
    control: {
      label: 'quota',
      type: 'select',
      options: [
        {value: 'left', label: '2 of 3 imports left', note: '', blocked: false},
        {value: 'none', label: 'none left this month', note: 'No imports left this month.', blocked: true},
        {value: 'premium', label: 'Premium-only (limit 0)', note: 'Importing books is a Premium feature.', blocked: true},
      ],
    },
    body: `
      <div class="scope-book-import harness-frame">
        <div class="quota-card" data-quota-card>
          <div>
            <span class="quota-label">Import allowance</span>
            <strong data-quota-message>2 of 3 imports left this month</strong>
            <span>Resets Oct 1, 2026</span>
          </div>
          <button type="button" class="secondary-action" data-premium-cta hidden>See Premium</button>
        </div>
        <form onsubmit="return false">
          <label>Title<input value="Madame Bovary"></label>
          <button class="primary-action" type="submit" data-blocked>Import book</button>
          <p class="blocked-note" data-note>No imports left this month.</p>
        </form>
      </div>`,
  },
  {
    id: 'email-save',
    title: 'Settings · Account — Save on an unchanged address',
    source: 'auth-settings.component.html:46,72',
    rule: 'No validator fires on "unchanged", so the row says it. The note sits under the row, not inside it.',
    control: {label: 'emailUnchanged()', type: 'checkbox', checked: true},
    body: `
      <div class="scope-auth-settings harness-frame">
        <div class="harness-split harness-stack">
          <main class="account-layout">
            <p class="harness-caption">Shipped — note under the row, Save stays on the field's centreline</p>
            <section class="account-card card">
              <div class="eyebrow">Email</div>
              <div class="email-row">
                <div class="email-content">
                  <div class="harness-stub-field"><span>kuzanoleg@gmail.com</span><span class="harness-stub-clear">×</span></div>
                </div>
                <button type="button" class="settings-action committing" disabled><span>Save</span></button>
              </div>
              <p class="field-note row-note" data-note>Enter a different address to save.</p>
            </section>
          </main>
          <main class="account-layout">
            <p class="harness-caption">Before — note inside the row, Save drags below the field</p>
            <section class="account-card card">
              <div class="eyebrow">Email</div>
              <div class="email-row">
                <div class="email-content">
                  <div class="harness-stub-field"><span>kuzanoleg@gmail.com</span><span class="harness-stub-clear">×</span></div>
                  <span class="field-note" data-note>Enter a different address to save.</span>
                </div>
                <button type="button" class="settings-action committing" disabled><span>Save</span></button>
              </div>
            </section>
          </main>
        </div>
      </div>`,
  },
  {
    id: 'last-provider',
    title: 'Settings · Account — disconnecting your only sign-in method',
    source: 'auth-settings.component.html:84',
    rule: 'Was a title attribute, which says nothing on touch. Now a visible line.',
    control: {label: 'isLastLinkedProvider("google")', type: 'checkbox', checked: true},
    body: `
      <div class="scope-auth-settings harness-frame">
        <main class="account-layout">
        <section class="account-card card">
          <div class="eyebrow">How you sign in</div>
          <div class="method-list">
            <div class="method-row">
              <span class="method-icon">G</span>
              <div class="method-copy">
                <strong>Google</strong>
                <span>kuzanoleg@gmail.com</span>
                <span class="field-note" data-note>Your only sign-in method. Add another before disconnecting it.</span>
              </div>
              <button type="button" class="settings-action" data-blocked>Disconnect</button>
            </div>
            <div class="method-row">
              <span class="method-icon">A</span>
              <div class="method-copy"><strong>Apple</strong><span>Not connected</span></div>
              <button type="button" class="settings-action">Connect</button>
            </div>
          </div>
        </section>
        </main>
      </div>`,
  },
  {
    id: 'learner-lock',
    title: 'Settings · Languages — a locked learner row',
    source: 'lang-settings.component.html:145',
    rule: 'Was a tuiHint on one control and nothing on the other. Now one line per row, whichever rule applies.',
    control: {
      label: 'row state',
      type: 'select',
      options: [
        {value: 'only-active', label: 'the only active language', note: 'This is your only active language. Make another one active to turn it off.', blocked: true},
        {value: 'cooldown', label: 'set aside, switch on cooldown', note: "This month's language switch is used. You can change again on 4 October.", blocked: true},
        {value: 'free', label: 'nothing blocked', note: '', blocked: false},
      ],
    },
    body: `
      <div class="scope-lang-settings harness-frame">
        <div class="learning-card card">
          <div class="learning-head"><div class="eyebrow">I'm Learning</div><span class="allowance-count">1 of 1 active</span></div>
          <div class="learner-list">
            <div class="learner-record">
              <div class="learner-row">
                <button type="button" class="colour-trigger" style="background:#7A6BB8"></button>
                <div class="language-copy">
                  <strong class="language-name">French</strong>
                  <span class="read-only-note" data-readonly hidden>Read-only · 214 words kept</span>
                </div>
                <div class="learner-controls">
                  <label class="level-select"><select><option>B1</option></select></label>
                  <span class="harness-stub-switch" data-blocked data-on></span>
                  <button type="button" class="make-active" data-blocked data-make-active hidden>Make active</button>
                </div>
              </div>
              <p class="switch-wait-note" data-note>This is your only active language. Make another one active to turn it off.</p>
            </div>
          </div>
        </div>
      </div>`,
  },
  {
    id: 'discover-intent',
    title: 'Discover — the Understand intent you cannot switch off',
    source: 'discover.component.html:103',
    rule: 'Permanently checked and permanently greyed, so the panel says why it is the baseline.',
    control: {label: 'show the line', type: 'checkbox', checked: true},
    body: `
      <div class="scope-discover harness-frame">
        <section class="keep-panel">
          <p class="eyebrow">Keep it</p>
          <h3>What do you want from this word?</h3>
          <div class="intent-grid">
            <label class="selected"><input type="checkbox" checked disabled><span><strong>Understand it</strong><small>Recognise it while reading</small></span></label>
            <label><input type="checkbox"><span><strong>Say it too</strong><small>Recall the word from its meaning</small></span></label>
            <label><input type="checkbox"><span><strong>Tell it apart</strong><small>Practise it against confusing words</small></span></label>
          </div>
          <p class="intent-note" data-note>Understanding is always kept. The other two are added on top of it.</p>
        </section>
      </div>`,
  },
];

function renderControl(card) {
  const {control, id} = card;
  if (control.type === 'checkbox') {
    return `<label class="harness-toggle">
        <input type="checkbox" data-card="${id}"${control.checked ? ' checked' : ''}>
        <code>${control.label}</code>
      </label>`;
  }
  const options = control.options
    .map((option, index) => `<option value="${option.value}"${index === 0 ? ' selected' : ''}>${option.label}</option>`)
    .join('');
  return `<label class="harness-toggle">
      <code>${control.label}</code>
      <select data-card="${id}">${options}</select>
    </label>`;
}

function renderCard(card) {
  return `<section class="harness-card" id="${card.id}">
    <header>
      <h2>${card.title}</h2>
      <p class="harness-source">${card.source}</p>
      <p class="harness-rule">${card.rule}</p>
      ${renderControl(card)}
    </header>
    ${card.body}
  </section>`;
}

const CHROME_CSS = `
  [hidden] { display: none !important; } /* component rules set display on some of the elements we toggle */
  body { margin: 0; background: #f4f1ef; color: #2C2530; font: 15px/1.5 'IBM Plex Sans', system-ui, sans-serif; }
  .harness-page { max-width: 62rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  .harness-lede { max-width: 44rem; }
  .harness-lede h1 { margin: 0 0 .35rem; font-size: 1.6rem; font-weight: 600; }
  .harness-lede p { margin: .5rem 0; color: #5f5560; font-size: .9rem; }
  .harness-lede code { background: #e9e4e7; border-radius: .25rem; padding: .05rem .3rem; font-size: .85em; }
  .harness-card { margin-top: 2.5rem; padding: 1.25rem 1.25rem 1.5rem; background: #fff; border: 1px solid #e6e0e4; border-radius: 1rem; }
  .harness-card h2 { margin: 0; font-size: 1.05rem; font-weight: 600; }
  .harness-source { margin: .2rem 0 0; color: #a99aa8; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: .72rem; }
  .harness-rule { margin: .45rem 0 .75rem; color: #5f5560; font-size: .85rem; }
  .harness-toggle { display: inline-flex; align-items: center; gap: .5rem; margin-bottom: 1.25rem; padding: .35rem .7rem; background: #f4f1ef; border: 1px solid #e6e0e4; border-radius: 999px; cursor: pointer; font-size: .8rem; }
  .harness-toggle code { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: .75rem; }
  .harness-toggle select { font: inherit; }
  .harness-frame { padding: 1.25rem; background: var(--page-ground, #F9F6F5); border-radius: .75rem; }
  .harness-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1.5rem; align-items: start; }
  .harness-split.harness-stack { grid-template-columns: 1fr; gap: 2rem; }
  .harness-caption { margin: 0 0 .6rem; color: #5f5560; font-size: .78rem; }
  .harness-caption code { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  /* Stand-ins for the Taiga controls, sized to the real ones so the alignment case still means something. */
  .harness-stub-field { display: flex; align-items: center; justify-content: space-between; gap: .5rem; width: 100%; height: 2.75rem; padding: 0 1rem; background: #fff; border: 1px solid var(--control-border-color); border-radius: 999px; font-size: 1rem; }
  .harness-stub-clear { color: var(--metadata-color); }
  .harness-stub-switch { display: inline-block; width: 2.5rem; height: 1.4rem; background: var(--brand-primary); border-radius: 999px; }
  .harness-stub-switch:not([data-on]) { background: var(--control-border-color); }
  .harness-stub-switch.harness-off { opacity: .45; }
`;

const SCRIPT = `
  const NOTES = ${JSON.stringify(
    Object.fromEntries(
      CARDS.filter(card => card.control.type === 'select')
        .map(card => [card.id, Object.fromEntries(card.control.options.map(o => [o.value, o]))]),
    ),
  )};

  /** note === null leaves the line's own text alone; '' means this state has nothing to say. */
  function paint(card, blocked, note) {
    card.querySelectorAll('[data-blocked]').forEach(el => {
      if ('disabled' in el) el.disabled = blocked;
      el.classList.toggle('harness-off', blocked);
    });
    const line = card.querySelector('[data-note]');
    if (!line) return;
    if (note !== null) line.textContent = note;
    line.hidden = !blocked || note === '';
  }

  document.querySelectorAll('.harness-toggle input[type=checkbox]').forEach(input => {
    const card = document.getElementById(input.dataset.card);
    const apply = () => {
      // The satisfiable card reads the other way round: checked means the form is valid, so nothing is blocked.
      const satisfiable = card.querySelector('[data-satisfiable]');
      if (satisfiable) {
        satisfiable.classList.toggle('incomplete-button', !input.checked);
        paint(card, !input.checked, null);
        return;
      }
      paint(card, input.checked, null);
    };
    input.addEventListener('change', apply);
    apply();
  });

  document.querySelectorAll('.harness-toggle select').forEach(select => {
    const card = document.getElementById(select.dataset.card);
    const apply = () => {
      const option = NOTES[select.dataset.card][select.value];
      paint(card, option.blocked, option.note);
      if (select.dataset.card === 'book-import') {
        card.querySelector('[data-quota-card]').classList.toggle('exhausted', option.blocked);
        card.querySelector('[data-quota-message]').textContent =
          select.value === 'left' ? '2 of 3 imports left this month'
          : select.value === 'none' ? '0 of 3 imports left this month'
          : '0 of 0 imports left this month';
        card.querySelector('[data-premium-cta]').hidden = select.value !== 'premium';
      }
      if (select.dataset.card === 'learner-lock') {
        const setAside = select.value === 'cooldown';
        card.querySelector('[data-readonly]').hidden = !setAside;
        card.querySelector('[data-make-active]').hidden = !setAside;
        card.querySelector('.harness-stub-switch').toggleAttribute('data-on', !setAside);
      }
    };
    select.addEventListener('change', apply);
    apply();
  });
`;

const css = await appCss();
const head = `<title>Greyed Controls Harness</title>
<style>${CHROME_CSS}</style>
<style>/* Compiled from the real component .less files — regenerate with scripts/disabled-states-harness.mjs */
${css}</style>`;
const body = `<div class="harness-page">
  <div class="harness-lede">
    <h1>Greyed controls, and the line that says why</h1>
    <p>Every control in the app that greys out on a condition rather than on a request in flight. Flip each
      toggle to see the blocked state and the line under it.</p>
    <p>The CSS here is compiled from the real component <code>.less</code> files, and the markup and copy are
      copied from the templates named on each card. Taiga textfields and switches, Font Awesome glyphs and the
      shipping fonts are stand-ins, so treat spacing as indicative and wording as exact.</p>
  </div>
  ${CARDS.map(renderCard).join('\n  ')}
</div>
<script>${SCRIPT}</script>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
</head>
<body>
${body}
</body>
</html>`;

await writeFile(join(root, 'tools/disabled-states-harness.html'), page, 'utf8');
console.log(`tools/disabled-states-harness.html — ${CARDS.length} cards, ${Math.round(page.length / 1024)} kB`);
