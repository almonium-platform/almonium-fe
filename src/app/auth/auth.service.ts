import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConstants } from '../app.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/login`;
    return this.http.post(url, { email, password });
  }

  register(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/register`;
    return this.http.post(url, { email, password });
  }
}
