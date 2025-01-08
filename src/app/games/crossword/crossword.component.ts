import {Component} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-crossword',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './crossword.component.html',
  styleUrl: './crossword.component.less'
})
export class CrosswordComponent {

}
