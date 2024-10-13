import { Component } from '@angular/core';
import {NavbarPublicComponent} from "../../shared/navbar-public/navbar-public.component";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [
    NavbarPublicComponent,
    NotReadyComponent
  ],
  templateUrl: './about.component.html',
  styleUrl: './about.component.less'
})
export class AboutComponent {

}
