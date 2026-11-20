import {Component, ChangeDetectionStrategy} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-ladder',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './ladder.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ladder.component.less'
})
export class LadderComponent {

}
