import { Component } from '@angular/core';
import {NavbarComponent} from "../shared/navbar/navbar.component";
import {NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NavbarComponent,
    NgOptimizedImage
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.less'
})
export class SettingsComponent {

}
