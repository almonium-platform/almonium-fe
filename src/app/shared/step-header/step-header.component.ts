import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TuiAvatar} from "@taiga-ui/kit";
import {TuiHeader} from "@taiga-ui/layout";
import {TuiTitle} from "@taiga-ui/core";

@Component({
  selector: 'app-step-header',
  standalone: true,
  imports: [CommonModule, TuiAvatar, TuiHeader, TuiTitle],
  template: `
    <div class="flex items-center space-x-4 mb-4">
      <tui-avatar
        appearance="primary"
        [src]="getAvatarClass()"
        size="s"
      ></tui-avatar>
      <div tuiHeader="xs">
        <h3 tuiTitle>
          {{ text }}
        </h3>
      </div>
    </div>
  `,
  styles: [``]
})
export class StepHeaderComponent {
  @Input() number: number = 0; // Accepts numbers 0-9
  @Input() text: string = 'Default';

  // Generate avatar class dynamically based on number
  getAvatarClass(): string {
    if (this.number < 0 || this.number > 9) {
      console.warn('Number out of range (0-9). Defaulting to 0.');
      return '@tui.fa.solid.0';
    }
    return `@tui.fa.solid.${this.number}`;
  }
}
