import {Injectable, computed, inject, signal} from '@angular/core';
import {Subject, debounceTime} from 'rxjs';
import {LocalStorageService} from '../../../../services/local-storage.service';
import {UserInfoService} from '../../../../services/user-info.service';
import {logger} from '../../../../shared/logger';
import {ProfileSettingsService} from '../../../settings/profile/profile-settings.service';
import {
  DEFAULT_READER_APPEARANCE,
  READER_FONT_FAMILIES,
  READER_LINE_SPACINGS,
  READER_SIZES,
  READER_WIDTHS,
  ReaderAppearance,
  parseReaderAppearance,
} from './reader-appearance';

const STORAGE_KEY = 'reader-appearance';
const SAVE_DELAY_MS = 600;

/**
 * The reader's appearance, one for every book (G25). A member's choice lives on the account, so the phone and
 * the desktop agree; this device also keeps a copy, which is all a guest has and what the reader opens with
 * before the account has answered.
 */
@Injectable({providedIn: 'root'})
export class ReaderAppearanceService {
  private readonly storage = inject(LocalStorageService);
  private readonly userInfo = inject(UserInfoService);
  private readonly profileSettings = inject(ProfileSettingsService);

  private readonly state = signal<ReaderAppearance>(parseReaderAppearance(this.storage.getItem(STORAGE_KEY)));
  /** Taps on the size buttons arrive in bursts; the account hears the last of them. */
  private readonly accountSaves = new Subject<void>();

  readonly appearance = this.state.asReadonly();
  readonly sizePx = computed(() => READER_SIZES[this.state().size]);
  readonly lineHeight = computed(() => READER_LINE_SPACINGS[this.state().lineSpacing]);
  readonly widthPx = computed(() => READER_WIDTHS[this.state().width]);
  readonly fontFamily = computed(() => READER_FONT_FAMILIES[this.state().font]);
  readonly isDefault = computed(() => {
    const current = this.state();
    return (Object.keys(DEFAULT_READER_APPEARANCE) as (keyof ReaderAppearance)[])
      .every(key => current[key] === DEFAULT_READER_APPEARANCE[key]);
  });

  constructor() {
    this.accountSaves.pipe(debounceTime(SAVE_DELAY_MS)).subscribe(() => this.saveToAccount());
  }

  /** Called when the reader opens: a member's account choice replaces whatever this device remembered. */
  adoptAccountChoice(): void {
    const kept = this.userInfo.currentUserInfo?.uiPreferences.reader.appearance;
    if (kept) this.state.set({...kept});
  }

  change(patch: Partial<ReaderAppearance>): void {
    this.state.set(parseReaderAppearance({...this.state(), ...patch}));
    this.storage.saveItem(STORAGE_KEY, this.state());
    this.accountSaves.next();
  }

  stepSize(delta: 1 | -1): void {
    const next = this.state().size + delta;
    if (next >= 0 && next < READER_SIZES.length) this.change({size: next});
  }

  reset(): void {
    this.change({...DEFAULT_READER_APPEARANCE});
  }

  private saveToAccount(): void {
    const user = this.userInfo.currentUserInfo;
    if (!user) return;
    const uiPreferences = structuredClone(user.uiPreferences);
    uiPreferences.reader.appearance = {...this.state()};
    this.userInfo.updateUserInfo({uiPreferences});
    this.profileSettings.saveUiPreferences(uiPreferences).subscribe({
      error: (error: unknown) => logger.warn('Could not save the reader appearance', error),
    });
  }
}
