import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  OnDestroy,
  OnInit,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgForOf, NgIf, NgOptimizedImage, NgStyle} from "@angular/common";
import {Router} from "@angular/router";
import {UserInfo} from "../../models/userinfo.model";
import {Language} from "../../models/language.enum";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {UserService} from "../../services/user.service";
import {Subscription} from "rxjs";
import {LanguageService} from "../../services/language.service";

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
    NgClickOutsideDirective
  ],
  standalone: true
})
export class NavbarComponent implements OnChanges, OnInit, OnDestroy {
  userInfo: UserInfo | null = null;
  @ViewChildren('dropdownItem') dropdownItems!: QueryList<ElementRef>; // Get all dropdown buttons
  @ViewChild('langDropdown', {static: false}) langDropdown!: ElementRef; // Reference to the dropdown
  protected isProfilePopoverOpen: boolean = false;
  protected isDiscoverMenuOpen: boolean = false;
  protected isLanguageDropdownOpen: boolean = false;
  protected isNotificationOpen: boolean = false;
  private userInfoSubscription: Subscription | null = null;
  isMobile: boolean = false;

  constructor(private router: Router,
              private cdr: ChangeDetectorRef,
              private userService: UserService,
              private languageService: LanguageService
  ) {
  }

  ngOnInit(): void {
    this.userInfoSubscription = this.userService.userInfo$.subscribe((info) => {
      this.userInfo = info;
      if (info) {
        this.initializeLanguages(info);
      }
    });
    this.checkDeviceType();
    window.addEventListener('resize', this.checkDeviceType.bind(this));
  }

  ngOnDestroy(): void {
    if (this.userInfoSubscription) {
      this.userInfoSubscription.unsubscribe();
    }

    window.removeEventListener('resize', this.checkDeviceType.bind(this));
  }

  private checkDeviceType(): void {
    this.isMobile = window.innerWidth <= 690; // Adjust breakpoint as needed
    this.cdr.detectChanges();
  }

  toggleDiscoverMenu(): void {
    if (this.isMobile) {
      this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
    } else {
      this.navigateToHome();
    }
  }

  toggleProfilePopover(): void {
    this.isProfilePopoverOpen = !this.isProfilePopoverOpen;
  }

  toggleNotificationPopover(): void {
    this.isNotificationOpen = !this.isNotificationOpen;
  }

  navigateToHome() {
    this.router.navigate(['/home']).then(r => r);
  }

  selectedLanguage!: Language;
  languages: Language[] = [];
  filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
  focusedIndex = -1; // Index of the currently focused dropdown item

  // Shortcut Listener for "Alt + A"
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.changeToNextLanguage();
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

  private initializeLanguages(userInfo: UserInfo | null): void {
    if (!userInfo) return;
    this.languageService.currentLanguage$.subscribe((storedLanguage) => {
      this.languages = userInfo.targetLangs;
      this.filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
      if (storedLanguage) {
        this.selectedLanguage = storedLanguage;
      } else if (userInfo.targetLangs && userInfo.targetLangs.length > 0) {
        this.selectedLanguage = userInfo.targetLangs[0];
        this.languageService.setCurrentLanguage(this.selectedLanguage); // Set default if none is stored
      } else {
        console.log('No target languages found in user info');
      }

      this.filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
      this.cdr.markForCheck();
    });
  }

  changeToNextLanguage(): void {
    const currentIndex = this.languages.indexOf(this.selectedLanguage);
    const nextIndex = (currentIndex + 1) % this.languages.length;
    this.changeLanguage(this.languages[nextIndex]);
  }

  toggleLanguageDropdown(): void {
    console.log('toggleDropdown');
    this.isLanguageDropdownOpen = !this.isLanguageDropdownOpen;
    console.log(this.isLanguageDropdownOpen)

    // If dropdown is opening, set focus to the first dropdown item
    if (this.isLanguageDropdownOpen) {
      this.cdr.detectChanges(); // Trigger change detection to ensure dropdown is rendered
      setTimeout(() => {
        this.focusedIndex = 0;
        this.focusOnItem(this.focusedIndex); // Focus the first item
      }, 0);
    } else {
      this.focusedIndex = -1; // Reset focus index when closed
    }
  }

  focusOnItem(index: number): void {
    const items = this.dropdownItems.toArray();
    if (items[index]) {
      items[index].nativeElement.focus(); // Set focus to the specific item
    }
  }

  changeLanguage(lang: Language): void {
    this.selectedLanguage = lang;
    this.filteredLanguages = this.languages.filter(language => language !== this.selectedLanguage);
    this.isLanguageDropdownOpen = false;
    this.focusedIndex = -1;
    this.languageService.setCurrentLanguage(lang);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userInfo'] && changes['userInfo'].currentValue) {
      this.selectedLanguage = this.userInfo?.targetLangs?.[0] || Language.EN;
      this.filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
      this.cdr.detectChanges();
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.isLanguageDropdownOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.focusedIndex = (this.focusedIndex + 1) % this.filteredLanguages.length; // Move down in the filtered list
          this.focusOnItem(this.focusedIndex);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.focusedIndex = (this.focusedIndex - 1 + this.filteredLanguages.length) % this.filteredLanguages.length; // Move up in the filtered list
          this.focusOnItem(this.focusedIndex);
          break;
        case 'Enter':
          event.preventDefault();
          this.selectLanguage(this.focusedIndex);
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
      this.focusedIndex = 0; // Focus the first item
      this.focusOnItem(this.focusedIndex); // Set focus to the first dropdown item
    }
  }

  selectLanguage(index: number): void {
    if (index >= 0 && index < this.filteredLanguages.length) {
      this.changeLanguage(this.filteredLanguages[index]);
    }
  }

  closeDropdown(): void {
    this.isLanguageDropdownOpen = false;
    this.focusedIndex = -1;
  }

  getButtonStyles(language: string): { color: string, border: string } {
    const colorMap: { [key: string]: string } = {
      'EN': '#402aa3',
      'DE': '#bcbf53',
      'FR': '#a11d1d'
    };

    const color = colorMap[language] || 'black';
    return {color: color, border: `1px solid ${color}`};
  }

  getButtonStylesDropDown(language: string): { color: string, border: string } {
    const colorMap: { [key: string]: string } = {
      'EN': '#8fa1c1',
      'DE': '#c1b88f',
      'FR': '#c18f8f'
    };

    const color = colorMap[language] || 'black';
    return {color: color, border: `1px solid ${color}`};
  }

  langsOnClickOutside(_: Event) {
    this.closeDropdown();
  }

  profileOnClickOutside(_: Event) {
    this.isProfilePopoverOpen = false;
  }

  discoverOnClickOutside(_: Event) {
    this.isDiscoverMenuOpen = false;
  }

  notificationOnClickOutside(_: Event) {
    this.isNotificationOpen = false;
  }
}
