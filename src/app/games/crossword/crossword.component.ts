import {Component, ChangeDetectionStrategy} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-crossword',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './crossword.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './crossword.component.less'
})
export class CrosswordComponent {

}
