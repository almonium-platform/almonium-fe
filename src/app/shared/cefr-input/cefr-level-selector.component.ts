import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {TuiSelectModule, TuiTextfieldControllerModule} from '@taiga-ui/legacy';
import {CEFRLevel} from "../../models/userinfo.model"; // or @taiga-ui/cdk in older versions

@Component({
  selector: 'app-cefr-level-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TuiSelectModule,
    TuiTextfieldControllerModule,
  ],
  template: `
    <tui-select
      tuiTextfieldSize="m"
      class="cefr-select"
      [formControl]="control"
      [(tuiDropdownOpen)]="openOnInit"
      [tuiTextfieldLabelOutside]="true"
    >
      <tui-data-list-wrapper
        *tuiDataList
        [items]="levels"
      >
      </tui-data-list-wrapper>
    </tui-select>
  `,
  styles: [`
    tui-select {
      --tui-font-text-s: normal 1.2rem/1.25rem var(--tui-font-text);
      width: 5rem;
    }
  `],
})
export class CefrLevelSelectorComponent {
  @Input() control!: FormControl<CEFRLevel | null>;
  @Input() levels: CEFRLevel[] = Object.values(CEFRLevel);
  @Input() openOnInit = false;

  // TODO deprecated tuiDropdownOpen
}
