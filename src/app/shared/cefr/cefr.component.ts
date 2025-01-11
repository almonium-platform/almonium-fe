import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CEFRLevel} from "../../models/userinfo.model";
import {TuiAutoColorPipe} from "@taiga-ui/core";

@Component({
  selector: 'app-cefr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiAutoColorPipe,
  ],
  template: `
    <div class="cefr badge-btn" [style.background-color]="level | tuiAutoColor">
      <span>
      {{ level }}</span>
    </div>
  `,
  styleUrls: ['./cefr.component.less'],
})
export class CefrComponent {
  @Input() level!: CEFRLevel;
}
