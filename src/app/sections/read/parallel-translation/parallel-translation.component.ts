import {Component, Input} from '@angular/core';
import {TuiHintDirective} from "@taiga-ui/core";
import {TuiSkeleton} from "@taiga-ui/kit";

@Component({
  selector: 'app-parallel-translation',
  templateUrl: './parallel-translation.component.html',
  imports: [
    TuiHintDirective,
    TuiSkeleton
  ],
  styleUrls: ['./parallel-translation.component.less']
})
export class ParallelTranslationComponent {
  @Input() inactive: boolean = false;
  @Input() showHint: boolean = true;
  @Input() loading: boolean = false;
}
