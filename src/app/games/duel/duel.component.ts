import {Component} from '@angular/core';
import {NavbarComponent} from "../../shared/navbar/navbar.component";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-duel',
  standalone: true,
  imports: [
    NavbarComponent,
    NotReadyComponent
  ],
  templateUrl: './duel.component.html',
  styleUrl: './duel.component.less'
})
export class DuelComponent {

}
