import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgStyle} from "@angular/common";
import {Router, RouterLink} from "@angular/router";
import {DEFAULT_UI_PREFERENCES, UIPreferences, UserInfo} from "../../../models/userinfo.model";
import {LanguageCode} from "../../../models/language.enum";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {UserInfoService} from "../../../services/user-info.service";
import {BehaviorSubject, finalize, interval, Subject, takeUntil} from "rxjs";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {AvatarComponent} from "../../avatar/avatar.component";
import {PopupTemplateStateService} from "../../modals/popup-template/popup-template-state.service";
import {ManageAvatarComponent} from "../../../sections/settings/profile/avatar/manage-avatar/manage-avatar.component";
import {LucideAngularModule} from "lucide-angular";
import {ViewportService} from "../../../services/viewport.service";
import {GifPlayerComponent} from "../../gif-player/gif-player.component";
import {SharedLucideIconsModule} from "../../shared-lucide-icons.module";
import {TuiBadgedContentComponent, TuiBadgeNotification, TuiDataListDropdownManager} from "@taiga-ui/kit";
import {ChatUnreadService} from "../../../sections/social/chat-unread.service";
import {NotificationService} from "../../notification/notification.service";
import {Notification, NotificationType} from "../../notification/notification.model";
import {
  TuiAlertService,
  TuiDataListComponent,
  TuiDropdownContext,
  TuiDropdownDirective,
  TuiOption
} from "@taiga-ui/core";
import {ShortRelativeTimePipe} from "./short-relative-time.pipe";
import {ButtonComponent} from "../../button/button.component";
import {OverlayscrollbarsModule} from "overlayscrollbars-ngx";
import {TuiActiveZone} from "@taiga-ui/cdk";
import {FirebaseNotificationService} from "../../../services/firebase-notification.service";
import {AvatarPreviewComponent} from "../../avatar/avatar-preview/avatar-preview.component";
import {TimerComponent} from "./timer/timer.component";
import {LocalStorageService} from "../../../services/local-storage.service";

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
    GifPlayerComponent,
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
    TuiOption,
    TuiActiveZone,
    AvatarPreviewComponent,
    TimerComponent,
  ]
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @Input() currentRoute: string = '';
  @ViewChildren('dropdownItem') dropdownItems!: QueryList<ElementRef>; // Get all dropdown buttons
  @ViewChild('langDropdown', {static: false}) langDropdown!: ElementRef; // Reference to the dropdown
  @ViewChild(ManageAvatarComponent, {static: false}) manageAvatarComponent!: ManageAvatarComponent;

  // Properties for toggling popovers and dropdowns
  protected isProfilePopoverOpen: boolean = false;
  protected isDiscoverMenuOpen: boolean = false;
  protected isLanguageDropdownOpen: boolean = false;
  protected isNotificationOpen: boolean = false;
  protected isTimerOpen: boolean = false;
  protected isMobile: boolean = false;

  // User info
  protected userInfo: UserInfo | null = null;

  // Language dropdown
  protected currentLanguage!: LanguageCode;
  protected focusedLangIndex = -1; // Index of the currently focused dropdown item
  protected filteredLanguages: LanguageCode[] = [];
  private targetLanguages: LanguageCode[] = [];

  private langColors: { [key: string]: string } = {};

  protected replayGifSubject = new Subject<void>();

  protected uiPreferences: UIPreferences = DEFAULT_UI_PREFERENCES;

  // icons
  protected hasUnreadMessages = false;
  protected unreadNotificationsCount = 0;

  protected notifications: Notification[] = [];

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

  constructor(private router: Router,
              private cdr: ChangeDetectorRef,
              private userInfoService: UserInfoService,
              private targetLanguageDropdownService: TargetLanguageDropdownService,
              private popupTemplateStateService: PopupTemplateStateService,
              private viewportService: ViewportService,
              private chatUnreadService: ChatUnreadService,
              private notificationService: NotificationService,
              private firebaseNotificationService: FirebaseNotificationService,
              private alertService: TuiAlertService,
              private localStorageService: LocalStorageService,
  ) {
  }

  ngOnInit(): void {
    this.chatUnreadService.getUnreadCount().subscribe((count) => {
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

    this.firebaseNotificationService.currentMessage$.subscribe((message) => {
      if (message) {
        this.getNotifications();
      }
    })
  }

  private getNotifications() {
    this.notificationService.getNotifications().subscribe((notifications) => {
      this.notifications = notifications;
      this.unreadNotificationsCount = notifications.filter(n => !n.readAt).length;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // LANGUAGE DROPDOWN
  // Shortcut Listener for "Alt + A"
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'j') {
      event.preventDefault();
      this.changeToNextLanguage();
    }
  }

  changeToNextLanguage(): void {
    const currentIndex = this.targetLanguages.indexOf(this.currentLanguage);
    const nextIndex = (currentIndex + 1) % this.targetLanguages.length;
    this.changeLanguage(this.targetLanguages[nextIndex]);
  }

  toggleLanguageDropdown(): void {
    this.isLanguageDropdownOpen = !this.isLanguageDropdownOpen;

    // If dropdown is opening, set focus to the first dropdown item
    if (this.isLanguageDropdownOpen) {
      this.cdr.detectChanges(); // Trigger change detection to ensure dropdown is rendered
      setTimeout(() => {
        this.focusedLangIndex = 0;
        this.focusOnItem(this.focusedLangIndex); // Focus the first item
      }, 0);
    } else {
      this.focusedLangIndex = -1; // Reset focus index when closed
    }
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: MouseEvent): void {
    // Use a small timeout to ensure dropdown click is not detected as outside click
    setTimeout(() => {
      if (this.isLanguageDropdownOpen && this.langDropdown && !this.langDropdown.nativeElement.contains(event.target)) {
        this.isLanguageDropdownOpen = false; // Close dropdown if clicked outside
        this.cdr.detectChanges(); // Trigger change detection to update the view
      }
    }, 50);
  }

  // Keyboard navigation for dropdown
  handleKeydown(event: KeyboardEvent): void {
    if (this.isLanguageDropdownOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.focusedLangIndex = (this.focusedLangIndex + 1) % this.filteredLanguages.length; // Move down in the filtered list
          this.focusOnItem(this.focusedLangIndex);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.focusedLangIndex = (this.focusedLangIndex - 1 + this.filteredLanguages.length) % this.filteredLanguages.length; // Move up in the filtered list
          this.focusOnItem(this.focusedLangIndex);
          break;
        case 'Enter':
          event.preventDefault();
          this.selectLanguage(this.focusedLangIndex);
          break;
        case 'Escape':
          event.preventDefault();
          this.closeDropdown();
          break;
      }
    } else if (event.key === 'ArrowDown') {
      // Open dropdown and directly focus on the first dropdown item when pressing ArrowDown on the main button
      event.preventDefault();
      this.isLanguageDropdownOpen = true; // Open the dropdown
      this.cdr.detectChanges(); // Ensure the dropdown items are rendered
      this.focusedLangIndex = 0; // Focus the first item
      this.focusOnItem(this.focusedLangIndex); // Set focus to the first dropdown item
    }
  }

  focusOnItem(index: number): void {
    const items = this.dropdownItems.toArray();
    if (items[index]) {
      items[index].nativeElement.focus(); // Set focus to the specific item
    }
  }

  changeLanguage(lang: LanguageCode): void {
    this.currentLanguage = lang;
    this.isLanguageDropdownOpen = false;
    this.focusedLangIndex = -1;
    this.targetLanguageDropdownService.setCurrentLanguage(lang);
  }

  // dynamic styles
  getButtonStyles(language: string): { color: string, border: string } {
    const color = this.langColors[language] || 'var(--purple-dark)';
    return {color: color, border: `1px solid ${color}`};
  }

  getButtonStylesDropDown(language: string): { color: string, border: string } {
    let color = this.langColors[language];
    color = color ? this.dullColor(color, 0.5) : 'var(--lavender)';
    return {color: color, border: `1px solid ${color}`};
  }

  private dullColor(hex: string, amount: number): string {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.min(255, Math.floor(r + (255 - r) * amount));
    g = Math.min(255, Math.floor(g + (255 - g) * amount));
    b = Math.min(255, Math.floor(b + (255 - b) * amount));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // Handling popovers and dropdowns
  selectLanguage(index: number): void {
    if (index >= 0 && index < this.filteredLanguages.length) {
      this.changeLanguage(this.filteredLanguages[index]);
    }
  }

  closeDropdown(): void {
    this.isLanguageDropdownOpen = false;
    this.focusedLangIndex = -1;
  }

  langsOnClickOutside(_: Event) {
    this.closeDropdown();
  }


  // POPOVERS
  profileOnClickOutside(_: Event) {
    this.isProfilePopoverOpen = false;
  }

  discoverOnClickOutside(_: Event) {
    this.isDiscoverMenuOpen = false;
  }

  notificationOnClickOutside(_: Event) {
    if (!this.notificationDropdownActive && !this.userPreviewDropdownActive) {
      this.isNotificationOpen = false;
    }
  }

  timerOnClickOutside(_: Event) {
    this.isTimerOpen = false;
  }

  onLogoClick(): void {
    this.replayGifSubject.next();

    if (this.isMobile) {
      this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
    } else {
      this.router.navigate(['/home']).then();
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
    return text.replace(/(@\w+)/g, (match) => {
      const username = match.slice(1); // Remove the '@' symbol
      const url = `/users/${username}`;
      return `<a href="${url}" target="_blank"><strong>${match}</strong></a>`;
    });
  }

  onNotificationClick(notification: Notification) {
    this.isNotificationOpen = false;

    switch (notification.type) {
      case NotificationType.FRIENDSHIP_ACCEPTED:
        this.router.navigate(['/social'], {queryParams: {tab: 'friends'}}).then();
        break;
      case NotificationType.FRIENDSHIP_REQUESTED:
        this.router.navigate(['/social'], {queryParams: {requests: 'received'}}).then();
        break;
    }
    this.markNotificationAsRead(notification);
  }

  private markNotificationAsRead(notification: Notification) {
    this.loadingNotificationAction = true;
    this.notificationService.markAsRead(notification.id)
      .pipe(finalize(() => this.loadingNotificationAction = false))
      .subscribe({
        next: () => {
          notification.readAt = new Date();
          this.unreadNotificationsCount = this.notifications.filter(n => !n.readAt).length;
          this.sortNotifications();
        },
        error: (error) => {
          this.alertService.open(error.error.message || 'Failed to link local account', {appearance: 'error'}).subscribe();
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

  protected notificationDropdownActive: boolean = false;
  protected userPreviewDropdownActive: boolean = false;

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
          this.alertService.open(error.error.message || 'Failed to mark all as read', {appearance: 'error'}).subscribe();
        },
      });
  }

  protected loadingNotificationAction: boolean = false;

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
          this.alertService.open(error.error.message || 'Failed to mark as unread', {appearance: 'error'}).subscribe();
        },
      });
  }

  deleteNotification(notification: Notification, dropdown: TuiDropdownDirective) {
    this.notificationService.delete(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        if (!notification.readAt) {
          this.unreadNotificationsCount--;
        }
        dropdown.toggle(false);
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to delete notification', {appearance: 'error'}).subscribe();
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
