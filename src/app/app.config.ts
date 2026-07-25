import {TUI_VALIDATION_ERRORS} from "@taiga-ui/core/tokens";
import {provideTaiga} from "@taiga-ui/core/utils";
import {
  ApplicationConfig,
  importProvidersFrom,
  isDevMode,
  provideAppInitializer,
  provideZoneChangeDetection
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {routes} from './app.routes';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getStorage, provideStorage} from '@angular/fire/storage';
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

const MY_CUSTOM_ERRORS = {
  required: 'Value is required',
  minlength: ({requiredLength, actualLength}: {requiredLength: number; actualLength: number}) =>
    `Too short: ${actualLength}/${requiredLength} characters`,
  maxlength: ({requiredLength, actualLength}: {requiredLength: number; actualLength: number}) =>
    `Too long: ${actualLength}/${requiredLength} characters`,
  usernameTaken: 'Username is already taken',
  serverError: 'Server error',
  unchanged: 'No changes',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    importProvidersFrom(TranslateModule.forRoot({defaultLanguage: EN_CODE})),

    provideRouter(routes),

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideStorage(() => getStorage()),
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
