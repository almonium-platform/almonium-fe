import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {EmblemComponent} from '../../shared/emblem/emblem.component';
import {finalize} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {LanguageCode} from '../../models/language.enum';
import {LearningIntent} from '../../models/card.model';
import {CardService} from '../../services/card.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {getErrorMessage} from '../../shared/http-error';
import {DiscoverLookup, DiscoverSense, DiscoverService} from './discover.service';

@Component({
  selector: 'app-discover',
  imports: [FormsModule, RouterLink, EmblemComponent],
  templateUrl: './discover.component.html',
  styleUrls: ['./discover.component.less'],
})
export class DiscoverComponent implements OnInit {
  private readonly discoverService = inject(DiscoverService);
  private readonly cardService = inject(CardService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected searchText = '';
  protected context = '';
  protected sentenceTokens: string[] = [];
  protected lookup: DiscoverLookup | null = null;
  protected selectedSenseIndex = 0;
  protected meaning = '';
  protected loading = false;
  protected saving = false;
  protected saved = false;
  protected errorMessage = '';
  protected saveError = '';
  protected currentLanguage = LanguageCode.EN;
  protected readonly diacritics = ['ä', 'ö', 'ü', 'ß', 'é', 'è', 'ç', 'ñ', 'ł'];
  protected readonly intentOptions: {value: LearningIntent; label: string; detail: string}[] = [
    {value: 'UNDERSTAND', label: 'Understand it', detail: 'Recognise it while reading'},
    {value: 'PRODUCE', label: 'Say it too', detail: 'Recall the word from its meaning'},
    {value: 'DISAMBIGUATE', label: 'Tell it apart', detail: 'Practise it against confusing words'},
  ];
  protected selectedIntents = new Set<LearningIntent>(['UNDERSTAND']);

  protected get signedIn(): boolean {
    return this.userInfoService.currentUserInfo !== null;
  }

  protected get selectedSense(): DiscoverSense | null {
    return this.lookup?.senses[this.selectedSenseIndex] ?? null;
  }

  ngOnInit(): void {
    this.languageService.currentLanguage$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(language => {
      this.currentLanguage = language || LanguageCode.EN;
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.searchText = params.get('text') ?? '';
      this.context = params.get('context') ?? '';
      if (this.searchText) this.submitSearch();
    });
  }

  protected submitSearch(): void {
    const input = this.searchText.trim().replace(/\s+/g, ' ');
    if (!input) return;
    const tokens = this.tokenize(input);
    if (tokens.length > 1 && !this.context) {
      this.context = input;
      this.sentenceTokens = tokens;
      this.lookup = null;
      this.errorMessage = '';
      return;
    }
    this.sentenceTokens = this.context ? this.tokenize(this.context) : [];
    this.lookupWord(this.context ? input : (tokens[0] ?? input));
  }

  protected lookupWord(word: string): void {
    const entry = word.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}'’-]+$/gu, '');
    if (!entry) return;
    this.searchText = entry;
    this.loading = true;
    this.saved = false;
    this.errorMessage = '';
    this.saveError = '';
    this.discoverService.lookup(entry, this.currentLanguage, this.translationLanguage(), this.context || undefined)
      .pipe(finalize(() => this.loading = false), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lookup => {
          this.lookup = lookup;
          this.selectedSenseIndex = 0;
          this.meaning = lookup.senses[0]?.translations.join(', ') ?? '';
        },
        error: error => this.errorMessage = getErrorMessage(error, 'This word sheet could not be loaded. Please try again.'),
      });
  }

  protected selectSense(index: number): void {
    this.selectedSenseIndex = index;
    this.meaning = this.lookup?.senses[index]?.translations.join(', ') ?? '';
    this.saved = false;
  }

  protected toggleIntent(intent: LearningIntent): void {
    if (intent === 'UNDERSTAND') return;
    if (this.selectedIntents.has(intent)) this.selectedIntents.delete(intent);
    else this.selectedIntents.add(intent);
  }

  protected insertDiacritic(character: string): void {
    this.searchText += character;
  }

  protected keepWord(): void {
    if (!this.lookup || !this.meaning.trim() || !this.signedIn || this.saving) return;
    const sense = this.selectedSense;
    this.saving = true;
    this.saveError = '';
    this.cardService.createCard({
      entry: this.lookup.entry,
      language: this.lookup.language,
      translations: this.meaning.split(',').map(value => value.trim()).filter(Boolean).map(translation => ({translation})),
      partOfSpeech: sense?.partOfSpeech ?? undefined,
      selectedSense: sense ? `${sense.index}: ${sense.translations.join(', ') || this.meaning.trim()}` : this.meaning.trim(),
      sourceContext: this.lookup.sourceContext ?? undefined,
      learningIntents: [...this.selectedIntents],
      itemType: this.lookup.entry.includes(' ') ? 'PHRASE' : 'WORD',
      examples: this.lookup.sourceContext ? [{example: this.lookup.sourceContext, translation: ''}] : [],
      activeLearning: true,
      learnt: false,
      priority: 0,
    }).pipe(finalize(() => this.saving = false), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.saved = true,
      error: error => this.saveError = getErrorMessage(error, 'The word could not be kept. Please try again.'),
    });
  }

  private translationLanguage(): LanguageCode {
    const fluent = this.userInfoService.currentUserInfo?.fluentLangs.find(language => language !== this.currentLanguage);
    if (fluent) return fluent;
    return this.currentLanguage === LanguageCode.EN ? LanguageCode.UK : LanguageCode.EN;
  }

  private tokenize(value: string): string[] {
    return value.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
  }
}
