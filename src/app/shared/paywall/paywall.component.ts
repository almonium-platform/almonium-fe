import {Component, TemplateRef, ViewChild} from "@angular/core";

@Component({
    selector: 'paywall',
    templateUrl: './paywall.component.html',
    styleUrls: ['./paywall.component.less'],
    imports: []
})
export class PaywallComponent {
  @ViewChild('paywallContent', {static: true}) content!: TemplateRef<any>;
}
