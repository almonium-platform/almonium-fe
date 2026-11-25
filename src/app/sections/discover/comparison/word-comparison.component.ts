import {ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, linkedSignal, output} from '@angular/core';
import {RouterLink} from '@angular/router';
import {UserInfoService} from '../../../services/user-info.service';
import {varietyRow} from '../../../shared/language-varieties';
import {DiscoverLookup, DiscoverPronunciation, DiscoverSense} from '../discover.service';
import {languageName, partOfSpeechLabel} from '../entry-shape';
import {speakerKey} from '../pronunciation-table';
import {ComparedSide, ComparisonRow, ComparisonRowKind, bestPair, comparisonLinks, comparisonRows, soundOf} from '../word-comparison';
import {ExampleParts, SenseRow, frequencyBand, frequencyBars, groupSenses, leadsWithDefinition} from '../word-sheet';

/** A clip the table asks the page to play: the page owns the one player, so two speakers never talk at once. */
export interface ComparedSound {
  key: string;
  text: string;
  variety: string;
  clipUrl: string | null;
}

/** A word has this many meanings listed until the rest are asked for. */
const MEANINGS_SHOWN = 4;

interface MeaningChoice {
  /** Its place in the word's senses, which is what picking it sets. */
  at: number;
  number: number;
  lead: string;
  partOfSpeech: string;
}

interface WordColumn {
  lookup: DiscoverLookup;
  headword: string;
  partOfSpeech: string;
  /** The language's name, said only when the two words are not of one language. */
  language: string;
  meanings: MeaningChoice[];
  hidden: number;
  selected: number;
  sub: string;
  example: ExampleParts | null;
  frequency: {bars: number; band: string; title: string} | null;
  sound: {pronunciation: DiscoverPronunciation; variety: string; playable: boolean; play: ComparedSound} | null;
}

/**
 * Two word sheets as one table ("affect vs effect"): each word's meanings to pick from, then what the lexicon says
 * of the two picked, row against row. Nothing is written for the pair; what the two share is set in grey so the
 * eye lands on where they part.
 */
