import {ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, inject, input, linkedSignal, output, signal} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {NgTemplateOutlet} from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import {catchError, distinctUntilChanged, finalize, forkJoin, of, switchMap} from 'rxjs';
import {CardDto} from '../../../models/card.model';
import {LanguageCode} from '../../../models/language.enum';
import {CardService} from '../../../services/card.service';
import {UserInfoService} from '../../../services/user-info.service';
import {getErrorMessage} from '../../../shared/http-error';
import {varietyRow} from '../../../shared/language-varieties';
import {DiscoverLookup, DiscoverPronunciation, DiscoverSense, DiscoverService, SenseComparison} from '../discover.service';
import {languageName, partOfSpeechLabel} from '../entry-shape';
import {speakerKey} from '../pronunciation-table';
import {
  ComparedSide, Comparison, ComparisonRowKind, SpellingPart, compare, frameParts, nothingToCompare, soundOf, spellingParts,
  startingPair, summaryParts,
} from '../word-comparison';
import {ExampleParts, cardFor, frequencyBand, frequencyBars, groupSenses, keptCard, leadsWithDefinition} from '../word-sheet';

/** A clip the table asks the page to play: the page owns the one player, so two speakers never talk at once. */
export interface ComparedSound {
  key: string;
  text: string;
  variety: string;
  clipUrl: string | null;
}

interface MeaningChoice {
  /** Its place in the word's senses, which is what picking it sets. */
  at: number;
  number: number;
  lead: string;
  partOfSpeech: string;
}

interface WordSound {
  pronunciation: DiscoverPronunciation;
  playable: boolean;
  play: ComparedSound;
}

interface WordColumn {
  lookup: DiscoverLookup;
  sense: DiscoverSense;
  headword: string;
  /** The headword cut where it parts from the other, when the two are spelled nearly alike. */
  spelling: SpellingPart[];
  partOfSpeech: string;
  /** The language's name, said only when the two words are not of one language. */
  language: string;
  lead: string;
  sub: string;
  /** "Sense 1 of 5"; empty for a word with one meaning, which has nothing to choose between. */
  senseLabel: string;
  meanings: MeaningChoice[];
  selected: number;
  example: ExampleParts | null;
  frequency: {bars: number; band: string; title: string} | null;
  sound: WordSound | null;
}

/**
 * Two word sheets as one ("big vs large", design Compare 1a): each word with the meaning it is compared by, then
 * only the rows the two differ in, and what they share folded into a line. All of that is the lexicon's own facts.
 * The tinted sentence is the one written piece: a signed-in reader can ask for it, a model writes it once for the
 * two meanings picked, and everyone who compares them after reads it for nothing.
 */
