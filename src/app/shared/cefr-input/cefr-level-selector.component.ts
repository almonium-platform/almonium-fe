import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {CEFRLevel} from '../../models/userinfo.model';

@Component({
  selector: 'app-cefr-level-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <select
      class="cefr-select"
      aria-label="CEFR level"
      [formControl]="control"
    >
      <option [ngValue]="null" disabled>Select level</option>
      @for (level of levels; track level) {
        <option [ngValue]="level">{{ level }}</option>
      }
    </select>
  `,
  styles: [`
    :host {
      display: block;
      flex: 0 0 auto;
    }

    .cefr-select {
      width: 7.5rem;
      height: 2.75rem;
      box-sizing: border-box;
      border: 1px solid var(--tui-border-normal);
      border-radius: 1rem;
      padding: 0 0.75rem;
      background: var(--tui-background-base);
      color: var(--tui-text-primary);
      font: normal 1rem/1.25rem var(--tui-typography-family-text);
      cursor: pointer;
    }

    .cefr-select:focus-visible {
      outline: 2px solid var(--tui-background-accent-1);
      outline-offset: 2px;
    }
  `],
})
export class CefrLevelSelectorComponent {
  @Input() control!: FormControl<CEFRLevel | null>;
  @Input() levels: CEFRLevel[] = Object.values(CEFRLevel);
  @Input() openOnInit = false;
}
