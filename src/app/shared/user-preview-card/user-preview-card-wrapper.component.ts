import {Component, Input, TemplateRef, ViewChild} from '@angular/core';
import {UserPreviewCardComponent} from "./user-preview-card.component";

@Component({
  selector: 'app-user-preview-card-wrapper',
  template: `
    <ng-template #preview>
      <app-user-preview-card [userId]="userId"></app-user-preview-card>
    </ng-template>
  `,
  imports: [
    UserPreviewCardComponent
  ],
  standalone: true
})
export class UserPreviewCardWrapperComponent {
  @ViewChild('preview', {static: true}) content!: TemplateRef<any>;

  @Input() userId!: string;
}
