import {NgDompurifySanitizer, SANITIZE_STYLE} from "@taiga-ui/dompurify";
import {TuiAlertService, TuiRoot} from "@taiga-ui/core";
import {Component} from '@angular/core'; // Import OnInit if not already there
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

// Declare gtag function to make TypeScript aware of it globally
declare var gtag: Function;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, PopupTemplateComponent, NavbarWrapperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less',
  providers: [{provide: SANITIZE_STYLE, useClass: NgDompurifySanitizer}]
})
export class AppComponent {
  title = 'almonium-fe';
  protected showNavbar: boolean = false;
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

  constructor(
    private router: Router,
    private urlService: UrlService,
    private streamI18nService: StreamI18nService,
    private firebaseNotificationService: FirebaseNotificationService,
    private alertService: TuiAlertService,
    private timerMonitorService: TimerMonitorService,
  ) {
    this.initializeTranslations();
    this.listenForPushNotifications();
    this.listenToRouter();
    this.timerMonitorService.startMonitoring();
  }

  private listenToRouter() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const navigationEvent = event as NavigationEnd;

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
      .pipe(filter((message) => !!message?.notification))
      .subscribe((message) => {
        this.alertService.open(message?.notification?.body ?? "New Notification", {appearance: "info"}).subscribe();
      });
  }
}
