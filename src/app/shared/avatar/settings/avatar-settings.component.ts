import {Component, Input, ViewChild} from '@angular/core';
import {ManageAvatarComponent} from "../../../sections/settings/profile/avatar/manage-avatar/manage-avatar.component";
import {PopupTemplateStateService} from "../../modals/popup-template/popup-template-state.service";
import {AvatarComponent} from "../avatar.component";
import {TuiIcon} from "@taiga-ui/core";
import {TuiBadge, TuiBadgedContent} from "@taiga-ui/kit";

@Component({
  selector: 'app-avatar-settings',
  templateUrl: './avatar-settings.component.html',
  styleUrls: ['./avatar-settings.component.less'],
  imports: [
    AvatarComponent,
    TuiIcon,
    TuiBadgedContent,
    TuiBadge,
    ManageAvatarComponent
  ]
})
export class AvatarSettingsComponent {
  @Input() userInfo!: {
    avatarUrl: string | null;
    username: string | null;
    premium: boolean;
  };

  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'xxl';
  @Input() sizeInRem: number | null = null;
  @ViewChild(ManageAvatarComponent, {static: true}) manageAvatarComponent!: ManageAvatarComponent;

  constructor(
    private popupTemplateStateService: PopupTemplateStateService) {
  }

  changeAvatar(): void {
    this.popupTemplateStateService.open(this.manageAvatarComponent.content, 'avatar');
  }

  get avatarUrl(): string | null {
    return this.userInfo?.avatarUrl || null;
  }

  get username(): string | null {
    return this.userInfo?.username || null;
  }

  get outline(): boolean {
    return this.userInfo?.premium || false;
  }
}
