import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {CEFRLevel} from '../../models/userinfo.model';

import {TuiTextfield} from '@taiga-ui/core';
import {TuiChevron, TuiDataListWrapper, TuiSelect} from '@taiga-ui/kit';

@Component({
  selector: 'app-cefr-level-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TuiTextfield,
    TuiSelect,
    TuiChevron,
    TuiDataListWrapper,
  ],
  template: `
    <tui-textfield
      tuiChevron
      tuiTextfieldSize="s"
      [tuiTextfieldCleaner]="false"
      class="cefr-select"
    >
      <input
        tuiSelect
        [formControl]="control"
        placeholder="Select level"
      />

      <tui-data-list-wrapper
        new
        *tuiTextfieldDropdown
        [items]="levels"
      />
    </tui-textfield>
  `,
  styles: [`
    .cefr-select {
      font: normal 1.2rem/1.25rem var(--tui-font-text);
      width: 5rem;
    }
  `],
})
export class CefrLevelSelectorComponent {
  @Input() control!: FormControl<string | null>;
  @Input() levels: string[] = Object.values(CEFRLevel);
  @Input() openOnInit = false;
}
