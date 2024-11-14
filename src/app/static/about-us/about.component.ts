import {Component} from '@angular/core';
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [
    NotReadyComponent,
    NavbarWrapperComponent
  ],
  templateUrl: './about.component.html',
  styleUrl: './about.component.less'
})
export class AboutComponent {

}
