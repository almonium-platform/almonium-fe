import {Component} from '@angular/core';
import {RouterLink} from "@angular/router";

@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  imports: [
    RouterLink,
  ],
  styleUrls: ['./play.component.less']
})
export class PlayComponent {
  filter = 'all';

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
