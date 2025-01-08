import {Component, OnDestroy, OnInit} from '@angular/core';
import {NavbarComponent} from "../navbar/navbar.component";
import {NavbarPublicComponent} from "../navbar-public/navbar-public.component";
import {NgIf} from "@angular/common";
import {NavigationEnd, Router} from "@angular/router";
import {Subject, takeUntil} from "rxjs";
import {UserInfo} from "../../../models/userinfo.model";
import {UserInfoService} from "../../../services/user-info.service";

@Component({
  selector: 'app-navbar-wrapper',
  imports: [
    NavbarComponent,
    NavbarPublicComponent,
    NgIf
  ],
  templateUrl: './navbar-wrapper.component.html',
  styleUrl: './navbar-wrapper.component.less'
})
export class NavbarWrapperComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  protected userInfo: UserInfo | null = null;
  protected currentRoute: string = '';
  protected isAuthenticated: boolean = false;

  constructor(private userInfoService: UserInfoService,
              private router: Router
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects;
      }
    });
  }

  ngOnInit(): void {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => {
      if (!userInfo) {
        this.isAuthenticated = false;
        return;
      }
      this.userInfo = userInfo;
      this.isAuthenticated = true;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
