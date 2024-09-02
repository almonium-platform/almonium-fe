import {Component} from '@angular/core';
import {environment} from "../../environments/environment";

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.less'
})
export class LandingComponent {
  protected readonly environment = environment;
}
