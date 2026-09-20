import {Component, EventEmitter, OnDestroy, OnInit, Output, inject} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {BehaviorSubject, Subject, finalize, takeUntil} from 'rxjs';
import {CEFRLevel, Learner, SetupStep, UserInfo} from '../../models/userinfo.model';
import {LanguageCode} from '../../models/language.enum';
import {LanguageNameService} from '../../services/language-name.service';
import {UserInfoService} from '../../services/user-info.service';
import {OnboardingService} from '../onboarding.service';
import {ButtonComponent} from '../../shared/button/button.component';
import {logger} from '../../shared/logger';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {OnboardingDraftService} from '../onboarding-draft.service';
import {CEFR_LEVEL_ENTRIES} from '../../shared/cefr-level-copy';
import {LanguageVariety, LanguageVarietyRow, varietyOf, varietyRow} from '../../shared/language-varieties';

@Component({
  selector: 'app-level-setup',
  imports: [ReactiveFormsModule, ButtonComponent],
  templateUrl: './level-setup.component.html',
  styleUrl: './level-setup.component.less',
})
export class LevelSetupComponent implements OnInit, OnDestroy {
  private readonly onboardingService = inject(OnboardingService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly alertService = inject(TuiNotificationService);
  private readonly draft = inject(OnboardingDraftService);
  private readonly destroy$ = new Subject<void>();
  private readonly loadingSubject$ = new BehaviorSubject(false);

  @Output() continue = new EventEmitter<SetupStep>();
  @Output() back = new EventEmitter<void>();
  protected readonly levels = CEFR_LEVEL_ENTRIES;
  protected readonly levelControls = new Map<string, FormControl<CEFRLevel>>();
  /**
   * Which English, which German (design V1): one control per language that has a row, holding a BCP-47 tag. The
   * default is selected before the step renders, so not touching the row is the answer "I don't mind".
   */
  protected readonly varietyControls = new Map<string, FormControl<string>>();
  protected readonly loading$ = this.loadingSubject$.asObservable();
  protected userInfo: UserInfo | null = null;

  ngOnInit(): void {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      if (!userInfo) return;
      this.userInfo = userInfo;
      const draftLevels = this.draft.read('levels') ?? {};
      const draftVarieties = this.draft.read('varieties') ?? {};
      userInfo.learners.forEach(learner => {
        if (!this.levelControls.has(learner.language)) {
          const control = new FormControl(
            draftLevels[learner.language] ?? learner.selfReportedLevel ?? CEFRLevel.B1,
            {nonNullable: true},
          );
          control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.saveDraft());
          this.levelControls.set(learner.language, control);
        }
        const variety = varietyOf(learner.language, draftVarieties[learner.language] ?? learner.variety);
        if (variety && !this.varietyControls.has(learner.language)) {
          const control = new FormControl(variety.tag, {nonNullable: true});
          control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.saveDraft());
          this.varietyControls.set(learner.language, control);
        }
      });
    });
  }

  private saveDraft(): void {
    const levels: Partial<Record<LanguageCode, CEFRLevel>> = {};
    this.levelControls.forEach((control, language) => levels[language as LanguageCode] = control.value);
    this.draft.write('levels', levels);
    if (this.varietyControls.size === 0) return;
    const varieties: Partial<Record<LanguageCode, string>> = {};
    this.varietyControls.forEach((control, language) => varieties[language as LanguageCode] = control.value);
    this.draft.write('varieties', varieties);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected languageName(language: string): string {
    return this.languageNameService.getLanguageName(language);
  }

  protected control(language: string): FormControl<CEFRLevel> {
    return this.levelControls.get(language)!;
  }

  /** The row for a language with a choice to make; null for Italian, Ukrainian, Polish, and the step is unchanged. */
  protected varieties(language: LanguageCode): LanguageVarietyRow | null {
    return varietyRow(language);
  }

  protected varietyControl(language: string): FormControl<string> {
    return this.varietyControls.get(language)!;
  }

  protected chooseVariety(language: string, variety: LanguageVariety): void {
    this.varietyControl(language).setValue(variety.tag);
  }

  protected onVarietyKeydown(event: KeyboardEvent, language: string, row: LanguageVarietyRow): void {
    const index = row.varieties.findIndex(variety => variety.tag === this.varietyControl(language).value);
    let next: number;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': next = (index + 1) % row.varieties.length; break;
      case 'ArrowLeft': case 'ArrowUp': next = (index + row.varieties.length - 1) % row.varieties.length; break;
      case 'Home': next = 0; break;
      case 'End': next = row.varieties.length - 1; break;
      default: return;
    }
    event.preventDefault();
    this.chooseVariety(language, row.varieties[next]);
    (event.target as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }

  protected submit(): void {
    if (!this.userInfo || this.loadingSubject$.value) return;
    const levels = this.userInfo.learners.map(learner => ({
      language: learner.language,
      cefrLevel: this.control(learner.language).value,
      variety: this.varietyControls.get(learner.language)?.value,
    }));

    this.loadingSubject$.next(true);
    this.onboardingService.setupLevels(levels)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          const learners = this.userInfo!.learners.map(learner => new Learner(
            learner.id,
            learner.language,
            this.control(learner.language).value,
            learner.active,
            this.varietyControls.get(learner.language)?.value ?? learner.variety,
          ));
          this.draft.discard('levels');
          this.draft.discard('varieties');
          this.userInfoService.updateUserInfo({learners, setupStep: SetupStep.INTERESTS});
        },
        error: error => {
          logger.error('Failed to save language level', error);
          this.alertService.open($localize`Failed to save your level`, {appearance: 'negative'}).subscribe();
        },
      });
  }
}
