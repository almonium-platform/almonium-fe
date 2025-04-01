import {Component, Input} from '@angular/core';
import {TuiHintDirective} from "@taiga-ui/core";

@Component({
  selector: 'app-parallel-translation',
  templateUrl: './parallel-translation.component.html',
  imports: [
    TuiHintDirective
  ],
  styleUrls: ['./parallel-translation.component.less']
})
export class ParallelTranslationComponent {
  @Input() inactive: boolean = false;
}
