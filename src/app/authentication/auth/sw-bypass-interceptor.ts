// sw-bypass.interceptor.ts
import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';

function apiHost(): string {
  try {
    return new URL(environment.apiUrl).host;
  } catch {
    return '';
  }
}

@Injectable()
export class SwBypassInterceptor implements HttpInterceptor {
  private readonly apiHost = apiHost();

  private isApi(url: string, origin: string): boolean {
    try {
      const u = new URL(url, origin);
      return u.pathname.startsWith('/api/') || u.host === this.apiHost || u.host === new URL(origin).host;
    } catch {
      return url.startsWith('/api/');
    }
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    if (!this.isApi(req.url, origin)) return next.handle(req);
    return next.handle(req.clone({setHeaders: {'ngsw-bypass': 'true'}}));
  }
}
