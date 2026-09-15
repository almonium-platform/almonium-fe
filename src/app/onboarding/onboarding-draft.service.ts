import {Injectable, inject} from '@angular/core';
import {LanguageCode} from '../models/language.enum';
import {CEFRLevel} from '../models/userinfo.model';
import {Interest} from '../shared/interests/interest.model';
import {LocalStorageService} from '../services/local-storage.service';
import {UserInfoService} from '../services/user-info.service';

/**
 * What a person has picked on a step but not yet submitted. Submitted answers live on the server and come back
 * through `/me`; this is only the gap between choosing and pressing Continue.
 */
export interface OnboardingDraft {
  targetLangs?: LanguageCode[];
  levels?: Partial<Record<LanguageCode, CEFRLevel>>;
  interests?: Interest[];
}

/**
 * Keeps unsubmitted onboarding answers on the device, per user, so a drop-off resumes with the fields as they were
 * left. Each step discards its own field once the server has the answer, and finishing onboarding drops the rest.
 */
@Injectable({providedIn: 'root'})
export class OnboardingDraftService {
  private readonly storage = inject(LocalStorageService);
  private readonly userInfoService = inject(UserInfoService);

  read<K extends keyof OnboardingDraft>(field: K): OnboardingDraft[K] | undefined {
    const userId = this.userInfoService.currentUserInfo?.id;
    if (!userId) {
      return undefined;
    }
    return this.storage.getOnboardingDraft<OnboardingDraft>(userId)?.[field];
  }

  write<K extends keyof OnboardingDraft>(field: K, value: NonNullable<OnboardingDraft[K]>): void {
    this.update(draft => ({...draft, [field]: value}));
  }

  discard(field: keyof OnboardingDraft): void {
    this.update(draft => {
      const rest = {...draft};
      delete rest[field];
      return rest;
    });
  }

  discardAll(): void {
    this.update(() => ({}));
  }

  private update(change: (draft: OnboardingDraft) => OnboardingDraft): void {
    const userId = this.userInfoService.currentUserInfo?.id;
    if (!userId) {
      return;
    }
    const current = this.storage.getOnboardingDraft<OnboardingDraft>(userId) ?? {};
    this.storage.saveOnboardingDraft(userId, change(current));
  }
}
