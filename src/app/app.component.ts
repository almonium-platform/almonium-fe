import {NgDompurifySanitizer, SANITIZE_STYLE} from "@taiga-ui/dompurify";
import {TuiRoot} from "@taiga-ui/core";
import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {PopupTemplateComponent} from "./shared/modals/popup-template/popup-template.component";

@Component({
    selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, PopupTemplateComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.less',
    providers: [{ provide: SANITIZE_STYLE, useClass: NgDompurifySanitizer }]
})
export class AppComponent {
  title = 'almonium-fe';
}
