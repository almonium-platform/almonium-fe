import {Component, Input, ViewChild} from '@angular/core';
import {AvatarComponent} from "../avatar.component";
import {UserPreviewCardComponent} from "../../user-preview-card/user-preview-card.component";
import {TuiDropdownDirective, TuiDropdownManual} from "@taiga-ui/core";
import {LucideAngularModule} from "lucide-angular";
import {UserPreviewCardWrapperComponent} from "../../user-preview-card/user-preview-card-wrapper.component";
import {PopupTemplateStateService} from "../../modals/popup-template/popup-template-state.service";


@Component({
  selector: 'app-avatar-preview',
  template: `
    <app-avatar
      [avatarUrl]="avatarUrl"
      [username]="username"
      [outline]="outline"
      [size]="size"
      [sizeInRem]="sizeInRem"
      [redirect]="redirect"
      [loading]="loading"
      [tuiDropdownManual]="showDropdown()"
      [tuiDropdown]="dropdownTemplate"
      (mouseenter)="onHover()"
      (mouseleave)="onLeave()"
      (click)="openUserCard()"
      class="flex"
    >
    </app-avatar>
    @if (userId) {
      <app-user-preview-card-wrapper #preview [userId]="userId"></app-user-preview-card-wrapper>
    }
    <ng-template #dropdownTemplate>
      @if (userId) {
        <app-user-preview-card
          [userId]="userId"
          (mouseenter)="dropdownOnHover()"
          (mouseleave)="cardHovered = false"
          (close)="onLeave()"
        ></app-user-preview-card>
      } @else {
        Error! No userId provided.
      }
    </ng-template>
  `,
  imports: [
    AvatarComponent,
    UserPreviewCardComponent,
    TuiDropdownDirective,
    TuiDropdownManual,
    LucideAngularModule,
    UserPreviewCardWrapperComponent
  ],
})
export class AvatarPreviewComponent {
  @ViewChild('preview', {static: false}) wrapper!: UserPreviewCardWrapperComponent

  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() outline: boolean = false; // todo: rename to premium
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null;
  @Input() redirect: boolean = false;
  @Input() loading: boolean = false;
  @Input() userId: string | null = null;
  protected previewOpened: boolean = false;
  protected cardHovered: boolean = false;

  constructor(
    private popupTemplateStateService: PopupTemplateStateService) {
  }

  onHover() {
    this.previewOpened = true;
  }

  timeout: any;

  onLeave() {
    this.timeout = setTimeout(() => {
      if (!this.cardHovered) {
        this.previewOpened = false;
      }
    }, 200);
  }

  showDropdown() {
    return !!this.userId && this.previewOpened;
  }

  dropdownOnHover() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.cardHovered = true;
  }

  openUserCard() {
    this.popupTemplateStateService.open(this.wrapper.content, 'preview', true);
  }
}
