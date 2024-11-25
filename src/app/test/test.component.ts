import {TuiTextareaModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {Component} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";

@Component({
    selector: 'app-test',
    templateUrl: './test.component.html',
    styleUrls: ['./test.component.less'],
    imports: [
        FormsModule,
        TuiTextareaModule,
        TuiTextfieldControllerModule,
        ReactiveFormsModule
    ]
})
export class TestComponent {
}
