import {Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';
import {AuthService} from './auth.service';
import {Router} from '@angular/router';
import {UserService} from "../../services/user.service";

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService,
              private router: Router,
              private userService: UserService
  ) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isExcluded(req.url)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          console.log('Token expired, refreshing token');
          return this.authService.refreshToken().pipe(
            switchMap(() => {
              return next.handle(req);
            }),
            catchError((refreshError: HttpErrorResponse) => {
              console.log('Refresh token failed', refreshError);
              this.userService.clearUserInfo()
              return this.authService.logoutPublic().pipe(
                switchMap(() => {
                  this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
                  return throwError(() => refreshError);
                }),
                catchError(() => {
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
