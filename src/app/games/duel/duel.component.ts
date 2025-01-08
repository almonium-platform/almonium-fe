import {Component} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-duel',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './duel.component.html',
  styleUrl: './duel.component.less'
})
export class DuelComponent {

}
