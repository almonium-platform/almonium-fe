import {Component} from '@angular/core';
import {AuthComponent} from "../auth/auth.component";
import {ParticlesComponent} from "../../shared/particles/particles.component";
import {NgTemplateOutlet} from "@angular/common";

@Component({
  selector: 'app-login',
  imports: [
    AuthComponent,
    ParticlesComponent,
    NgTemplateOutlet
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
}
