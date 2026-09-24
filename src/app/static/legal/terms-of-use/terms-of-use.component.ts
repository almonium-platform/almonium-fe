import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {LegalPageComponent} from '../legal-page/legal-page.component';

@Component({
  selector: 'app-terms-of-use',
  imports: [LegalPageComponent, RouterLink],
  templateUrl: './terms-of-use.component.html',
})
export class TermsOfUseComponent {
  protected readonly title = $localize`Terms of Use`;
  protected readonly lede = $localize`The agreement between you and Almonium. Short, because there is not much to agree on: read, save words, pay if you want more, be decent to other people.`;
  /** The date this text last changed, not the deploy date: bump it with the wording. */
  protected readonly updated = new Date(2026, 8, 17);
}
