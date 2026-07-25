import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';


@Component({
  selector: 'app-test',
  standalone: true,
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule
  ],
})
export class TestComponent {
}
