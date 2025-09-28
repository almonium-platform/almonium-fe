// xsrf-interceptor.ts
import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from "../../../environments/environment";

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class XsrfInterceptor implements HttpInterceptor {
  private apiHost = (() => {
    try {
      return new URL(environment.apiUrl).host;
    } catch {
      return '';
    }
  })();

  private isApi(url: string, origin: string): boolean {
    let u: URL;
    try {
      u = new URL(url, origin);
    } catch {
      return url.startsWith('/api/');
    }
    const host = u.host;
    return (
      u.pathname.startsWith('/api/') ||          // proxied same-origin
      host === this.apiHost ||                   // env-configured API
      host === new URL(origin).host ||           // same-origin absolute
      host.endsWith('.api.almonium.com')         // any staging/prod API subdomain
    );
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!MUTATING.has(req.method)) return next.handle(req);

    const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    if (!this.isApi(req.url, origin)) return next.handle(req);

    const token = document.cookie.split('; ')
      .find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];

    const withCreds = req.withCredentials ? req : req.clone({withCredentials: true});
    if (!token) return next.handle(withCreds);

    return next.handle(withCreds.clone({
      setHeaders: {'X-XSRF-TOKEN': decodeURIComponent(token), 'ngsw-bypass': 'true'}
    }));
  }
}
