import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export async function csrfInitializer(
  url = 'http://localhost:9998/api/v1/public/csrf/token'
): Promise<void> {
  const http = inject(HttpClient);

  await lastValueFrom(
    http.get(url, {
      withCredentials: true,
      responseType: 'text' as 'json',
    }).pipe(catchError(() => of(null)))
  );
}
