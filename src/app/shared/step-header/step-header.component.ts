import {logger} from "../logger";
import {Component, Input} from '@angular/core';
import {TuiAvatar} from "@taiga-ui/kit/components";
import {TuiTitle} from "@taiga-ui/core/components";
import {TuiHeader} from "@taiga-ui/layout/components";

@Component({
  selector: 'app-step-header',
  standalone: true,
  imports: [
    TuiAvatar,
    TuiTitle,
    TuiHeader
  ],
  template: `
    <div class="flex items-center space-x-4 mb-4">
      <span [tuiAvatar]="getAvatarClass()"
        appearance="primary"
        size="s"
      ></span>
      <div tuiHeader="h6">
        <h3 tuiTitle>
          {{ text }}
        </h3>
      </div>
    </div>
  `,
  styles: [`
    ::ng-deep tui-avatar[data-type='icon']::before {
      font-size: calc(var(--t-size) * .4) !important;
    }
  `]
})
export class StepHeaderComponent {
  @Input() number = 0; // Accepts numbers 0-9
  @Input() text = 'Default';

  // Generate avatar class dynamically based on number
  getAvatarClass(): string {
    if (this.number < 0 || this.number > 9) {
      logger.warn('Number out of range (0-9). Defaulting to 0.');
      return '@tui.fa.solid.0';
    }
    return `@tui.fa.solid.${this.number}`;
  }
}
