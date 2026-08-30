import {logger} from "../../../shared/logger";
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {UserInfoService} from "../../../services/user-info.service";
import {PlanType, UserInfo} from "../../../models/userinfo.model";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {BehaviorSubject, finalize, firstValueFrom, of, Subject, takeUntil} from "rxjs";
import {TuiNotificationService} from "@taiga-ui/core/components";
import {Router, RouterLink} from "@angular/router";
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
import {SettingsAvatarPickerComponent} from './avatar/settings-avatar-picker/settings-avatar-picker.component';
import {ProfileService} from '../../../shared/user-preview-card/profile.service';
import {UserProfileInfo} from '../../../shared/user-preview-card/user-profile.model';
import {DecimalPipe} from '@angular/common';
import {LanguageCode} from '../../../models/language.enum';
import {LanguageNameService} from '../../../services/language-name.service';
import {LearningStats, LearningStatsService} from '../../../services/learning-stats.service';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {LanguageRhythm, Rhythm, hasTarget, trackedWeeks, weeksAtPace} from '../../../shared/rhythm/rhythm.model';
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
    SettingsAvatarPickerComponent,
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
  private learningStatsService = inject(LearningStatsService);
  private rhythmService = inject(RhythmService);
  private router = inject(Router);

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
  private langColors: Record<string, string> = {};

  private readonly loadingSubjectInterests$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingInterests$ = this.loadingSubjectInterests$.asObservable();

  private readonly loadingSubjectHideProfile$ = new BehaviorSubject<boolean>(false);
  protected readonly loadingHideProfile$ = this.loadingSubjectHideProfile$.asObservable();

  protected get hideProfileLoading(): boolean {
    return this.loadingSubjectHideProfile$.value;
  }

  ngOnInit() {
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

  /** Languages with a bar first, deepest record at the top; those without one follow, dimmed, offering the bar. */
  protected get recordRows(): LanguageRhythm[] {
    const languages = this.rhythm?.languages ?? [];
    const committed = languages.filter(entry => hasTarget(entry.target))
      .sort((a, b) => weeksAtPace(b) - weeksAtPace(a));
    return [...committed, ...languages.filter(entry => !hasTarget(entry.target))];
  }

  /** Nothing has happened yet, so the space holds an invitation rather than three zeroes. */
  protected get hasRecord(): boolean {
    const kept = (this.stats?.wordsKept ?? 0) + (this.stats?.booksFinished ?? 0);
    return kept > 0 || this.recordRows.some(entry => hasTarget(entry.target));
  }

  protected weeksAtPace(rhythm: LanguageRhythm): number {
    return weeksAtPace(rhythm);
  }

  protected weeksCounted(rhythm: LanguageRhythm): number {
    return trackedWeeks(rhythm).length;
  }

  protected languageName(language: LanguageCode): string {
    return this.languageNameService.getLanguageName(language);
  }

  /** The bar is set where the interactive harness lives, so setting a pace means going there in that language. */
  protected goSetPace(rhythm: LanguageRhythm): void {
    this.languageService.setCurrentLanguage(rhythm.language);
    void this.router.navigate(['/home']);
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
    this.profileService.getUserProfile(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: profile => this.profileInfo = profile,
        error: () => this.loadedProfileId = null,
      });
  }

  protected get memberSince(): string {
    if (!this.profileInfo?.registeredAt) {
      return 'Your reading profile';
    }
    return `Reading since ${new Date(this.profileInfo.registeredAt).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })}`;
  }

  protected get planSummary(): string {
    const subscription = this.userInfo?.subscription;
    if (!this.premium || !subscription) {
      return 'Reading essentials with plan limits.';
    }
    if (subscription.type === PlanType.LIFETIME) {
      return 'Lifetime membership';
    }
    if (!subscription.endDate) {
      return 'Active membership';
    }
    const date = subscription.endDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `${subscription.autoRenewal ? 'Renews' : 'Ends'} ${date}`;
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
        .open('Interests updated', {appearance: 'positive'})
        .subscribe();
    } catch {
      this.alertService
        .open('Failed to update interests', {appearance: 'negative'})
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
        this.alertService.open('Link copied to clipboard', {appearance: 'neutral'}).subscribe();
      },
      (err) => {
        logger.error('Failed to copy: ', err);
      }
    );
  }

  protected getProfileLink() {
    return `${window.location.origin}/users/${encodeURIComponent(this.userInfo?.username ?? '')}`;
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
        this.alertService.open('Failed to save preferences', {appearance: 'negative'}).subscribe();
      },
    });
  }
}
