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
  ];

  constructor(
    private router: Router,
    private urlService: UrlService,
    private streamI18nService: StreamI18nService,
    private firebaseNotificationService: FirebaseNotificationService,
    private alertService: TuiAlertService
  ) {
    this.initializeTranslations();
    this.listenForPushNotifications();
    this.listenToRouter();
  }

  private listenToRouter() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const clearedUrl = this.urlService.getClearedUrl();
        this.showNavbar = !this.noNavbarRoutes.includes(clearedUrl);
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
        console.log("Received push notification:", message);
        this.alertService.open(message?.notification?.body ?? "New Notification", {appearance: "neutral"}).subscribe();
      });
  }
}
