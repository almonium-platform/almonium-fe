import {Component, EventEmitter, OnDestroy, OnInit, Output, inject} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {BehaviorSubject, Subject, finalize, takeUntil} from 'rxjs';
import {CEFRLevel, SetupStep, UserInfo} from '../../models/userinfo.model';
import {LanguageCode} from '../../models/language.enum';
import {LanguageNameService} from '../../services/language-name.service';
import {UserInfoService} from '../../services/user-info.service';
import {OnboardingService} from '../onboarding.service';
import {ButtonComponent} from '../../shared/button/button.component';
import {logger} from '../../shared/logger';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {OnboardingDraftService} from '../onboarding-draft.service';

const LEVEL_COPY: Record<CEFRLevel, string> = {
  [CEFRLevel.A1]: 'I know some words and set phrases.',
  [CEFRLevel.A2]: 'I can follow short, direct sentences about familiar things.',
  [CEFRLevel.B1]: 'I can get through a simple story if I look words up often.',
  [CEFRLevel.B2]: 'I can follow a novel with a dictionary nearby.',
  [CEFRLevel.C1]: 'I read fluently and stop only at unusual or literary words.',
  [CEFRLevel.C2]: 'I read anything, including older and specialised prose.',
};

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
  protected readonly levels = Object.entries(LEVEL_COPY) as [CEFRLevel, string][];
  protected readonly levelControls = new Map<string, FormControl<CEFRLevel>>();
  protected readonly loading$ = this.loadingSubject$.asObservable();
  protected userInfo: UserInfo | null = null;

  ngOnInit(): void {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      if (!userInfo) return;
      this.userInfo = userInfo;
      const draftLevels = this.draft.read('levels') ?? {};
      userInfo.learners.forEach(learner => {
        if (!this.levelControls.has(learner.language)) {
          const control = new FormControl(
            draftLevels[learner.language] ?? learner.selfReportedLevel ?? CEFRLevel.B1,
            {nonNullable: true},
          );
          control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.saveDraft());
          this.levelControls.set(learner.language, control);
        }
      });
    });
  }

  private saveDraft(): void {
    const levels: Partial<Record<LanguageCode, CEFRLevel>> = {};
    this.levelControls.forEach((control, language) => levels[language as LanguageCode] = control.value);
    this.draft.write('levels', levels);
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

  protected submit(): void {
    if (!this.userInfo || this.loadingSubject$.value) return;
    const levels = this.userInfo.learners.map(learner => ({
      language: learner.language,
      cefrLevel: this.control(learner.language).value,
    }));

    this.loadingSubject$.next(true);
    this.onboardingService.setupLevels(levels)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          const learners = this.userInfo!.learners.map(learner => ({
            ...learner,
            selfReportedLevel: this.control(learner.language).value,
          }));
          this.draft.discard('levels');
          this.userInfoService.updateUserInfo({learners, setupStep: SetupStep.INTERESTS});
        },
        error: error => {
          logger.error('Failed to save language level', error);
          this.alertService.open('Failed to save your level', {appearance: 'negative'}).subscribe();
        },
      });
  }
}
