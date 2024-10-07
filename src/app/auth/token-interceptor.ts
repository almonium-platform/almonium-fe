import {Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';
import {AuthService} from './auth.service';
import {Router} from '@angular/router';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService, private router: Router) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isExcluded(req.url)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Attempt to refresh the token
          return this.authService.refreshToken().pipe(
            switchMap(() => {
              // After refreshing, retry the original request
              return next.handle(req);
            }),
            catchError((refreshError: HttpErrorResponse) => {
              // Instead of clearing cookies directly, call the logout endpoint
              return this.authService.logout().pipe(
                switchMap(() => {
                  // Navigate to the login page after successful logout
                  this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
                  return throwError(() => refreshError);
                }),
                catchError(() => {
                  // If logout fails, navigate to the login page regardless
                  this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
                  return throwError(() => refreshError);
                })
              );
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  private isExcluded(url: string): boolean {
    return url.startsWith('/public');
  }
}
