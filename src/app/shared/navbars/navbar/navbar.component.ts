import {getErrorMessage} from '../../http-error';
import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgStyle} from "@angular/common";
import {Router, RouterLink} from "@angular/router";
import {DEFAULT_UI_PREFERENCES, UIPreferences, UserInfo} from "../../../models/userinfo.model";
import {LanguageCode} from "../../../models/language.enum";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {UserInfoService} from "../../../services/user-info.service";
import {BehaviorSubject, finalize, forkJoin, interval, Subject, takeUntil} from "rxjs";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {AvatarComponent} from "../../avatar/avatar.component";
import {PopupTemplateStateService} from "../../modals/popup-template/popup-template-state.service";
import {ManageAvatarComponent} from "../../../sections/settings/profile/avatar/manage-avatar/manage-avatar.component";
import {LucideAngularModule} from "lucide-angular";
import {ViewportService} from "../../../services/viewport.service";
import {SharedLucideIconsModule} from "../../shared-lucide-icons.module";
import {ChatUnreadService} from "../../../sections/social/chat-unread.service";
import {NotificationService} from "../../notification/notification.service";
import {Notification, NotificationType} from "../../notification/notification.model";
import {TuiDataListComponent, TuiNotificationService, TuiOption} from "@taiga-ui/core/components";
import {TuiDropdownContext, TuiDropdownDirective} from "@taiga-ui/core/portals";
import {ShortRelativeTimePipe} from "./short-relative-time.pipe";
import {ButtonComponent} from "../../button/button.component";
import {OverlayscrollbarsModule} from "overlayscrollbars-ngx";
import {TuiActiveZone} from "@taiga-ui/cdk/directives";
import {FirebaseNotificationService} from "../../../services/firebase-notification.service";
import {AvatarPreviewComponent} from "../../avatar/avatar-preview/avatar-preview.component";
import {TimerComponent} from "./timer/timer.component";
import {LocalStorageService} from "../../../services/local-storage.service";
import {TuiDataListDropdownManager} from "@taiga-ui/kit/directives";
import {TuiBadgedContentComponent, TuiBadgeNotification} from "@taiga-ui/kit/components";
import {LanguageNameService} from "../../../services/language-name.service";

