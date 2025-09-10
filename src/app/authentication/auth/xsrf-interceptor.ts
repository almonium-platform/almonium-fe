// xsrf-interceptor.ts
import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_HOSTS = new Set(['localhost:9998', 'api.almonium.com']);
const MUTATING = new Set(['POST','PUT','PATCH','DELETE']);

function readCookie(name: string): string | null {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1] ?? null;
}

@Injectable()
export class XsrfInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Normalize URL, handle absolute/relative/ protocol-relative
    let isApi = false;
    try { isApi = API_HOSTS.has(new URL(req.url, location.origin).host); }
    catch { isApi = req.url.startsWith('/api'); }

    if (!isApi) return next.handle(req);

    const withCreds = req.withCredentials ? req : req.clone({ withCredentials: true });
    if (!MUTATING.has(req.method.toUpperCase())) return next.handle(withCreds);

    const token = readCookie('XSRF-TOKEN');
    return next.handle(token ? withCreds.clone({ setHeaders: { 'X-XSRF-TOKEN': token } }) : withCreds);
  }
}
