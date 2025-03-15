import {NgDompurifySanitizer, SANITIZE_STYLE} from "@taiga-ui/dompurify";
import {TuiAlertService, TuiRoot} from "@taiga-ui/core";
import {Component} from '@angular/core';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {PopupTemplateComponent} from "./shared/modals/popup-template/popup-template.component";
import {NavbarWrapperComponent} from "./shared/navbars/navbar-wrapper/navbar-wrapper.component";
import {UrlService} from "./services/url.service";
import {StreamI18nService} from "stream-chat-angular";
import {EN_CODE, STREAM_CHAT_TRANSLATIONS} from "./sections/social/i18n";
import {FirebaseNotificationService} from "./services/firebase-notification.service";
import {filter} from "rxjs";
import {TimerMonitorService} from "./shared/navbars/navbar/timer/timer-monitor.service";

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
    '/users'
  ];

  private noNavbarOnMobileRoutes: string[] = [
    '/social',
  ];

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
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const clearedUrl = this.urlService.getClearedUrl();
        const isMobile = window.innerWidth <= 640;

        // Hide navbar if route matches or starts with excluded paths
        this.showNavbar = !(
          this.noNavbarRoutes.some(route => clearedUrl.startsWith(route)) ||
          (isMobile && this.noNavbarOnMobileRoutes.includes(clearedUrl))
        );
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
