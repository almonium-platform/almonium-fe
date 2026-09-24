import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {LegalPageComponent} from '../legal-page/legal-page.component';

@Component({
  selector: 'app-privacy-policy',
  imports: [LegalPageComponent, RouterLink],
  templateUrl: './privacy-policy.component.html',
})
export class PrivacyPolicyComponent {
  protected readonly title = $localize`Privacy Policy`;
  protected readonly lede = $localize`What Almonium knows about you, why, who else sees it, and how to make us forget it. Written to be read, not skimmed past.`;
  /** The date this text last changed, not the deploy date: bump it with the wording. */
  protected readonly updated = new Date(2026, 8, 24);
}
