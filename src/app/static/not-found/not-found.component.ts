import {Component, OnInit} from '@angular/core';
import {LocalStorageService} from '../../services/local-storage.service';
import {NgOptimizedImage} from "@angular/common";
import {RouterLink} from "@angular/router";
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.less'],
  standalone: true,
  imports: [
    RouterLink,
    NgOptimizedImage,
    NavbarWrapperComponent
  ]
})
export class NotFoundComponent implements OnInit {
  showNavbar: boolean = false;

  constructor(private localStorageService: LocalStorageService) {
  }

  ngOnInit(): void {
    const userInfo = this.localStorageService.getUserInfo();
    this.showNavbar = !!userInfo;  // Show navbar if userInfo exists
  }
}
