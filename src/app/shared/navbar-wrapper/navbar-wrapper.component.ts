import {Component, OnInit} from '@angular/core';
import {NavbarComponent} from "../navbar/navbar.component";
import {NavbarPublicComponent} from "../navbar-public/navbar-public.component";
import {UserService} from "../../services/user.service";
import {LocalStorageService} from "../../services/local-storage.service";
import {NgIf} from "@angular/common";

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

  constructor(private userService: UserService,
              private localStorageService: LocalStorageService
  ) {
  }

  ngOnInit(): void {
    this.isAuthenticated = this.localStorageService.getUserInfo() !== null;
  }
}
