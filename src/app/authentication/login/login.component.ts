import {Component, ChangeDetectionStrategy} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './login.component.html',
})
export class LoginComponent {
}
