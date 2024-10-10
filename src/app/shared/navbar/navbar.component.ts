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
  ViewChildren
} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass, NgForOf, NgIf, NgOptimizedImage, NgStyle} from "@angular/common";
import {Router} from "@angular/router";
import {UserInfo} from "../../home/userinfo.model";
import {LocalStorageService} from "../../services/local.storage.service";
import {Language} from "../../services/language.enum";
import {AuthService} from "../../auth/auth.service";

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
    NgStyle
  ],
  standalone: true
})
export class NavbarComponent implements OnChanges, OnInit, OnDestroy {
  userInfo: UserInfo | null = null;
  @ViewChildren('dropdownItem') dropdownItems!: QueryList<ElementRef>; // Get all dropdown buttons
  protected isPopoverOpen: boolean = false;

  constructor(private router: Router,
              private cdr: ChangeDetectorRef,
              private localStorageService: LocalStorageService,
              private authService: AuthService
  ) {
  }

  isMobile: boolean = false;

  ngOnInit(): void {
    this.loadUserInfo();
    this.checkDeviceType();
    window.addEventListener('resize', this.checkDeviceType.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.checkDeviceType.bind(this));
  }

  private checkDeviceType(): void {
    this.isMobile = window.innerWidth <= 690; // Adjust breakpoint as needed
    this.cdr.detectChanges();
  }

  isDiscoverMenuOpen: boolean = false; // Track the Discover menu state

  toggleDiscoverMenu(): void {
    if (this.isMobile) {
      this.isDiscoverMenuOpen = !this.isDiscoverMenuOpen;
    } else {
      this.navigateToHome();
    }
  }

  private loadUserInfo(): void {
    const cachedUserInfo = this.localStorageService.getUserInfo();

    if (cachedUserInfo) {
      this.userInfo = cachedUserInfo;
      console.log('Loaded user info from cache', this.userInfo);
      this.selectedLanguage = this.userInfo?.targetLangs?.[0] || Language.EN;
      this.filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
      this.cdr.markForCheck();
    } else {
      console.log('Loading user info from server');
      this.authService.getUserInfo().subscribe({
        next: (userInfo: UserInfo) => {
          this.userInfo = userInfo;
          this.localStorageService.saveUserInfo(userInfo); // Cache the user info
          this.selectedLanguage = userInfo.targetLangs?.[0] || Language.EN;
          this.filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.log('Failed to load user info', error);
        },
      });
    }
  }

  navigateToHome() {
    this.router.navigate(['/home']).then(r => r);
  }

  isOpen = false;
  selectedLanguage = Language.EN;
  languages = [Language.EN, Language.DE, Language.FR];
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

  changeToNextLanguage(): void {
    const currentIndex = this.languages.indexOf(this.selectedLanguage);
    const nextIndex = (currentIndex + 1) % this.languages.length;
    this.changeLanguage(this.languages[nextIndex]);
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;

    // If dropdown is opening, set focus to the first dropdown item
    if (this.isOpen) {
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
    this.isOpen = false;
    this.focusedIndex = -1;
    this.localStorageService.saveCurrentLanguage(lang);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userInfo'] && changes['userInfo'].currentValue) {
      this.selectedLanguage = this.userInfo?.targetLangs?.[0] || Language.EN;
      this.filteredLanguages = this.languages.filter(lang => lang !== this.selectedLanguage);
      this.cdr.detectChanges();
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.isOpen) {
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
      this.isOpen = true; // Open the dropdown
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
    this.isOpen = false;
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

  togglePopover(): void {
    this.isPopoverOpen = !this.isPopoverOpen;
  }
}
