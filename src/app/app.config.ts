import {TUI_VALIDATION_ERRORS} from "@taiga-ui/core/tokens";
import {provideTaiga} from "@taiga-ui/core/utils";
import {
  ApplicationConfig,
  importProvidersFrom,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection
} from '@angular/core';
import {provideRouter, withInMemoryScrolling} from '@angular/router';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {routes} from './app.routes';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {provideAuth} from '@angular/fire/auth';
import {getAuth} from 'firebase/auth';
import {environment} from '../environments/environment';
import {TranslateModule} from '@ngx-translate/core';
import {EN_CODE} from './sections/social/i18n';
import {provideMessaging} from '@angular/fire/messaging';
import {getMessaging} from 'firebase/messaging';
import {provideServiceWorker} from '@angular/service-worker';
import {XsrfInterceptor} from './authentication/auth/xsrf-interceptor';
import {csrfInitializer} from "./initializers/csrf-app-initializer";
import {initializeUser} from "./initializers/user-app-initializer";
import {SwBypassInterceptor} from "./authentication/auth/sw-bypass-interceptor";
import {HttpErrorInterceptor} from './shared/http-error.interceptor';
import {currentUiLocale} from './services/ui-locale';

const MY_CUSTOM_ERRORS = {
  required: $localize`Value is required`,
  minlength: ({requiredLength, actualLength}: {requiredLength: number; actualLength: number}) =>
    $localize`Too short: ${actualLength}:actual:/${requiredLength}:required: characters`,
  maxlength: ({requiredLength, actualLength}: {requiredLength: number; actualLength: number}) =>
    $localize`Too long: ${actualLength}:actual:/${requiredLength}:required: characters`,
  usernameTaken: $localize`Username is already taken`,
  serverError: $localize`Server error`,
  unchanged: $localize`No changes`,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    // Dates and numbers follow the interface language settled in main.ts.
    {provide: LOCALE_ID, useFactory: () => currentUiLocale().angularLocale},
    importProvidersFrom(TranslateModule.forRoot({defaultLanguage: EN_CODE})),

    provideRouter(routes, withInMemoryScrolling({anchorScrolling: 'enabled'})),

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideMessaging(() => getMessaging()),

    // HTTP interceptors
    provideHttpClient(withInterceptorsFromDi()),
    {provide: HTTP_INTERCEPTORS, useClass: XsrfInterceptor, multi: true},
    {provide: HTTP_INTERCEPTORS, useClass: SwBypassInterceptor, multi: true},
    {provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},

    // App initializers (new API)
    provideAppInitializer(csrfInitializer),
    provideAppInitializer(initializeUser),

    provideTaiga(),
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: MY_CUSTOM_ERRORS,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