@Component({
  selector: 'app-word-comparison',
  imports: [RouterLink],
  templateUrl: './word-comparison.component.html',
  styleUrl: './word-comparison.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordComparisonComponent {
  readonly first = input.required<DiscoverLookup>();
  readonly second = input.required<DiscoverLookup>();
  /** The speaker playing on the page, by its key. */
  readonly playing = input<string | null>(null);
  readonly listen = output<ComparedSound>();

  private readonly userInfoService = inject(UserInfoService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly rowLabels: Record<ComparisonRowKind, string> = {
    level: $localize`Level`,
    use: $localize`Use`,
    grammar: $localize`Grammar`,
    pattern: $localize`Pattern`,
    often: $localize`Often`,
    opposite: $localize`Opposite`,
    forms: $localize`Forms`,
    spelled: $localize`Spelled`,
  };
  protected readonly bars = [1, 2, 3, 4, 5];
  protected readonly noRecordingTitle = $localize`No recording yet`;
  protected readonly openTitle = $localize`Open the full entry`;

  /** Each word's senses in the order its own sheet lists them. */
  private readonly senses = computed(() => [this.first(), this.second()].map(lookup => groupSenses(lookup.senses)));
  /** The meaning each word is compared by; a new pair starts from the two that most plainly say the same thing. */
  private readonly selection = linkedSignal<[number, number]>(() => {
    const [first, second] = this.senses();
    return bestPair(this.first(), first.map(row => row.sense), this.second(), second.map(row => row.sense));
  });
  protected readonly expanded = linkedSignal(() => {
    this.senses();
    return false;
  });

  /** The words that have no entry; with one the table is not drawn, since there is nothing to set beside the other. */
  protected readonly missing = computed(() => [this.first(), this.second()].filter(lookup => !lookup.senses.length).map(lookup => lookup.entry));
  protected readonly found = computed(() => [this.first(), this.second()].find(lookup => lookup.senses.length) ?? null);

  protected readonly title = computed(() => $localize`${this.first().entry}:first: compared with ${this.second().entry}:second:`);

  private readonly sides = computed<ComparedSide[]>(() => {
    const selection = this.selection();
    return [this.first(), this.second()].map((lookup, at) => ({
      lookup,
      sense: this.senses()[at][selection[at]].sense,
      varietyName: (tag: string) => varietyLabel(lookup, tag),
    }));
  });

  protected readonly columns = computed<WordColumn[]>(() => {
    const lookups = [this.first(), this.second()];
    const sides = this.sides();
    const selection = this.selection();
    const oneLanguage = lookups[0].language === lookups[1].language;
    // Both words are heard in one accent where they can be: the learner's, else the one the first word leads with.
    let variety = this.userInfoService.currentUserInfo?.learners.find(learner => learner.language === lookups[0].language)?.variety ?? null;
    return lookups.map((lookup, at) => {
      const rows = this.senses()[at];
      const row = rows[selection[at]];
      const sense = sides[at].sense;
      const shown = rows
        .map((each, index) => ({each, index}))
        .filter(({index}) => this.expanded() || index < MEANINGS_SHOWN || index === selection[at]);
      const pronunciation = soundOf(lookup, sense, variety);
      variety ??= pronunciation?.variety ?? null;
      const headword = sense.headword || lookup.entry;
      return {
        lookup,
        headword,
        partOfSpeech: partOfSpeechLabel(sense.partOfSpeech),
        language: oneLanguage ? '' : languageName(lookup.language, this.locale),
        meanings: shown.map(({each, index}) => ({
          at: index, number: each.number, lead: this.lead(each, lookup), partOfSpeech: partOfSpeechLabel(each.sense.partOfSpeech),
        })),
        hidden: rows.length - shown.length,
        selected: selection[at],
        sub: this.sub(sense, lookup),
        example: row.example,
        frequency: lookup.frequency ? {
          bars: frequencyBars(lookup.frequency.score),
          band: frequencyBand(lookup.frequency.score),
          title: [$localize`Relative corpus score ${lookup.frequency.score}:score:`, lookup.frequency.provenance].join(' · '),
        } : null,
        sound: pronunciation ? {
          pronunciation,
          variety: varietyLabel(lookup, pronunciation.variety),
          // Synthesis can only say the spelling, which is a variety's first reading; any other needs its clip.
          playable: !!pronunciation.clipUrl || lookup.pronunciations.find(each => each.variety === pronunciation.variety) === pronunciation,
          play: {key: `compared:${at}:${speakerKey(pronunciation)}`, text: headword, variety: pronunciation.variety, clipUrl: pronunciation.clipUrl},
        } : null,
      };
    });
  });

  protected readonly rows = computed<ComparisonRow[]>(() => comparisonRows(this.sides()[0], this.sides()[1], this.locale));
  protected readonly links = computed(() => comparisonLinks(this.sides()[0], this.sides()[1]));
  /** Whether any of what the table shows is greyed, which the line under it then explains. */
  protected readonly anyShared = computed(() => this.rows().some(row => row.same || row.cells.some(cell => cell.some(item => item.shared))));
  protected readonly canPick = computed(() => this.senses().some(rows => rows.length > 1));
  protected readonly anyExample = computed(() => this.columns().some(column => column.example));
  protected readonly anyFrequency = computed(() => this.columns().some(column => column.frequency));
  protected readonly anySound = computed(() => this.columns().some(column => column.sound));
  protected readonly sameSound = computed(() => {
    const [a, b] = this.columns().map(column => column.sound?.pronunciation.ipa ?? null);
    return !!a && a === b;
  });

  protected pick(side: number, at: number): void {
    const selection = [...this.selection()] as [number, number];
    selection[side] = at;
    this.selection.set(selection);
  }

  protected showAll(): void {
    this.expanded.set(true);
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
  private lead(row: SenseRow, lookup: DiscoverLookup): string {
    const translation = row.sense.translations.join(', ');
    const definition = row.sense.definition ?? '';
    return (this.definitionLeads(lookup) ? definition || translation : translation || definition) || $localize`Meaning not supplied`;
  }

  private sub(sense: DiscoverSense, lookup: DiscoverLookup): string {
    const translation = sense.translations.join(', ');
    const definition = sense.definition ?? '';
    if (!translation || !definition) return '';
    return this.definitionLeads(lookup) ? translation : definition;
  }
}

/** "British" for en-GB; the bare tag when this build does not know the variety. */
function varietyLabel(lookup: DiscoverLookup, tag: string): string {
  return varietyRow(lookup.language)?.varieties.find(variety => variety.tag.toLowerCase() === tag.toLowerCase())?.label ?? tag;
}