const RECENT_LANGUAGES_KEY = 'recent_target_languages';
const LANGUAGE_CREST_SESSIONS_KEY = 'language_crest_hint_sessions';
const LANGUAGE_CREST_SESSION_KEY = 'language_crest_hint_seen';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.less'],
  imports: [
    FormsModule,
    NgClass,
    NgStyle,
    NgClickOutsideDirective,
    RouterLink,
    AvatarComponent,
    ManageAvatarComponent,
    LucideAngularModule,
    SharedLucideIconsModule,
    TuiBadgedContentComponent,
    TuiBadgeNotification,
    ShortRelativeTimePipe,
    ButtonComponent,
    OverlayscrollbarsModule,
    TuiDropdownDirective,
    TuiDropdownContext,
    TuiDataListComponent,
    TuiDataListDropdownManager,
    TuiActiveZone,
    AvatarPreviewComponent,
    TimerComponent,
    TuiOption,
  ]
})
export class NavbarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private userInfoService = inject(UserInfoService);
  private targetLanguageDropdownService = inject(TargetLanguageDropdownService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private viewportService = inject(ViewportService);
  private chatUnreadService = inject(ChatUnreadService);
  private notificationService = inject(NotificationService);
  private firebaseNotificationService = inject(FirebaseNotificationService);
  private alertService = inject(TuiNotificationService);
  private localStorageService = inject(LocalStorageService);
  private languageNameService = inject(LanguageNameService);

  private readonly destroy$ = new Subject<void>();

  @Input() currentRoute = '';
  @ViewChildren('dropdownItem') dropdownItems!: QueryList<ElementRef<HTMLButtonElement>>; // Get all dropdown buttons
  @ViewChild('langDropdown', {static: false}) langDropdown!: ElementRef<HTMLElement>; // Reference to the dropdown
  @ViewChild('languageSearchInput') languageSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild(ManageAvatarComponent, {static: false}) manageAvatarComponent!: ManageAvatarComponent;

  // Properties for toggling popovers and dropdowns
  protected isProfilePopoverOpen = false;
  protected isDiscoverMenuOpen = false;
  protected isLanguageDropdownOpen = false;
  protected isNotificationOpen = false;
  protected isTimerOpen = false;
  protected isMobile = false;

  // User info
  protected userInfo: UserInfo | null = null;

  // Language dropdown
  protected currentLanguage!: LanguageCode;
  protected focusedLangIndex = -1; // Index of the currently focused dropdown item
  protected filteredLanguages: LanguageCode[] = [];
  protected targetLanguages: LanguageCode[] = [];
  protected languageSearch = '';
  protected recentLanguages = this.localStorageService.getItem<LanguageCode[]>(RECENT_LANGUAGES_KEY) ?? [];
  protected showCrestHint = false;

  private langColors: Record<string, string> = {};

  protected uiPreferences: UIPreferences = DEFAULT_UI_PREFERENCES;

  // icons
  protected hasUnreadMessages = false;
  protected unreadNotificationsCount = 0;

  protected notifications: Notification[] = [];
  private readonly notificationGroupIds = new Map<string, string[]>();

  protected get hasLanguageChoices(): boolean {
    return this.targetLanguages.length > 1;
  }

  protected get usesSearchableLanguageMenu(): boolean {
    return this.targetLanguages.length > 8;
  }

  protected get stackLanguages(): LanguageCode[] {
    return this.targetLanguages.filter(language => language !== this.currentLanguage).slice(0, 2);
  }

  protected get displayedLanguages(): LanguageCode[] {
    if (!this.usesSearchableLanguageMenu) {
      return this.filteredLanguages;
    }

    const query = this.languageSearch.trim().toLocaleLowerCase();
    if (!query) return this.targetLanguages;

    return this.targetLanguages.filter(language =>
      language.toLocaleLowerCase().includes(query)
      || this.getLanguageName(language).toLocaleLowerCase().includes(query)
    );
  }

  protected get recentLanguageOptions(): LanguageCode[] {
    return [...new Set([...this.recentLanguages, ...this.targetLanguages])]
      .filter(language => language !== this.currentLanguage)
      .slice(0, 4);
  }

  protected get languageCrestLabel(): string {
    const languageName = this.getLanguageName(this.currentLanguage);
    return this.hasLanguageChoices
      ? `${languageName}, current learning language. Choose another language`
      : `${languageName}, current learning language`;
  }

  protected get shortcutModifier(): string {
    return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+';
  }

  get navbarItems() {
    return [
      {
        name: 'timer',
        enabled: this.uiPreferences.navbar.timer,
        icon: 'timer',
        hasUpdate: this.isTimerRunning(),
        action: () => this.toggleTimerPopover()
      },
      {
        name: 'social',
        enabled: this.uiPreferences.navbar.social,
        icon: 'message-circle',
        hasUpdate: this.hasUnreadMessages,
        action: () => this.router.navigate(['/social'])
      },
      {
        name: 'notifications',
        enabled: this.uiPreferences.navbar.notifications,
        icon: 'bell',
        hasUpdate: this.unreadNotificationsCount > 0,
        action: () => this.toggleNotificationPopover()
      }
    ];
  }

  ngOnInit(): void {
    this.initializeCrestHint();

    this.chatUnreadService.getUnreadCount().pipe(takeUntil(this.destroy$)).subscribe((count) => {
      this.hasUnreadMessages = count > 0;
      this.cdr.detectChanges();
    });

    this.targetLanguageDropdownService.langColors$
      .pipe(takeUntil(this.destroy$)) // depends on whether it's dynamic
      .subscribe((colors) => {
        this.langColors = colors;
      });

    this.targetLanguageDropdownService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((currentLanguage) => {
        this.currentLanguage = currentLanguage;
        this.cdr.markForCheck(); // Trigger UI update
      });

    this.targetLanguageDropdownService.filteredLanguages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((filteredLanguages) => {
        this.filteredLanguages = filteredLanguages;
        this.cdr.markForCheck();
      });

    this.targetLanguageDropdownService.targetLanguages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((targetLanguages) => {
        this.targetLanguages = targetLanguages;
        this.recentLanguages = this.recentLanguages.filter(language => targetLanguages.includes(language));
        this.cdr.markForCheck();
      });

    this.userInfoService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe((info) => {
        if (!info) return;
        this.userInfo = info;
        this.targetLanguageDropdownService.initializeLanguages(info);
        this.uiPreferences = {...info.uiPreferences};
      });

    this.viewportService.setCustomWidth(690);
    this.viewportService.isMobile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isMobile: boolean) => {
        this.isMobile = isMobile;
        this.cdr.detectChanges();
      });

    this.getNotifications();

    // Check notifications every 5 minutes (300000 ms)
    interval(300000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.getNotifications();
      });

    this.firebaseNotificationService.currentMessage$.pipe(takeUntil(this.destroy$)).subscribe((message) => {
      if (message) {
        this.getNotifications();
      }
    })
  }

  private getNotifications() {
    this.notificationService.getNotifications().pipe(takeUntil(this.destroy$)).subscribe((notifications) => {
      this.notifications = this.collapseNotifications(notifications);
      this.unreadNotificationsCount = this.notifications.filter(n => !n.readAt).length;
    });
  }

  private collapseNotifications(notifications: Notification[]): Notification[] {
    const groups = new Map<string, Notification[]>();

    for (const notification of notifications) {
      const key = `${notification.senderId}:${notification.type}`;
      groups.set(key, [...(groups.get(key) ?? []), notification]);
    }

    this.notificationGroupIds.clear();
    const collapsed = [...groups.values()].map(group => {
      const newest = [...group].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      this.notificationGroupIds.set(newest.id, group.map(notification => notification.id));
      return {...newest, readAt: group.every(notification => notification.readAt) ? newest.readAt : null};
    });

    return collapsed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // LANGUAGE DROPDOWN
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (!this.hasLanguageChoices || this.isEditableTarget(event.target)) return;

    const modifierPressed = event.metaKey || event.ctrlKey;
    if (modifierPressed && event.key.toLocaleLowerCase() === 'l') {
      event.preventDefault();
      this.openLanguageDropdown();
      return;
    }

    if (modifierPressed && /^[1-9]$/.test(event.key)) {
      const language = this.displayedLanguages[Number(event.key) - 1];
      if (language) {
        event.preventDefault();
        this.changeLanguage(language);
      }
    }
  }

  changeToNextLanguage(): void {
    if (!this.targetLanguages.length) return;
    const currentIndex = this.targetLanguages.indexOf(this.currentLanguage);
    const nextIndex = (currentIndex + 1) % this.targetLanguages.length;
    this.changeLanguage(this.targetLanguages[nextIndex]);
  }

  toggleLanguageDropdown(): void {
    if (!this.hasLanguageChoices) return;
    this.isLanguageDropdownOpen = !this.isLanguageDropdownOpen;
    if (this.isLanguageDropdownOpen) {
      this.focusDropdownEntry();
    } else {
      this.resetLanguageDropdown();
    }
  }

  private openLanguageDropdown(): void {
    this.isLanguageDropdownOpen = true;
    this.focusDropdownEntry();
  }

  private focusDropdownEntry(): void {
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.usesSearchableLanguageMenu) {
        this.languageSearchInput?.nativeElement.focus();
        this.focusedLangIndex = -1;
      } else {
        this.focusedLangIndex = 0;
        this.focusOnItem(0);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: MouseEvent): void {
    setTimeout(() => {
      if (this.isLanguageDropdownOpen && this.langDropdown && event.target instanceof Node && !this.langDropdown.nativeElement.contains(event.target)) {
        this.closeDropdown();
        this.cdr.detectChanges();
      }
    }, 50);
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.isLanguageDropdownOpen) {
      const languages = this.displayedLanguages;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (!languages.length) return;
          this.focusedLangIndex = (this.focusedLangIndex + 1) % languages.length;
          this.focusOnItem(this.focusedLangIndex);
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (!languages.length) return;
          this.focusedLangIndex = (this.focusedLangIndex - 1 + languages.length) % languages.length;
          this.focusOnItem(this.focusedLangIndex);
          break;
        case 'Enter':
          if (this.focusedLangIndex >= 0) {
            event.preventDefault();
            this.changeLanguage(languages[this.focusedLangIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          this.closeDropdown();
          break;
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openLanguageDropdown();
    }
  }

  focusOnItem(index: number): void {
    this.dropdownItems.toArray()[index]?.nativeElement.focus();
  }

  changeLanguage(lang: LanguageCode): void {
    if (!lang) return;
    const previousLanguage = this.currentLanguage;
    this.currentLanguage = lang;
    this.recentLanguages = [previousLanguage, lang, ...this.recentLanguages]
      .filter((language, index, languages) => language && languages.indexOf(language) === index)
      .slice(0, 4);
    this.localStorageService.saveItem(RECENT_LANGUAGES_KEY, this.recentLanguages);
    this.closeDropdown();
    this.targetLanguageDropdownService.setCurrentLanguage(lang);
  }

  protected getLanguageColor(language: string): string {
    return this.langColors[language] || '#7A6BB8';
  }

  protected getLanguageStyles(language: string): Record<string, string> {
    return {'--crest-color': this.getLanguageColor(language)};
  }

  protected getLanguageName(language: LanguageCode): string {
    return this.languageNameService.getLanguageName(language);
  }

  protected getLanguageLevel(language: LanguageCode): string | null {
    return this.userInfo?.learners.find(learner => learner.language === language)?.selfReportedLevel ?? null;
  }

  protected onLanguageSearchChange(): void {
    this.focusedLangIndex = -1;
  }

  protected openLanguageSettings(): void {
    this.closeDropdown();
    void this.router.navigate(['/settings/lang']);
  }

  closeDropdown(): void {
    this.isLanguageDropdownOpen = false;
    this.resetLanguageDropdown();
  }

  private resetLanguageDropdown(): void {
    this.focusedLangIndex = -1;
    this.languageSearch = '';
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  }

  private initializeCrestHint(): void {
    if (typeof window === 'undefined') return;

    try {
      if (window.sessionStorage.getItem(LANGUAGE_CREST_SESSION_KEY)) return;

      const sessionCount = this.localStorageService.getItem<number>(LANGUAGE_CREST_SESSIONS_KEY) ?? 0;
      this.showCrestHint = sessionCount < 2;
      this.localStorageService.saveItem(LANGUAGE_CREST_SESSIONS_KEY, sessionCount + 1);
      window.sessionStorage.setItem(LANGUAGE_CREST_SESSION_KEY, 'true');
    } catch {
      this.showCrestHint = false;
    }
  }

  langsOnClickOutside() {
    this.closeDropdown();
  }


  // POPOVERS
  profileOnClickOutside() {
    this.isProfilePopoverOpen = false;
  }

  discoverOnClickOutside() {
    this.isDiscoverMenuOpen = false;
  }

  notificationOnClickOutside() {
    if (!this.notificationDropdownActive && !this.userPreviewDropdownActive) {
      this.isNotificationOpen = false;
    }
  }

  timerOnClickOutside() {
    this.isTimerOpen = false;
  }

  onLogoClick(): void {
    if (this.isMobile) {
      this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
    } else {
      void this.router.navigate(['/home']).then();
    }
  }

  toggleProfilePopover(): void {
    this.isProfilePopoverOpen = !this.isProfilePopoverOpen;
    if (this.isProfilePopoverOpen) {
      this.isNotificationOpen = false;
    }
  }

  toggleNotificationPopover(): void {
    this.isNotificationOpen = !this.isNotificationOpen;
  }

  toggleTimerPopover(): void {
    this.isTimerOpen = !this.isTimerOpen;
  }

  openChangeAvatarPopup() {
    this.popupTemplateStateService.open(this.manageAvatarComponent.content, 'avatar');
  }

  // NOTIFICATIONS
  formatNotificationText(text: string | null): string {
    if (text === null) return '';
    const quietText = text.trim().replace(/[!]+(?=\s*$)/, '.');
    return quietText.replace(/(@\w+)/g, (match) => {
      const username = match.slice(1); // Remove the '@' symbol
      const url = `/users/${username}`;
      return `<a href="${url}" target="_blank"><strong>${match}</strong></a>`;
    });
  }

  protected notificationSummary(notification: Notification): string {
    const message = notification.message?.trim();
    return message
      ? this.formatNotificationText(message)
      : notification.title.replace(/[!]+(?=\s*$)/, '.');
  }

  onNotificationClick(notification: Notification) {
    this.isNotificationOpen = false;

    switch (notification.type) {
      case NotificationType.FRIENDSHIP_ACCEPTED:
        void this.router.navigate(['/social'], {queryParams: {tab: 'friends'}}).then();
        break;
      case NotificationType.FRIENDSHIP_REQUESTED:
        void this.router.navigate(['/social'], {queryParams: {requests: 'received'}}).then();
        break;
    }
    this.markNotificationAsRead(notification);
  }

  private markNotificationAsRead(notification: Notification) {
    this.loadingNotificationAction = true;
    const ids = this.notificationGroupIds.get(notification.id) ?? [notification.id];
    forkJoin(ids.map(id => this.notificationService.markAsRead(id)))
      .pipe(finalize(() => this.loadingNotificationAction = false))
      .subscribe({
        next: () => {
          notification.readAt = new Date();
          this.unreadNotificationsCount = this.notifications.filter(n => !n.readAt).length;
          this.sortNotifications();
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to mark notification as read'), {appearance: 'negative'}).subscribe();
        },
      });
  }

  private sortNotifications() {
    this.notifications.sort((a, b) => {
      // 1) Sort by unread first
      if (!a.readAt && b.readAt) return -1;
      if (a.readAt && !b.readAt) return 1;

      // 2) If both are either unread or read, sort by createdAt desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  protected notificationDropdownActive = false;
  protected userPreviewDropdownActive = false;

  togglePreviewDropdownActive($event: boolean) {
    this.userPreviewDropdownActive = $event;
  }

  toggleReadDropdownActive($event: boolean) {
    this.notificationDropdownActive = $event;
  }

  markAllAsRead() {
    this.loadingSubject$.next(true);

    this.notificationService.markAllAsRead()
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.notifications.map(n => n.readAt = new Date());
          this.unreadNotificationsCount = 0;
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to mark all as read'), {appearance: 'negative'}).subscribe();
        },
      });
  }

  protected loadingNotificationAction = false;

  toggleRead(notification: Notification, dropdown: TuiDropdownDirective) {
    if (!notification.readAt) {
      this.markNotificationAsRead(notification);
    } else {
      this.markAsUnread(notification, dropdown);
    }
  }

  private markAsUnread(notification: Notification, dropdown: TuiDropdownDirective) {
    this.loadingNotificationAction = true;
    this.notificationService.markAsUnread(notification.id)
      .pipe(finalize(() => this.loadingNotificationAction = false))
      .subscribe({
        next: () => {
          notification.readAt = null;
          this.unreadNotificationsCount++;
          dropdown.toggle(false);
          this.sortNotifications();
        },
        error: (error) => {
          this.alertService.open(getErrorMessage(error, 'Failed to mark as unread'), {appearance: 'negative'}).subscribe();
        },
      });
  }

  deleteNotification(notification: Notification, dropdown: TuiDropdownDirective) {
    const ids = this.notificationGroupIds.get(notification.id) ?? [notification.id];
    forkJoin(ids.map(id => this.notificationService.delete(id))).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        this.notificationGroupIds.delete(notification.id);
        if (!notification.readAt) {
          this.unreadNotificationsCount--;
        }
        dropdown.toggle(false);
      },
      error: (error) => {
        this.alertService.open(getErrorMessage(error, 'Failed to delete notification'), {appearance: 'negative'}).subscribe();
      }
    });
  }

  isTimerRunning(): boolean {
    const savedEndTime = this.localStorageService.getTimerEndTimestamp()
    if (!savedEndTime) return false;

    const now = Date.now();
    if (now < savedEndTime) {
      return true;
    } else {
      this.localStorageService.clearTimer();
      return false;
    }
  }
}
