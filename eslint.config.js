// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    // 👇 enable the TS type-checker for rules
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        // One project for the whole of src, with the `$localize` global declared; see the file.
        project: './tsconfig.eslint.json',
      },
    },
    extends: [
      eslint.configs.recommended,
      // 👇 use the *type-checked* configs
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // ✅ flag any symbol marked /** @deprecated */
      '@typescript-eslint/no-deprecated': 'warn',
      // Static methods such as Angular's Validators cannot capture an instance `this`.
      '@typescript-eslint/unbound-method': ['error', {ignoreStatic: true}],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Every piece of copy in a template is marked for translation; `ng extract-i18n` then finds it all,
      // and the pseudo-locale (README, "Interface languages") stretches it. Ids are message hashes, so an
      // edited line simply drops its stale translations rather than needing a new name.
      '@angular-eslint/template/i18n': ['error', {
        checkId: false,
        // Bound text that is only data with punctuation around it: `{{ n }}/3`, `@{{ handle }}`, `{{ a }} · {{ b }}`.
        boundTextAllowedPattern: '^[^A-Za-z]*$',
        ignoreAttributes: [
          // Component inputs and DOM attributes whose values are codes, not copy.
          'appearance', 'autocapitalize', 'autocorrect', 'clip-rule', 'd', 'data-blocked', 'data-note', 'data-state',
          'decoding', 'enterkeyhint', 'fill-rule', 'font-family', 'fontSize', 'gap', 'icon', 'iconStart', 'iconEnd',
          'inputmode', 'loading', 'max', 'maxlength', 'min', 'minlength', 'padding', 'pattern', 'points', 'position',
          'preserveAspectRatio', 'referrerpolicy', 'rel', 'shape', 'size', 'spellcheck', 'step', 'stroke-linecap',
          'stroke-linejoin', 'tuiAppearance', 'tuiHintDirection', 'tuiTheme', 'variant', 'ngSrc', 'srcset', 'sizes',
          'accept', 'align', 'direction', 'mode', 'orientation', 'transform', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
          'x1', 'x2', 'y1', 'y2', 'dx', 'dy', 'href', 'aria-hidden', 'aria-live', 'aria-current', 'aria-pressed',
          'aria-expanded', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-orientation', 'aria-haspopup',
          'aria-selected', 'aria-checked', 'aria-modal', 'aria-atomic', 'aria-busy', 'aria-invalid', 'aria-disabled',
          'translate', 'slot', 'part', 'is', 'method', 'action', 'draggable', 'contenteditable', 'wrap', 'cols', 'rows',
          'scope', 'headers', 'datetime', 'download', 'ping', 'hreflang', 'media', 'crossorigin', 'integrity', 'nonce',
          'form', 'formaction', 'popovertarget', 'popover', 'itemprop', 'itemtype', 'itemscope', 'itemid', 'inert',
          'exportparts', 'enterkeyhint', 'nomodule', 'async', 'defer', 'hidden', 'open', 'reversed', 'start',
          'width', 'height',
          // Test hooks, Taiga layout inputs and other codes the autofix mistook for copy.
          'data-testid', 'fetchpriority', 'tuiSlot', 'tuiTextfieldSize', 'tuiHintAppearance', 'tuiDropdownAlign',
          'tuiSize', 'location', 'tuiTextfieldCleaner', 'tuiTextfieldIcon', 'tuiDropdownDirection',
          'data-size', 'layout', 'redirectUrl', 'fragment', 'customClass', 'tuiHeader', 'tone',
        ],
      }],
    },
  },
  {
    // The owner's ops console and the scratch route are never translated.
    files: ['src/app/ops/**/*.html', 'src/app/ops/**/*.ts', 'src/app/test/**/*.html', 'src/app/test/**/*.ts', 'src/index.html'],
    rules: {'@angular-eslint/template/i18n': 'off'},
  }
);
