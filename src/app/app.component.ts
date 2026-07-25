import {NgDompurifySanitizer, SANITIZE_STYLE} from "@taiga-ui/dompurify";
import {TuiNotificationService, TuiRoot} from "@taiga-ui/core/components";
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {PopupTemplateComponent} from "./shared/modals/popup-template/popup-template.component";
import {NavbarWrapperComponent} from "./shared/navbars/navbar-wrapper/navbar-wrapper.component";
import {UrlService} from "./services/url.service";
import {StreamI18nService} from "stream-chat-angular";
import {EN_CODE, STREAM_CHAT_TRANSLATIONS} from "./sections/social/i18n";
import {FirebaseNotificationService} from "./services/firebase-notification.service";
import {filter} from "rxjs";
import {TimerMonitorService} from "./shared/navbars/navbar/timer/timer-monitor.service";
import {environment} from '../environments/environment'
import {distinctUntilChanged} from "rxjs/operators";
import {UserInfoService} from "./services/user-info.service";
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

// Declare gtag function to make TypeScript aware of it globally
declare const gtag: (command: 'config', measurementId: string, config: {page_path: string}) => void;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, PopupTemplateComponent, NavbarWrapperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less',
  providers: [{provide: SANITIZE_STYLE, useClass: NgDompurifySanitizer}]
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private urlService = inject(UrlService);
  private streamI18nService = inject(StreamI18nService);
  private firebaseNotificationService = inject(FirebaseNotificationService);
  private alertService = inject(TuiNotificationService);
  private timerMonitorService = inject(TimerMonitorService);
  private userInfoService = inject(UserInfoService);
  private destroyRef = inject(DestroyRef);

  title = 'almonium-fe';
  protected showNavbar = false;
  private noNavbarRoutes: string[] = [
    '/auth',
    '/login',
    '/logout',
    '/onboarding',
    '/reset-password',
    '/verify-email',
    '/change-email',
    '/payment/success',
    '/users',
    '/reader'
  ];

  private noNavbarOnMobileRoutes: string[] = [
    '/social',
  ];

  private measurementId = environment.googleAnalyticsId;

  constructor() {
    this.initializeTranslations();
    this.listenForPushNotifications();
    this.listenToRouter();
    this.timerMonitorService.startMonitoring();
    this.destroyRef.onDestroy(() => this.timerMonitorService.stopMonitoring());
  }

  ngOnInit(): void {
    this.userInfoService.userInfo$.pipe(
      distinctUntilChanged((prev, curr) => !!prev === !!curr),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(user => {
      if (user) {
        void this.firebaseNotificationService.initFCM().then();
      }
    });
  }

  private listenToRouter() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => {
      const navigationEvent = event;

      const clearedUrl = this.urlService.getClearedUrl();
      const isMobile = window.innerWidth <= 640;

      // Hide navbar if route matches or starts with excluded paths
      this.showNavbar = !(
        this.noNavbarRoutes.some(route => clearedUrl.startsWith(route)) ||
        (isMobile && this.noNavbarOnMobileRoutes.includes(clearedUrl))
      );

      // --- Google Analytics Integration ---
      // Check if gtag is defined (it should be loaded from index.html)
      if (typeof gtag === 'function') {
        // Send a page_view event to Google Analytics
        gtag('config', this.measurementId, { // Use the measurementId variable
          'page_path': navigationEvent.urlAfterRedirects // Send the final URL after redirects
        });
        console.log(`GA: Sent page_view for ${navigationEvent.urlAfterRedirects}`);
      } else {
        console.warn('GA: gtag function not found. Ensure GA script is loaded in index.html.');
      }
    });
  }

  private initializeTranslations(): void {
    this.streamI18nService.setTranslation(EN_CODE, STREAM_CHAT_TRANSLATIONS);
  }

  private listenForPushNotifications(): void {
    this.firebaseNotificationService.currentMessage$
      .pipe(
        filter((message) => !!message?.notification),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((message) => {
        this.alertService.open(message?.notification?.body ?? "New Notification", {appearance: "info"}).subscribe();
      });
  }
}
