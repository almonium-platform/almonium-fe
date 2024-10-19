import {Component, OnInit} from '@angular/core';
import {NavbarComponent} from "../navbar/navbar.component";
import {NavbarPublicComponent} from "../navbar-public/navbar-public.component";
import {LocalStorageService} from "../../services/local-storage.service";
import {NgIf} from "@angular/common";
import {NavigationEnd, Router} from "@angular/router";

@Component({
  selector: 'app-navbar-wrapper',
  standalone: true,
  imports: [
    NavbarComponent,
    NavbarPublicComponent,
    NgIf
  ],
  templateUrl: './navbar-wrapper.component.html',
  styleUrl: './navbar-wrapper.component.less'
})
export class NavbarWrapperComponent implements OnInit {
  isAuthenticated: boolean = false;
  currentRoute: string = '';

  constructor(private localStorageService: LocalStorageService,
              private router: Router
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects;
      }
    });
  }

  ngOnInit(): void {
    this.isAuthenticated = this.localStorageService.getUserInfo() !== null;
  }
}
