import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {LegalPageComponent} from '../legal-page/legal-page.component';

@Component({
  selector: 'app-delete-account',
  imports: [LegalPageComponent, RouterLink],
  templateUrl: './delete-account.component.html',
  styleUrl: './delete-account.component.less',
})
export class DeleteAccountComponent {
  protected readonly title = $localize`Delete your account`;
  protected readonly lede = $localize`How to delete your Almonium account, what goes with it, and the little that stays behind. Deletion is permanent and happens the moment you confirm.`;
  /** The date this text last changed, not the deploy date: bump it with the wording. */
  protected readonly updated = new Date(2026, 8, 24);
}
