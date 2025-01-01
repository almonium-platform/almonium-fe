import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TuiHint} from "@taiga-ui/core";
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
  @Input() tooltipText: string = '';
  @Input() size: number = 30;
  @Input() strokeWidth: number = 1.5;
}
