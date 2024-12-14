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
import {NgClass, NgForOf, NgIf, NgOptimizedImage, NgStyle} from "@angular/common";
import {Router, RouterLink} from "@angular/router";
import {UserInfo} from "../../../models/userinfo.model";
import {LanguageCode} from "../../../models/language.enum";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {UserInfoService} from "../../../services/user-info.service";
import {Subscription} from "rxjs";
import {TargetLanguageDropdownService} from "../../../services/target-language-dropdown.service";
import {ProfilePictureComponent} from "../../avatar/profile-picture.component";
import {PopupTemplateStateService} from "../../modals/popup-template/popup-template-state.service";
import {ManageAvatarComponent} from "../../../sections/settings/profile/avatar/manage-avatar/manage-avatar.component";

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.less'],
  imports: [
    FormsModule,
    NgForOf,
    NgOptimizedImage,
    NgIf,
    NgClass,
    NgStyle,
    NgClickOutsideDirective,
    RouterLink,
    ProfilePictureComponent,
    ManageAvatarComponent
  ]
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() currentRoute: string = '';
  @ViewChildren('dropdownItem') dropdownItems!: QueryList<ElementRef>; // Get all dropdown buttons
  @ViewChild('langDropdown', {static: false}) langDropdown!: ElementRef; // Reference to the dropdown
  @ViewChild(ManageAvatarComponent, {static: true}) manageAvatarComponent!: ManageAvatarComponent;

  // Properties for toggling popovers and dropdowns
  protected isProfilePopoverOpen: boolean = false;
  protected isDiscoverMenuOpen: boolean = false;
  protected isLanguageDropdownOpen: boolean = false;
  protected isNotificationOpen: boolean = false;
  protected isMobile: boolean = false;

  // User info
  protected userInfo: UserInfo | null = null;

  // Language dropdown
  protected currentLanguage!: LanguageCode;
  protected focusedLangIndex = -1; // Index of the currently focused dropdown item
  protected filteredLanguages: LanguageCode[] = [];
  private targetLanguages: LanguageCode[] = [];
  private subscriptions: Subscription[] = [];

  private langColors: { [key: string]: string } = {};

  constructor(private router: Router,
              private cdr: ChangeDetectorRef,
              private userService: UserInfoService,
              private targetLanguageDropdownService: TargetLanguageDropdownService,
              private popupTemplateStateService: PopupTemplateStateService,
  ) {
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.targetLanguageDropdownService.langColors$.subscribe((colors) => {
        this.langColors = colors;
      })
    );

    this.subscriptions.push(
      this.targetLanguageDropdownService.currentLanguage$.subscribe((currentLanguage) => {
        this.currentLanguage = currentLanguage;
        this.cdr.markForCheck(); // Trigger UI update
      })
    );

    this.subscriptions.push(
      this.targetLanguageDropdownService.filteredLanguages$.subscribe((filteredLanguages) => {
        this.filteredLanguages = filteredLanguages;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.push(
      this.targetLanguageDropdownService.targetLanguages$.subscribe((targetLanguages) => {
        this.targetLanguages = targetLanguages;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.push(
      this.userService.userInfo$.subscribe((info) => {
        if (info) {
          this.userInfo = info;
          this.targetLanguageDropdownService.initializeLanguages(info);
        }
      })
    );
    this.checkDeviceType();
    window.addEventListener('resize', this.checkDeviceType.bind(this));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    window.removeEventListener('resize', this.checkDeviceType.bind(this));
  }

  private checkDeviceType(): void {
    this.isMobile = window.innerWidth <= 690; // Adjust breakpoint as needed
    this.cdr.detectChanges();
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
    const color = this.langColors[language] || 'black';
    return {color: color, border: `1px solid ${color}`};
  }

  getButtonStylesDropDown(language: string): { color: string, border: string } {
    let color = this.langColors[language] || 'black';
    color = this.dullColor(color, 0.5);
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
    this.isNotificationOpen = false;
  }

  toggleDiscoverMenu(): void {
    if (this.isMobile) {
      this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
    } else {
      this.router.navigate(['/home']).then(r => r);
    }
  }

  toggleProfilePopover(): void {
    this.isProfilePopoverOpen = !this.isProfilePopoverOpen;
  }

  toggleNotificationPopover(): void {
    this.isNotificationOpen = !this.isNotificationOpen;
  }

  openChangeAvatarPopup() {
    this.popupTemplateStateService.open(this.manageAvatarComponent.content);
  }
}
