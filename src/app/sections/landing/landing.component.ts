import {Component} from '@angular/core';
import {environment} from "../../../environments/environment";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-landing',
  imports: [
    NotReadyComponent
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.less'
})
export class LandingComponent {
  protected readonly environment = environment;
}
