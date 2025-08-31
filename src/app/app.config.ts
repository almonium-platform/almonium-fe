import {ApplicationConfig, importProvidersFrom, isDevMode, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {TokenInterceptor} from './authentication/auth/token-interceptor';

import {TUI_VALIDATION_ERRORS} from '@taiga-ui/kit';
import {NG_EVENT_PLUGINS} from '@taiga-ui/event-plugins';
import {routes} from './app.routes';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getStorage, provideStorage} from '@angular/fire/storage';
import {environment} from '../environments/environment';
import {TranslateModule} from "@ngx-translate/core";
import {EN_CODE} from "./sections/social/i18n";
import {provideMessaging} from "@angular/fire/messaging";
import {getMessaging} from "firebase/messaging";
import {provideServiceWorker} from '@angular/service-worker';

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
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true,
    },
    NG_EVENT_PLUGINS,
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: MY_CUSTOM_ERRORS,
    }, provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
};