@Component({
  selector: 'app-word-comparison',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './word-comparison.component.html',
  styleUrl: './word-comparison.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordComparisonComponent {
  readonly first = input.required<DiscoverLookup>();
  readonly second = input.required<DiscoverLookup>();
  /** `DiscoverSense.index` of the first word's meaning to start from, when the reader came from that sense. */
  readonly firstSense = input<number | null>(null);
  /** The speaker playing on the page, by its key. */
  readonly playing = input<string | null>(null);
  readonly listen = output<ComparedSound>();

  private readonly userInfoService = inject(UserInfoService);
  private readonly discoverService = inject(DiscoverService);
  private readonly cardService = inject(CardService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  protected readonly rowLabels: Record<ComparisonRowKind, string> = {
    use: $localize`Use`,
    grammar: $localize`Grammar`,
    forms: $localize`Forms`,
    spelled: $localize`Spelled`,
    pattern: $localize`Patterns`,
    often: $localize`Goes with`,
    opposite: $localize`Opposite`,
  };
  protected readonly bars = [1, 2, 3, 4, 5];
  protected readonly noRecordingTitle = $localize`No recording yet`;

  private readonly lookups = computed(() => [this.first(), this.second()]);
  /** Each word's senses in the order its own sheet lists them. */
  private readonly senses = computed(() => this.lookups().map(lookup => groupSenses(lookup.senses)));
  /** The meaning each word is compared by; a new pair starts from the two the lexicon sets against each other. */
  private readonly selection = linkedSignal<[number, number]>(() => {
    const [first, second] = this.senses();
    const pair = startingPair(this.first(), first.map(row => row.sense), this.second(), second.map(row => row.sense));
    const asked = first.findIndex(row => row.sense.index === this.firstSense());
    return asked >= 0 ? [asked, pair[1]] : pair;
  });
  /** The side whose sense list is open in place: 0, 1 or neither. */
  protected readonly openList = linkedSignal<number | null>(() => {
    this.senses();
    return null;
  });

  /** The words that have no entry; with one the sheet is not drawn, since there is nothing to set beside the other. */
  protected readonly missing = computed(() => this.lookups().filter(lookup => !lookup.senses.length).map(lookup => lookup.entry));
  protected readonly found = computed(() => this.lookups().find(lookup => lookup.senses.length) ?? null);
  /** Two words with nothing to be compared by are shown each on its own (design 1d). */
  protected readonly unrelated = computed(() => !this.missing().length && nothingToCompare(this.first(), this.second()));
  protected readonly title = computed(() => $localize`${this.first().entry}:first: compared with ${this.second().entry}:second:`);

  private readonly sides = computed<ComparedSide[]>(() => {
    const selection = this.selection();
    return this.lookups().map((lookup, at) => ({
      lookup,
      sense: this.senses()[at][selection[at]].sense,
      varietyName: (tag: string) => varietyLabel(lookup, tag),
    }));
  });

  protected readonly columns = computed<WordColumn[]>(() => {
    const lookups = this.lookups();
    const sides = this.sides();
    const selection = this.selection();
    const oneLanguage = lookups[0].language === lookups[1].language;
    const headwords = sides.map(side => side.sense.headword || side.lookup.entry);
    const spelling = oneLanguage ? spellingParts(headwords[0], headwords[1]) : null;
    // Both words are heard in one accent where they can be: the learner's, else the one the first word leads with.
    let variety = this.userInfoService.currentUserInfo?.learners.find(learner => learner.language === lookups[0].language)?.variety ?? null;
    return lookups.map((lookup, at) => {
      const rows = this.senses()[at];
      const row = rows[selection[at]];
      const sense = sides[at].sense;
      const pronunciation = soundOf(lookup, sense, variety);
      variety ??= pronunciation?.variety ?? null;
      const headword = headwords[at];
      return {
        lookup,
        sense,
        headword,
        spelling: spelling?.[at] ?? [{text: headword, differs: false}],
        partOfSpeech: partOfSpeechLabel(sense.partOfSpeech),
        language: oneLanguage ? '' : languageName(lookup.language, this.locale),
        lead: this.lead(sense, lookup),
        sub: this.sub(sense, lookup),
        senseLabel: rows.length > 1 ? $localize`Sense ${row.number}:number: of ${rows.length}:count:` : '',
        meanings: rows.map((each, index) => ({
          at: index, number: each.number, lead: this.lead(each.sense, lookup), partOfSpeech: partOfSpeechLabel(each.sense.partOfSpeech),
        })),
        selected: selection[at],
        example: row.example,
        frequency: lookup.frequency ? {
          bars: frequencyBars(lookup.frequency.score),
          band: frequencyBand(lookup.frequency.score),
          title: [$localize`Relative corpus score ${lookup.frequency.score}:score:`, lookup.frequency.provenance].join(' · '),
        } : null,
        sound: pronunciation ? {
          pronunciation,
          // Synthesis can only say the spelling, which is a variety's first reading; any other needs its clip.
          playable: !!pronunciation.clipUrl || lookup.pronunciations.find(each => each.variety === pronunciation.variety) === pronunciation,
          play: {key: `compared:${at}:${speakerKey(pronunciation)}`, text: headword, variety: pronunciation.variety, clipUrl: pronunciation.clipUrl},
        } : null,
      };
    });
  });

  protected readonly comparison = computed<Comparison>(() => compare(this.sides()[0], this.sides()[1], this.locale));
  /** The part of speech stands in each column only where the two differ; shared, it is in the line under the rows. */
  protected readonly partsDiffer = computed(() => this.columns()[0].partOfSpeech !== this.columns()[1].partOfSpeech);
  protected readonly hasOften = computed(() => this.comparison().rows.some(row => row.kind === 'often'));
  protected readonly anyExample = computed(() => this.columns().some(column => column.example));
  protected readonly anySound = computed(() => this.columns().some(column => column.sound));
  /** Two words transcribed alike in one accent are said the same: one row and one speaker for both (design 1c). */
  protected readonly saidTheSame = computed(() => {
    const [a, b] = this.columns().map(column => column.sound?.pronunciation ?? null);
    return !!a?.ipa && a.ipa === b?.ipa && a.variety.toLowerCase() === b.variety.toLowerCase();
  });
  /** The first meaning of each word, as the two rows of a pair with nothing to compare. */
  protected readonly apart = computed(() => this.lookups().map((lookup, at) => {
    const sense = this.senses()[at][0].sense;
    return {lookup, headword: sense.headword || lookup.entry, lead: this.lead(sense, lookup), cefr: sense.cefr};
  }));

  /** The two sense keys an explanation is asked for by; null when either word is not a lexicon entry. */
  private readonly pairKey = computed(() => {
    if (this.missing().length || this.unrelated()) return null;
    const [first, second] = this.sides();
    return first.sense.key && second.sense.key ? `${first.sense.key} ${second.sense.key} ${first.lookup.translationLanguage}` : null;
  });
  /** The explanation for the meanings picked; null until the server has said whether one is written. */
  protected readonly explanation = signal<SenseComparison | null>(null);
  protected readonly explaining = signal(false);
  protected readonly explainError = signal('');
  /** Whether an explanation can be asked for at all: both words are lexicon entries with something to compare. */
  protected readonly canExplain = computed(() => this.pairKey() !== null);
  protected readonly summary = computed(() => {
    const summary = this.explanation()?.summary;
    return summary ? summaryParts(summary, this.columns().map(column => column.headword)) : null;
  });

  /** The card each kept sense became, by side and `DiscoverSense.index`, so that Kept can take it back. */
  protected readonly kept = signal<Map<string, string>>(new Map());
  protected readonly keeping = signal<Set<string>>(new Set());
  protected readonly keepError = signal('');

  protected get signedIn(): boolean {
    return this.userInfoService.currentUserInfo !== null;
  }

  constructor() {
    // A new pair of meanings first asks only for an explanation already written, which costs nothing.
    toObservable(this.pairKey).pipe(
      distinctUntilChanged(),
      switchMap(key => {
        this.explanation.set(null);
        this.explainError.set('');
        this.explaining.set(false);
        return key && this.signedIn ? this.ask(false).pipe(catchError(() => of(null))) : of(null);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(explanation => this.explanation.set(explanation));
    // Marks the senses of the two words already kept, so Keep does not make a second card of one.
    toObservable(this.lookups).pipe(
      switchMap(lookups => {
        this.kept.set(new Map());
        this.keepError.set('');
        if (!this.signedIn) return of(null);
        const languages = [...new Set(lookups.map(lookup => lookup.language))];
        return forkJoin(languages.map(language => this.cardService.getCardsInLanguage(language).pipe(catchError(() => of<CardDto[]>([])))))
          .pipe(switchMap(cards => of({lookups, cards: new Map<LanguageCode, CardDto[]>(languages.map((language, at) => [language, cards[at]]))})));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(loaded => {
      if (!loaded) return;
      const kept = new Map<string, string>();
      loaded.lookups.forEach((lookup, side) => lookup.senses.forEach(sense => {
        const card = keptCard(loaded.cards.get(lookup.language) ?? [], lookup, sense);
        if (card?.id) kept.set(keepKey(side, sense), card.id);
      }));
      this.kept.set(kept);
    });
  }

  /** Has the difference written. The pair is read again when it answers, in case another meaning was picked meanwhile. */
  protected explain(): void {
    const asked = this.pairKey();
    if (!asked || this.explaining()) return;
    this.explaining.set(true);
    this.explainError.set('');
    this.ask(true).pipe(finalize(() => this.explaining.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: explanation => {
        if (this.pairKey() === asked) this.explanation.set(explanation);
      },
      error: error => {
        if (this.pairKey() === asked) this.explainError.set(getErrorMessage(error, $localize`The explanation could not be written. Please try again.`));
      },
    });
  }

  private ask(generate: boolean) {
    const [first, second] = this.sides();
    return this.discoverService.explainDifference(first.sense.key!, second.sense.key!, first.lookup.translationLanguage, generate);
  }

  protected toggleList(side: number): void {
    this.openList.set(this.openList() === side ? null : side);
  }

  protected pick(side: number, at: number): void {
    const selection = [...this.selection()] as [number, number];
    selection[side] = at;
    this.selection.set(selection);
    this.openList.set(null);
  }

  protected isKept(side: number, column: WordColumn): boolean {
    return this.kept().has(keepKey(side, column.sense));
  }

  protected isKeeping(side: number, column: WordColumn): boolean {
    return this.keeping().has(keepKey(side, column.sense));
  }

  /** Keep on a word's meaning, Kept to take it back; a guest is sent to sign in. Per sense, as on the sheet. */
  protected toggleKeep(side: number, column: WordColumn): void {
    if (!this.signedIn) {
      void this.router.navigate(['/auth']);
      return;
    }
    const key = keepKey(side, column.sense);
    if (this.keeping().has(key)) return;
    this.keeping.update(keeping => new Set(keeping).add(key));
    this.keepError.set('');
    const release = () => this.keeping.update(keeping => {
      const next = new Set(keeping);
      next.delete(key);
      return next;
    });
    const set = (cardId: string | null) => this.kept.update(kept => {
      const next = new Map(kept);
      if (cardId) next.set(key, cardId);
      else next.delete(key);
      return next;
    });
    const cardId = this.kept().get(key);
    if (cardId) {
      this.cardService.deleteCard(cardId).pipe(finalize(release), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => set(null),
        error: error => this.keepError.set(getErrorMessage(error, $localize`The sense could not be taken back. Please try again.`)),
      });
      return;
    }
    this.cardService.createCard(cardFor(column.lookup, column.sense)).pipe(finalize(release), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: card => set(card.id ?? null),
      error: error => this.keepError.set(getErrorMessage(error, $localize`The sense could not be kept. Please try again.`)),
    });
  }

  protected frame(text: string, column: WordColumn) {
    return frameParts(text, column.headword);
  }

  protected listenLabel(column: WordColumn): string {
    return $localize`Play “${column.headword}:word:”`;
  }

  private definitionLeads(lookup: DiscoverLookup): boolean {
    const user = this.userInfoService.currentUserInfo;
    const level = user?.learners.find(learner => learner.language === lookup.language)?.selfReportedLevel ?? null;
    return leadsWithDefinition(user?.uiPreferences?.learning?.senseLead ?? 'level', level);
  }

  /** The line a meaning is named by: the one the reader's setting puts first, as on the sheet. */
  private lead(sense: DiscoverSense, lookup: DiscoverLookup): string {
    const translation = sense.translations.join(', ');
    const definition = sense.definition ?? '';
    return (this.definitionLeads(lookup) ? definition || translation : translation || definition) || $localize`Meaning not supplied`;
  }

  private sub(sense: DiscoverSense, lookup: DiscoverLookup): string {
    const translation = sense.translations.join(', ');
    const definition = sense.definition ?? '';
    if (!translation || !definition) return '';
    return this.definitionLeads(lookup) ? translation : definition;
  }
}

function keepKey(side: number, sense: DiscoverSense): string {
  return `${side}:${sense.index}`;
}

/** "British" for en-GB; the bare tag when this build does not know the variety. */
function varietyLabel(lookup: DiscoverLookup, tag: string): string {
  return varietyRow(lookup.language)?.varieties.find(variety => variety.tag.toLowerCase() === tag.toLowerCase())?.label ?? tag;
}
