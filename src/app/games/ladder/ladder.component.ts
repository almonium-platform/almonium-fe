import {Component} from '@angular/core';
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-ladder',
  standalone: true,
  imports: [
    NavbarComponent,
    NotReadyComponent
  ],
  templateUrl: './ladder.component.html',
  styleUrl: './ladder.component.less'
})
export class LadderComponent {

}
