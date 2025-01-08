import {Component} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-ladder',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './ladder.component.html',
  styleUrl: './ladder.component.less'
})
export class LadderComponent {

}
