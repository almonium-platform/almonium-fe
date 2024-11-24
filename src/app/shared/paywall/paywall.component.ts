import {Component, TemplateRef, ViewChild} from "@angular/core";

@Component({
  selector: 'paywall',
  template: `
    <ng-template #paywallContent>
      <div>
        Upgrade to Premium bro!
      </div>
    </ng-template>
  `,
  standalone: true
})
export class PaywallComponent {
  @ViewChild('paywallContent', {static: true}) content!: TemplateRef<any>;
}
