import { Component } from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-read',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './read.component.html',
  styleUrl: './read.component.less'
})
export class ReadComponent {

}
