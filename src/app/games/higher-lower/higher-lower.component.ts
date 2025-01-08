import {Component} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-higher-lower',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './higher-lower.component.html',
  styleUrl: './higher-lower.component.less'
})
export class HigherLowerComponent {

}
