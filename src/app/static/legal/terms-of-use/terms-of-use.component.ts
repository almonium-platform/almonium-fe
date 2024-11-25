import {Component} from '@angular/core';
import {NotReadyComponent} from "../../../shared/not-ready/not-ready.component";
import {NavbarWrapperComponent} from "../../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
    selector: 'app-terms-of-use',
    imports: [
        NotReadyComponent,
        NavbarWrapperComponent
    ],
    templateUrl: './terms-of-use.component.html',
    styleUrl: './terms-of-use.component.less'
})
export class TermsOfUseComponent {

}
