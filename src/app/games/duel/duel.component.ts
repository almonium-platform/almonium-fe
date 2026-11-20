import {Component, ChangeDetectionStrategy} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-duel',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './duel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './duel.component.less'
})
export class DuelComponent {

}
