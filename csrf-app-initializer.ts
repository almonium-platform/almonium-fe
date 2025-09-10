// csrf-app-initializer.ts
import {inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {lastValueFrom, of} from 'rxjs';
import {catchError} from 'rxjs/operators';

export function csrfInitFactory(url = 'http://localhost:9998/api/v1/public/csrf/token') {
  const http = inject(HttpClient);
  return () => lastValueFrom(
    http.get(url, {
      withCredentials: true,
      responseType: 'text' as 'json' // avoid JSON parse if it returns plain text
    }).pipe(catchError(() => of(null)))  // don't block app on error
  ).then(() => void 0);
}
