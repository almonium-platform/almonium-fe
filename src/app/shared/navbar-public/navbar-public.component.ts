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
import {NavigationEnd, Router} from "@angular/router";
import {UserInfo} from "../../models/userinfo.model";
import {Language} from "../../models/language.enum";
import {NgClickOutsideDirective} from 'ng-click-outside2';
import {UserService} from "../../services/user.service";
import {Subscription} from "rxjs";
import {LanguageService} from "../../services/language.service";

@Component({
  selector: 'app-public-navbar',
  templateUrl: './navbar-public.component.html',
  styleUrls: ['./navbar-public.component.less'],
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
export class NavbarPublicComponent implements OnChanges, OnInit, OnDestroy {
  userInfo: UserInfo | null = null;
  @ViewChildren('dropdownItem') dropdownItems!: QueryList<ElementRef>; // Get all dropdown buttons
  @ViewChild('langDropdown', {static: false}) langDropdown!: ElementRef; // Reference to the dropdown
  protected isProfilePopoverOpen: boolean = false;
  protected isDiscoverMenuOpen: boolean = false;
  protected isLanguageDropdownOpen: boolean = false;
  protected isNotificationOpen: boolean = false;
  private userInfoSubscription: Subscription | null = null;
  isMobile: boolean = false;
  currentRoute: string = '';

  constructor(private router: Router,
              private cdr: ChangeDetectorRef,
              private userService: UserService,
              private languageService: LanguageService
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects;
      }
    });
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

  discoverOnClickOutside(_: Event) {
    this.isDiscoverMenuOpen = false;
  }
}
