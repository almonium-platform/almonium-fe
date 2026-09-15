import {Component, Input} from '@angular/core';
import {SharedExample, SharedWord} from '../shared-link.model';

/**
 * One shared word. The deck route draws the compact row - one sense and one example - and the card route draws the
 * expanded card with every sense and every example. Both are the same object and the same order of parts.
 */
@Component({
  selector: 'app-shared-word',
  template: `
    @if (expanded) {
      <div class="word-card">
        <div class="word-head">
          <div class="word-title">
            <h2 class="entry">{{ word.entry }}</h2>
            @if (word.partOfSpeech) {
              <span class="part-of-speech">{{ word.partOfSpeech }}</span>
            }
          </div>
          @if (languageBadge) {
            <span class="language-badge" [style.--language-badge-fill]="badgeFill">{{ languageBadge }}</span>
          }
        </div>
        <div class="hairline"></div>
        <ol class="senses">
          @for (sense of word.translations; track $index) {
            <li class="sense">
              <span class="sense-number">{{ $index + 1 }}</span>
              <div class="sense-body">
                <div class="meaning">{{ sense }}</div>
                @if ($index === 0) {
                  @for (example of examples; track $index) {
                    <div class="example" lang="">{{ example.example }}</div>
                    @if (example.translation) {
                      <div class="example-translation">{{ example.translation }}</div>
                    }
                  }
                }
              </div>
            </li>
          }
        </ol>
      </div>
    } @else {
      <div class="word-row">
        <div class="row-head">
          <span class="entry">{{ word.entry }}</span>
          @if (word.partOfSpeech) {
            <span class="part-of-speech">{{ word.partOfSpeech }}</span>
          }
        </div>
        @if (word.translations[0]; as meaning) {
          <div class="meaning">{{ meaning }}</div>
        }
        @if (examples[0]; as example) {
          <div class="example">{{ example.example }}</div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }

    .word-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.75rem 1.875rem;
      border-radius: 1.25rem;
      background: var(--card-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1);
    }

    .word-head { display: flex; align-items: flex-start; gap: .875rem; }
    .word-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3125rem; }

    .word-card .entry {
      margin: 0;
      font: 600 2.125rem/1.1 var(--font-family-reading);
      color: var(--text-color);
      overflow-wrap: anywhere;
    }

    .part-of-speech {
      color: var(--metadata-color);
      font: .6875rem/1 var(--font-family-mono);
    }

    .hairline { height: 1px; background: var(--hairline-color); }

    .senses { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: .875rem; }
    .sense { display: flex; gap: .875rem; align-items: baseline; }
    .sense-number { flex: 0 0 .875rem; color: var(--metadata-color); font: .6875rem/1 var(--font-family-mono); }
    .sense-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .375rem; }

    .meaning { color: var(--text-color); font-size: .9375rem; line-height: 1.5; }
    .example { color: var(--reader-text-color); font: .9375rem/1.6 var(--font-family-reading); }
    .example-translation { color: var(--disabled-label-color); font-size: .84375rem; line-height: 1.55; }

    .word-row { display: flex; flex-direction: column; gap: .4375rem; }
    .row-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .75rem; }
    .word-row .entry { font: 600 1.1875rem/1.2 var(--font-family-reading); color: var(--text-color); overflow-wrap: anywhere; }
    .word-row .meaning { font-size: .90625rem; }
    .word-row .example { font-size: .90625rem; }

    .language-badge {
      align-self: flex-start;
      padding: .25rem .5625rem;
      border-radius: .4375rem;
      background: var(--language-badge-fill, #5c5580);
      color: #F1EAEF;
      font: 500 .6875rem/1 var(--font-family-mono);
      letter-spacing: .3px;
    }

    @media (max-width: 40rem) {
      .word-card { padding: 1.25rem 1.125rem; }
      .word-card .entry { font-size: 1.625rem; }
    }
  `],
})
export class SharedWordComponent {
  @Input({required: true}) word!: SharedWord;
  @Input() expanded = false;
  @Input() languageBadge: string | null = null;
  @Input() badgeFill: string | null = null;

  /** The owner's examples, or the sentence the word was met in when no example was written. */
  get examples(): SharedExample[] {
    if (this.word.examples.length > 0) return this.word.examples;
    return this.word.sourceContext ? [{example: this.word.sourceContext, translation: null}] : [];
  }
}
