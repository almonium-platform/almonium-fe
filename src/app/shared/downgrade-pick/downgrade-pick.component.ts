import {Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {Router} from '@angular/router';
import {Subject, takeUntil} from 'rxjs';
import {ActiveLanguagePolicy, LanguageChoice} from '../../models/active-language-policy.model';
import {LanguageCode} from '../../models/language.enum';
import {UserInfo} from '../../models/userinfo.model';
import {LanguageApiService} from '../../services/language-api.service';
import {LanguageNameService} from '../../services/language-name.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {PopupTemplateStateService} from '../modals/popup-template/popup-template-state.service';
import {logger} from '../logger';

/** How close to the end the question becomes worth asking. */
const ASK_WITHIN_DAYS = 21;
const DEFAULT_CREST = '#7A6BB8';

/**
 * The choice a downgrade forces, asked before the downgrade rather than after it.
 *
 * <p>Answering is optional: the most recently read language is pre-selected and is also what the deadline keeps if
 * the sheet is never opened, so the question is an offer to correct a sensible default, not a gate.
 */
@Component({
  selector: 'app-downgrade-pick',
  templateUrl: './downgrade-pick.component.html',
  styleUrl: './downgrade-pick.component.less',
  imports: [DatePipe, DecimalPipe],
})
export class DowngradePickComponent implements OnInit, OnDestroy {
  @ViewChild('downgradePick', {static: true}) content!: TemplateRef<unknown>;

  private readonly languageApiService = inject(LanguageApiService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly popupTemplateStateService = inject(PopupTemplateStateService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  protected policy: ActiveLanguagePolicy | null = null;
  protected selected: LanguageCode | null = null;
  protected saving = false;
  protected endsOn: Date | null = null;
  private langColors: Record<string, string> = {};
  private askedFor: string | null = null;

  ngOnInit(): void {
    this.languageService.langColors$.pipe(takeUntil(this.destroy$)).subscribe(colors => this.langColors = colors);
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(info => {
      if (info && this.endingSoon(info) && this.askedFor !== info.id) {
        this.askedFor = info.id;
        this.endsOn = info.subscription.endDate;
        this.load();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get surplus(): LanguageChoice[] {
    if (!this.policy) return [];
    return this.policy.languages.filter(choice => choice.active && choice.language !== this.selected);
  }

  protected get selectedName(): string {
    return this.selected ? this.languageName(this.selected) : '';
  }

  protected languageName(language: LanguageCode): string {
    return this.languageNameService.getLanguageName(language);
  }

  protected crest(language: LanguageCode): string {
    return this.langColors[language] ?? DEFAULT_CREST;
  }

  /** "last read yesterday" beats a date here: the sheet is asking which language is still alive for you. */
  protected lastRead(choice: LanguageChoice): string {
    if (!choice.lastReadOn) return 'not read yet';
    const days = Math.floor((Date.now() - choice.lastReadOn.getTime()) / 86_400_000);
    if (days <= 0) return 'last read today';
    if (days === 1) return 'last read yesterday';
    if (days < 7) return `last read ${days} days ago`;
    if (days < 35) {
      const weeks = Math.round(days / 7);
      return `last read ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    return `last read in ${choice.lastReadOn.toLocaleDateString(undefined, {month: 'long'})}`;
  }

  protected select(language: LanguageCode): void {
    this.selected = language;
  }

  protected keep(): void {
    if (!this.selected || this.saving) return;
    this.saving = true;
    this.languageApiService.keepOnDowngrade(this.selected).subscribe({
      next: policy => {
        this.policy = policy;
        this.saving = false;
        this.popupTemplateStateService.close();
      },
      error: error => {
        this.saving = false;
        logger.error('Could not record which language to keep', error);
      },
    });
  }

  protected stayOnPremium(): void {
    this.popupTemplateStateService.close();
    void this.router.navigate(['/membership']);
  }

  private load(): void {
    this.languageApiService.getActiveLanguagePolicy().subscribe({
      next: policy => {
        const active = policy.languages.filter(choice => choice.active);
        // Nothing to ask when the plan ending costs nothing.
        if (active.length <= policy.allowanceWithoutPlan) {
          return;
        }
        this.policy = policy;
        this.selected = active.find(choice => choice.recommended)?.language ?? active[0].language;
        this.popupTemplateStateService.open(this.content, 'downgrade-pick');
      },
      error: error => logger.error('Could not load your languages', error),
    });
  }

  private endingSoon(info: UserInfo): boolean {
    const endDate = info.subscription?.endDate;
    if (!info.premium || !endDate || info.subscription.autoRenewal) {
      return false;
    }
    const daysLeft = (endDate.getTime() - Date.now()) / 86_400_000;
    return daysLeft > 0 && daysLeft <= ASK_WITHIN_DAYS;
  }
}
