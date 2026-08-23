import {logger} from "../../../shared/logger";
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {SettingsTabsComponent} from "../tabs/settings-tabs.component";
import {UserInfoService} from "../../../services/user-info.service";
import {PlanType, UserInfo} from "../../../models/userinfo.model";
import {PopupTemplateStateService} from "../../../shared/modals/popup-template/popup-template-state.service";
import {BehaviorSubject, finalize, firstValueFrom, Subject, takeUntil} from "rxjs";
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
import {SettingsAvatarPickerComponent} from './avatar/settings-avatar-picker/settings-avatar-picker.component';
import {ProfileService} from '../../../shared/user-preview-card/profile.service';
import {UserProfileInfo} from '../../../shared/user-preview-card/user-profile.model';
import {LanguageNameService} from '../../../services/language-name.service';

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
  private languageNameService = inject(LanguageNameService);

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

  protected get primaryLevel(): string {
    return this.primaryLearner?.selfReportedLevel ?? '—';
  }

  protected get primaryLanguage(): string {
    const code = this.primaryLearner?.language;
    return code ? this.languageNameService.getLanguageName(code) : 'Level';
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

  private get primaryLearner() {
    return this.userInfo?.learners.find(learner => learner.active) ?? this.userInfo?.learners[0];
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
