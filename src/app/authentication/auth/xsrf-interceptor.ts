// xsrf-interceptor.ts
import {Inject, Injectable, PLATFORM_ID} from '@angular/core';
import {DOCUMENT, isPlatformBrowser} from '@angular/common';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from "../../../environments/environment";

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getAllowedHosts(): Set<string> {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(environment.apiUrl).host);
  } catch {
    // ignore if apiUrl is relative or malformed
  }
  // Keep localhost for local dev
  if (!environment.production) hosts.add('localhost:9998');
  return hosts;
}

@Injectable()
export class XsrfInterceptor implements HttpInterceptor {
  private readonly isBrowser: boolean;
  private readonly allowedHosts = getAllowedHosts();

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private readCookie(name: string): string | null {
    if (!this.isBrowser) return null;
    const cookie = this.doc?.cookie ?? '';
    return cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.split('=')[1] ?? null;
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only consider mutating requests
    if (!MUTATING.has(req.method)) {
      return next.handle(req);
    }

    // Work out the host the request will hit (handles absolute/relative URLs)
    let host = '';
    try {
      host = new URL(req.url, this.isBrowser ? this.doc.location.origin : 'http://localhost').host;
    } catch {
      // If URL parsing fails, skip
      return next.handle(req);
    }

    // Only add XSRF for our API hosts
    if (!this.allowedHosts.has(host)) {
      return next.handle(req);
    }

    const token = this.readCookie('XSRF-TOKEN'); // or whatever cookie name your backend sets
    if (!token) {
      return next.handle(req);
    }

    const cloned = req.clone({
      setHeaders: {'X-XSRF-TOKEN': token},
      // withCredentials is often required for cookie-based CSRF; keep if you rely on cookies
      withCredentials: true,
    });

    return next.handle(cloned);
  }
}
