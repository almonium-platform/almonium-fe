import {Component} from '@angular/core';
import {LegalPageComponent} from '../legal-page/legal-page.component';

@Component({
  selector: 'app-refund-policy',
  imports: [LegalPageComponent],
  templateUrl: './refund-policy.component.html',
})
export class RefundPolicyComponent {
  protected readonly title = $localize`Refund Policy`;
  protected readonly lede = $localize`When you get your money back. The same promise as section 5 of the Terms of Use, on a page of its own.`;
  /** The date this text last changed, not the deploy date: bump it with the wording. */
  protected readonly updated = new Date(2026, 9, 3);
}
