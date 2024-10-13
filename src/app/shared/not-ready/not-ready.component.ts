import {Component} from '@angular/core';
import {NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'app-not-ready',
  standalone: true,
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './not-ready.component.html',
  styleUrl: './not-ready.component.less'
})
export class NotReadyComponent {

}
