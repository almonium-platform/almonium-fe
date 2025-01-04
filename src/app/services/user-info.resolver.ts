import {Injectable} from '@angular/core';
import {Resolve} from '@angular/router';
import {Observable} from 'rxjs';
import {UserInfo} from "../models/userinfo.model";
import {UserInfoService} from "./user-info.service";

@Injectable({providedIn: 'root'})
export class UserInfoResolver implements Resolve<UserInfo | null> {
  constructor(private userInfoService: UserInfoService) {
  }

  resolve(): Observable<UserInfo | null> {
    return this.userInfoService.fetchUserInfoFromServer();
  }
}
