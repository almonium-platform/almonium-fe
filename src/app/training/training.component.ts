import { Component } from '@angular/core';
import {NavbarComponent} from "../shared/navbar/navbar.component";

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [
    NavbarComponent
  ],
  templateUrl: './training.component.html',
  styleUrl: './training.component.less'
})
export class TrainingComponent {

}
