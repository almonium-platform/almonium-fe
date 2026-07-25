import {TuiInput} from "@taiga-ui/core/components";
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {CEFRLevel} from '../../models/userinfo.model';
import {TuiDataListWrapper, TuiSelect} from '@taiga-ui/kit/components';
import {TuiChevron} from '@taiga-ui/kit/directives';

@Component({
  selector: 'app-cefr-level-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TuiInput,
    TuiSelect,
    TuiChevron,
    TuiDataListWrapper,
  ],
  template: `
    <tui-textfield
      tuiChevron
      tuiTextfieldSize="m"
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
        *tuiDropdown
        [items]="levels"
      />
    </tui-textfield>
  `,
  styles: [`
    :host {
      --tui-radius-m: 2rem;
    }

    .cefr-select {
      font: normal 1.2rem/1.25rem var(--tui-typography-family-text);
      width: 6rem;
    }
  `],
})
export class CefrLevelSelectorComponent {
  @Input() control!: FormControl<CEFRLevel | null>;
  @Input() levels: string[] = Object.values(CEFRLevel);
  @Input() openOnInit = false;
}
