import {Component, OnInit} from '@angular/core';
import {NgClass, NgIf, NgOptimizedImage} from "@angular/common";
import {RouterLink} from "@angular/router";
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
    selector: 'app-games',
    templateUrl: './games.component.html',
    imports: [
        NgClass,
        RouterLink,
        NgIf,
        NgOptimizedImage,
        NavbarWrapperComponent
    ],
    styleUrls: ['./games.component.less']
})
export class GamesComponent implements OnInit {
  filter: string = 'all';

  constructor() {
  }

  ngOnInit() {
  }

  filterGames(filter: string) {
    this.filter = filter;
  }

  isGameVisible(gameType: string): boolean {
    // Show all games if 'all' is selected
    if (this.filter === 'all') {
      return true;
    }
    // Show games based on filter
    return this.filter === gameType;
  }
}
