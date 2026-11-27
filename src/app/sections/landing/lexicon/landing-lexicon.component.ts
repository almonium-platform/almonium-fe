import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {SHOWCASE_LANGUAGES, ShowcaseSense, ShowcaseWord} from './showcase-entries';

type Mode = 'translator' | 'almonium';

interface PatternPart {
  text: string;
  kind: 'head' | 'slot' | 'word';
}

interface SenseView extends ShowcaseSense {
  index: number;
  open: boolean;
  levelTag: string;
  labels: {text: string; warning: boolean}[];
  patternParts: PatternPart[][];
  hasRows: boolean;
}

/**
 * The landing's dictionary section (Landing v3, #dictionary): one word shown the way a translator answers it
 * and the way an Almonium entry does, for two words in each of seven languages. The entries are fixed
 * showcase data, not lookups; the field under them is the real one and opens Discover.
 */
@Component({
  selector: 'app-landing-lexicon',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink],
  templateUrl: './landing-lexicon.component.html',
  styleUrl: './landing-lexicon.component.less',
})
export class LandingLexiconComponent {
  private readonly router = inject(Router);

  protected readonly languages = SHOWCASE_LANGUAGES;
  protected readonly languageIndex = signal(0);
  protected readonly wordIndex = signal(0);
  /** Null until the reader picks a sense: each word opens on the sense that makes its point. */
  private readonly pickedSense = signal<number | null>(null);
  protected readonly mode = signal<Mode>('almonium');
  protected readonly query = signal('');

  protected readonly words = computed(() => this.languages[this.languageIndex()].words);
  protected readonly word = computed<ShowcaseWord>(() => this.words()[this.wordIndex()]);
  protected readonly hasLabels = computed(() => this.word().pronunciations.some(row => row.label));
  protected readonly wideLabels = computed(() => this.word().pronunciations.some(row => row.label.length > 12));

  protected readonly groups = computed(() => {
    const word = this.word();
    const open = this.pickedSense() ?? word.selected;
    let index = 0;
    return word.groups.map(group => ({
      ...group,
      senses: group.senses.map(sense => this.viewOf(sense, index++, open)),
    }));
  });

  protected pickLanguage(index: number): void {
    this.languageIndex.set(index);
    this.wordIndex.set(0);
    this.pickedSense.set(null);
  }

  protected pickWord(index: number): void {
    this.wordIndex.set(index);
    this.pickedSense.set(null);
  }

  protected pickSense(index: number): void {
    this.pickedSense.set(index);
  }

  protected lookUp(event: Event): void {
    event.preventDefault();
    const text = this.query().trim();
    void this.router.navigate(['/discover'], text ? {queryParams: {text}} : {});
  }

  private viewOf(sense: ShowcaseSense, index: number, open: number): SenseView {
    const patternParts = (sense.patterns ?? []).map(parsePattern);
    return {
      ...sense,
      index,
      open: index === open,
      levelTag: sense.level,
      labels: sense.tags.map(tag => tag.startsWith('!') ? {text: tag.slice(1), warning: true} : {text: tag, warning: false}),
      patternParts,
      hasRows: [sense.grammar, sense.opposite].some(Boolean) || patternParts.length > 0 || (sense.collocations?.length ?? 0) > 0,
    };
  }
}

/** "{lead} [sb] to [sth]" as its parts: the headword in braces, an open place in brackets, fixed words bare. */
function parsePattern(pattern: string): PatternPart[] {
  return (pattern.match(/\{[^}]+\}|\[[^\]]+\]|[^\s{}[\]]+/g) ?? []).map(token => {
    if (token.startsWith('{')) return {text: token.slice(1, -1), kind: 'head'};
    if (token.startsWith('[')) return {text: token.slice(1, -1), kind: 'slot'};
    return {text: token, kind: 'word'};
  });
}
