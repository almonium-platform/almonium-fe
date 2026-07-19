import { Component, OnInit, inject } from '@angular/core';
import {LocalStorageService} from '../../services/local-storage.service';
import {RouterLink} from "@angular/router";

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.less'],
  imports: [
    RouterLink
  ]
})
export class NotFoundComponent implements OnInit {
  private localStorageService = inject(LocalStorageService);

  showNavbar = false;

  ngOnInit(): void {
    const userInfo = this.localStorageService.getUserInfo();
    this.showNavbar = !!userInfo;  // Show navbar if userInfo exists
  }
}
