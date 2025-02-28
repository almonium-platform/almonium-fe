import {Component, OnInit} from '@angular/core';
import {NgClass, NgOptimizedImage} from "@angular/common";
import {RouterLink} from "@angular/router";

@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  imports: [
    NgClass,
    RouterLink,
    NgOptimizedImage
  ],
  styleUrls: ['./play.component.less']
})
export class PlayComponent implements OnInit {
  filter: string = 'all';

  constructor() {
  }

  ngOnInit() {
  }

  filterGames(filter: string) {
    this.filter = filter;
  }

  isGameVisible(gameType: string): boolean {
    // Show all play if 'all' is selected
    if (this.filter === 'all') {
      return true;
    }
    // Show play based on filter
    return this.filter === gameType;
  }
}
