import {logger} from "../../../shared/logger";
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {UserInfoService} from "../../../services/user-info.service";
import {PlanType, UserInfo} from "../../../models/userinfo.model";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {BehaviorSubject, finalize, firstValueFrom, of, Subject, takeUntil} from "rxjs";
import {TuiNotificationService} from "@taiga-ui/core/components";
import {RouterLink} from "@angular/router";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {UsernameComponent} from "../../../shared/username/username.component";
import {InterestsComponent} from "../../../shared/interests/interests.component";
import {TuiChip} from "@taiga-ui/kit/components";
import {Interest} from "../../../shared/interests/interest.model";
import {ProfileSettingsService} from "./profile-settings.service";
import {ButtonComponent} from "../../../shared/button/button.component";
import {ShareLinkComponent} from "../../../shared/share-link/share-link.component";
import {SharedLucideIconsModule} from "../../../shared/shared-lucide-icons.module";
import {AvatarComponent} from '../../../shared/avatar/avatar.component';
import {AvatarPickerComponent} from '../../../shared/profile/avatar-picker/avatar-picker.component';
import {ProfileService} from '../../../shared/user-preview-card/profile.service';
import {UserProfileInfo} from '../../../shared/user-preview-card/user-profile.model';
import {DecimalPipe} from '@angular/common';
import {LanguageCode} from '../../../models/language.enum';
import {LanguageNameService} from '../../../services/language-name.service';
import {LanguageApiService} from '../../../services/language-api.service';
import {ActiveLanguagePolicy} from '../../../models/active-language-policy.model';
import {LearningStats, LearningStatsService} from '../../../services/learning-stats.service';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {LanguageRhythm, Rhythm, bandWeeks, cadenceLabel, hasTarget, paceFraction} from '../../../shared/rhythm/rhythm.model';
import {RhythmBandComponent} from '../../../shared/rhythm/rhythm-band/rhythm-band.component';
import {RhythmService} from '../../../shared/rhythm/rhythm.service';
import {catchError, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-profile-settings',
  imports: [
    SettingsTabsComponent,
    ReactiveFormsModule,
    UsernameComponent,
    AvatarComponent,
    AvatarPickerComponent,
    InterestsComponent,
    TuiChip,
    ButtonComponent,
    ShareLinkComponent,
    FormsModule,
    SharedLucideIconsModule,
    RouterLink,
    RhythmBandComponent,
    DecimalPipe,
  ],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.less'
})
export class ProfileSettingsComponent implements OnInit, OnDestroy {
  private userInfoService = inject(UserInfoService);
  private profileSettingsService = inject(ProfileSettingsService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private alertService = inject(TuiNotificationService);
  private profileService = inject(ProfileService);
  private languageService = inject(TargetLanguageDropdownService);
  private languageNameService = inject(LanguageNameService);
  private languageApiService = inject(LanguageApiService);
  private learningStatsService = inject(LearningStatsService);
  private rhythmService = inject(RhythmService);

  @ViewChild(ShareLinkComponent, {static: false}) shareLinkComponent!: ShareLinkComponent;

  private readonly destroy$ = new Subject<void>();

  protected userInfo: UserInfo | null = null;
  protected profileInfo: UserProfileInfo | null = null;
  protected profileEdit = false;
  protected premium = true;
  private loadedProfileId: string | null = null;

  // interests
  protected interestsEdit = false;
  protected interests: Interest[] = [];

  // the record: numbers that only move by reading, and the harness they sit beside
  protected stats: LearningStats | null = null;
  protected rhythm: Rhythm | null = null;
  protected activeLanguage: LanguageCode | null = null;
  /** Words kept per language, for the set-aside footnote; the record page shows the rest. */
  private policy: ActiveLanguagePolicy | null = null;
  private langColors: Record<string, string> = {};

  private readonly loadingSubjectInterests$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingInterests$ = this.loadingSubjectInterests$.asObservable();

  private readonly loadingSubjectHideProfile$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingHideProfile$ = this.loadingSubjectHideProfile$.asObservable();

  protected get hideProfileLoading(): boolean {
    return this.loadingSubjectHideProfile$.value;
  }

  ngOnInit() {
    this.profileService.myProfile$.pipe(takeUntil(this.destroy$)).subscribe(profile => this.profileInfo = profile);

    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(info => {
      if (!info) {
        return;
      }
      this.userInfo = info;
      this.premium = info.premium;
      this.interests = info.interests;
      this.loadProfileInfo(info.id);
    });

    this.rhythmService.rhythm$.pipe(takeUntil(this.destroy$)).subscribe(rhythm => this.rhythm = rhythm);
    this.languageService.langColors$.pipe(takeUntil(this.destroy$)).subscribe(colors => this.langColors = colors);
    this.rhythmService.load().subscribe({
      error: error => logger.error('Failed to load your rhythm:', error),
    });
    this.languageApiService.getActiveLanguagePolicy()
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(policy => this.policy = policy);

    this.languageService.currentLanguage$.pipe(
      switchMap(language => {
        this.activeLanguage = language;
        // A failed record must not end the stream, or switching language would stop updating it.
        return this.learningStatsService.getStats(language).pipe(
          catchError(error => {
            logger.error('Failed to load your learning record:', error);
            return of(null);
          }),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(stats => this.stats = stats);
  }

  protected get activeLanguageName(): string {
    return this.activeLanguage ? this.languageNameService.getLanguageName(this.activeLanguage) : '';
  }

  protected get activeRhythm(): LanguageRhythm | null {
    return RhythmService.forLanguage(this.rhythm, this.activeLanguage);
  }

  /** "English · B2": the record's header names its language and level, so the numbers are never anonymous. */
  protected get recordLabel(): string {
    const level = this.userInfo?.learners.find(learner => learner.language === this.activeLanguage)?.selfReportedLevel;
    return level ? `${this.activeLanguageName} · ${level}` : this.activeLanguageName;
  }

  protected get firstSessionPhrase(): string {
    return this.activeLanguage ? $localize`a first ${this.activeLanguageName}:language: session` : $localize`a first session`;
  }

  /** The languages beside the active one, collapsed to a name and how many weeks they kept. */
  protected get otherLanguages(): LanguageRhythm[] {
    return (this.rhythm?.languages ?? []).filter(entry => entry.language !== this.activeLanguage);
  }

  /** "Also learning" is only true of a language being learned; a card of set-aside languages is titled so. */
  protected get allOthersSetAside(): boolean {
    const others = this.otherLanguages;
    return others.length > 0 && others.every(entry => !entry.editable);
  }

  /**
   * Under a set-aside language's name. Beside an active one the word is the state; when the card's title already
   * says it, the line says what is kept instead - and "Nothing read yet" rather than a zero.
   */
  protected asideNote(rhythm: LanguageRhythm): string {
    if (!this.allOthersSetAside) {
      return $localize`Set aside`;
    }
    const kept = this.policy?.languages.find(choice => choice.language === rhythm.language)?.wordsKept ?? 0;
    return kept > 0 ? $localize`${kept.toLocaleString($localize.locale)}:count: words kept` : $localize`Nothing read yet`;
  }

  /**
   * A profile with nothing on it should not grade anyone. Until a first session is finished the record says what
   * will live there instead of showing zeroes.
   */
  protected get hasRecord(): boolean {
    const kept = (this.stats?.wordsKept ?? 0) + (this.stats?.booksFinished ?? 0);
    const active = this.activeRhythm;
    const learned = active ? bandWeeks(active).some(week => week.daysMet > 0) : false;
    return kept > 0 || learned;
  }

  protected pace(rhythm: LanguageRhythm): {met: number; counted: number} {
    return paceFraction(rhythm);
  }

  protected recordCaption(rhythm: LanguageRhythm): string {
    const bar = hasTarget(rhythm.target) ? cadenceLabel(rhythm.target) : $localize`No bar set`;
    const since = this.sinceLabel(rhythm.startedAt);
    return $localize`${bar}:bar: ${since}:since:. Tint shows time learning, not a score.`;
  }

  protected languageName(language: LanguageCode): string {
    return this.languageNameService.getLanguageName(language);
  }

  private sinceLabel(startedAt: string): string {
    const [year, month, day] = startedAt.split('-').map(Number);
    const started = new Date(year, month - 1, day);
    const sameYear = started.getFullYear() === new Date().getFullYear();
    const format: Intl.DateTimeFormatOptions = sameYear ? {month: 'long'} : {month: 'long', year: 'numeric'};
    return $localize`since ${new Intl.DateTimeFormat($localize.locale, format).format(started)}:date:`;
  }

  protected crestColour(language: LanguageCode): string {
    return this.langColors[language] ?? '#7A6BB8';
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProfileInfo(userId: string): void {
    if (this.loadedProfileId === userId) {
      return;
    }
    this.loadedProfileId = userId;
    this.profileService.loadMyProfile(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => this.loadedProfileId = null,
      });
  }

  /** The one true fact a new account has: when it arrived, and what it is here to learn. */
  protected get memberSince(): string {
    if (!this.profileInfo?.registeredAt) {
      return $localize`Your profile`;
    }
    const since = new Date(this.profileInfo.registeredAt).toLocaleDateString($localize.locale, {
      month: 'long',
      year: 'numeric',
    });
    const here = $localize`Here since ${since}:date:`;
    return this.activeLanguage ? $localize`${here}:here: · learning ${this.activeLanguageName}:language:` : here;
  }

  protected get planSummary(): string {
    const subscription = this.userInfo?.subscription;
    if (!this.premium || !subscription) {
      return $localize`Reading essentials with plan limits.`;
    }
    if (subscription.type === PlanType.LIFETIME) {
      return $localize`Lifetime membership`;
    }
    if (!subscription.endDate) {
      return $localize`Active membership`;
    }
    const date = subscription.endDate.toLocaleDateString($localize.locale, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return subscription.autoRenewal ? $localize`Renews ${date}:date:` : $localize`Ends ${date}:date:`;
  }

  protected editInterests() {
    this.interestsEdit = true;
  }

  protected cancelInterestsEdit(): void {
    this.interests = this.userInfo?.interests ?? [];
    this.interestsEdit = false;
  }

  protected async saveInterests() {
    if (this.interests === this.userInfo?.interests) {
      this.interestsEdit = false;
      logger.info('no changes');
      return;
    }

    // Start loading
    this.loadingSubjectInterests$.next(true);

    try {
      await firstValueFrom(
        this.profileSettingsService.saveInterests(this.interests.map((i) => i.id))
      );

      this.interestsEdit = false;
      this.userInfoService.updateUserInfo({interests: this.interests});
      this.alertService
        .open($localize`Interests updated`, {appearance: 'positive'})
        .subscribe();
    } catch {
      this.alertService
        .open($localize`Failed to update interests`, {appearance: 'negative'})
        .subscribe();
    } finally {
      this.loadingSubjectInterests$.next(false);
    }
  }

  protected onSelectedInterestsChange(interests: Interest[]) {
    this.interests = interests;
  }

  protected validateInterests() {
    return true;
  }

  protected openShareProfile() {
    this.popupTemplateStateService.open(this.shareLinkComponent.content, 'share-link');
  }

  protected copyProfileLink() {
    const link = this.getProfileLink();
    navigator.clipboard.writeText(link).then(
      () => {
        this.alertService.open($localize`Link copied to clipboard`, {appearance: 'neutral'}).subscribe();
      },
      (err) => {
        logger.error('Failed to copy: ', err);
      }
    );
  }

  protected getProfileLink() {
    return `${window.location.origin}/users/${encodeURIComponent(this.userInfo?.username ?? '')}`;
  }

  protected get visibilitySwitchLabel(): string {
    return this.userInfo?.hidden ? $localize`Make profile visible` : $localize`Hide profile`;
  }

  protected toggleHidden(): void {
    const toggleValue = !this.userInfo?.hidden;
    if (this.userInfo?.hidden === undefined) {
      return; // Exit early if userInfo is not set
    }

    const oldValue = this.userInfo.hidden;
    this.userInfo.hidden = toggleValue; // Optimistic update
    this.loadingSubjectHideProfile$.next(true);

    this.profileSettingsService.toggleHidden(toggleValue).pipe(
      finalize(() => this.loadingSubjectHideProfile$.next(false)),
    ).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({hidden: toggleValue}); // Update cache on success
      },
      error: (error) => {
        if (this.userInfo) {
          this.userInfo.hidden = oldValue;
        }
        logger.error('Failed to save preferences:', error);
        this.alertService.open($localize`Failed to save preferences`, {appearance: 'negative'}).subscribe();
      },
    });
  }
}
