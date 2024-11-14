import { TUI_SANITIZER } from "@taiga-ui/legacy";
import {NgDompurifySanitizer} from "@taiga-ui/dompurify";
import { TuiRoot, TuiAlert, TuiDialog } from "@taiga-ui/core";
import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TuiRoot, TuiDialog, TuiAlert],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less',
    providers: [{provide: TUI_SANITIZER, useClass: NgDompurifySanitizer}]
})
export class AppComponent {
  title = 'almonium-fe';
}
