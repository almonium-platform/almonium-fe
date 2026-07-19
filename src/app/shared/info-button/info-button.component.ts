import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TuiHint} from "@taiga-ui/core/portals";
import {LucideAngularModule} from "lucide-angular";

@Component({
  selector: 'app-info-icon',
  template: `
    <lucide-icon
      name="info"
      class="info-btn"
      tuiHintAppearance="dark"
      tuiHintDirection="top"
      [size]=size
      [strokeWidth]="strokeWidth"
      [tuiHint]="tooltipTemplate"
    >
      <ng-template #tooltipTemplate>
        <div [innerHTML]="tooltipText"></div>
      </ng-template>
    </lucide-icon>
  `,
  styles: [
    `
      .info-btn {
        cursor: pointer;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    TuiHint,
    LucideAngularModule
  ],
})
export class InfoIconComponent {
  @Input() tooltipText = '';
  @Input() size = 30;
  @Input() strokeWidth = 1.5;
}
