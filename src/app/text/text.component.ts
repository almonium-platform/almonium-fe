import {Component} from '@angular/core';
import {NgForOf, NgIf, NgOptimizedImage} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {TuiTextareaModule} from "@taiga-ui/kit";
import {TuiTextfieldControllerModule} from "@taiga-ui/core";

@Component({
  selector: 'app-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.less'],
  imports: [
    NgForOf,
    NgIf,
    FormsModule,
    NgOptimizedImage,
    TuiTextareaModule,
    TuiTextfieldControllerModule,
    ReactiveFormsModule
  ],
  standalone: true
})
export class TextComponent {
}
