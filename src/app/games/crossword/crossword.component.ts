import {Component} from '@angular/core';
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
    selector: 'app-crossword',
    imports: [
        NavbarComponent,
        NotReadyComponent
    ],
    templateUrl: './crossword.component.html',
    styleUrl: './crossword.component.less'
})
export class CrosswordComponent {

}
