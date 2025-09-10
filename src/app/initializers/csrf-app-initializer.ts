import {inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {lastValueFrom, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {environment} from "../../environments/environment";

export async function csrfInitializer(): Promise<void> {
  const http = inject(HttpClient);

  const url = `${environment.apiUrl}/api/v1/public/csrf/token`;

  await lastValueFrom(
    http.get(url, {
      withCredentials: true,
      responseType: 'text' as 'json',
    }).pipe(catchError(() => of(null)))
  );
}
