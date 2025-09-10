import {
  APP_INITIALIZER,
  ApplicationConfig,
  importProvidersFrom,
  isDevMode,
  provideZoneChangeDetection
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {TokenInterceptor} from './authentication/auth/token-interceptor';

import {TUI_VALIDATION_ERRORS} from '@taiga-ui/kit';
import {routes} from './app.routes';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getStorage, provideStorage} from '@angular/fire/storage';
import {environment} from '../environments/environment';
import {TranslateModule} from "@ngx-translate/core";
import {EN_CODE} from "./sections/social/i18n";
import {provideMessaging} from "@angular/fire/messaging";
import {getMessaging} from "firebase/messaging";
import {provideServiceWorker} from '@angular/service-worker';
import {provideEventPlugins} from "@taiga-ui/event-plugins";
import {XsrfInterceptor} from "./authentication/auth/xsrf-interceptor";
import {csrfInitFactory} from "../../csrf-app-initializer";
import {UserInfoService} from "./services/user-info.service";

const MY_CUSTOM_ERRORS = {
  required: 'Value is required',
  minlength: ({requiredLength, actualLength}: any) =>
    `Too short: ${actualLength}/${requiredLength} characters`,
  maxlength: ({requiredLength, actualLength}: any) =>
    `Too long: ${actualLength}/${requiredLength} characters`,
  usernameTaken: 'Username is already taken',
  serverError: 'Server error',
  unchanged: 'No changes',
};

export function initializeUserFactory(userInfoService: UserInfoService): () => Promise<any> {
  const hasSessionCookie = document.cookie.includes('accessToken=');

  if (hasSessionCookie) {
    // Return a function that returns a Promise
    return () => new Promise(resolve => {
      userInfoService.fetchUserInfoFromServer().subscribe({
        complete: () => resolve(true), // Resolve regardless of success/fail
        error: () => resolve(true)
      });
    });
  } else {
    // No session, resolve immediately.
    return () => Promise.resolve();
  }
}


export const appConfig: ApplicationConfig = {
  providers: [
    // Stream Chat
    provideZoneChangeDetection({eventCoalescing: true}),
    importProvidersFrom(TranslateModule.forRoot({
      defaultLanguage: EN_CODE,
    })),

    provideRouter(routes),

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideStorage(() => getStorage()),
    provideMessaging(() => getMessaging()),

    // HTTP interceptors
    provideHttpClient(withInterceptorsFromDi()),
    {provide: APP_INITIALIZER, useFactory: csrfInitFactory, multi: true},
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUserFactory,
      deps: [UserInfoService],
      multi: true,
    },
    {provide: HTTP_INTERCEPTORS, useClass: XsrfInterceptor, multi: true},
    provideEventPlugins(),
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: MY_CUSTOM_ERRORS,
    }, provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
};
