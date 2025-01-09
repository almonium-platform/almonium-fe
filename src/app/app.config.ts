import {ApplicationConfig} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideAnimations} from '@angular/platform-browser/animations';
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {TokenInterceptor} from './authentication/auth/token-interceptor';

import {TUI_VALIDATION_ERRORS} from '@taiga-ui/kit';
import {NG_EVENT_PLUGINS} from '@taiga-ui/event-plugins';

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

import {routes} from './app.routes';
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getStorage, provideStorage} from '@angular/fire/storage';
import {environment} from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(routes),

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideStorage(() => getStorage()),

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
    },
  ],
};
