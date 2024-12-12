import {NG_EVENT_PLUGINS} from "@taiga-ui/event-plugins";
import {provideAnimations} from "@angular/platform-browser/animations";
import {ApplicationConfig, importProvidersFrom} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {TokenInterceptor} from "./authentication/auth/token-interceptor";
import {HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi} from "@angular/common/http";
import {initializeApp, provideFirebaseApp} from '@angular/fire/app';
import {getStorage, provideStorage} from '@angular/fire/storage';
import {environment} from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideStorage(() => getStorage()),
    importProvidersFrom(),
    provideHttpClient(withInterceptorsFromDi()), {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true
    }, NG_EVENT_PLUGINS]
};
