import {Component, OnDestroy, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {FileUploadComponent} from "../../../../../shared/file-upload/file-upload.component";
import {FirebaseService} from "../firebase.service";
import {ProfileSettingsService} from "../../profile-settings.service";
import {UserInfoService} from "../../../../../services/user-info.service";
import {TuiAlertService, TuiIcon} from "@taiga-ui/core";
import {
  TuiAvatar,
  TuiAvatarOutline,
  TuiBadge,
  TuiBadgedContentComponent,
  TuiBadgedContentDirective
} from "@taiga-ui/kit";
import {NgClass} from "@angular/common";
import {Avatar} from "../avatar.model";
import {UserInfo} from "../../../../../models/userinfo.model";
import {Subject, takeUntil} from "rxjs";
import {AvatarComponent} from "../../../../../shared/avatar/avatar.component";

@Component({
  selector: 'app-manage-avatar',
  templateUrl: './manage-avatar.component.html',
  imports: [
    FileUploadComponent,
    TuiAvatar,
    TuiAvatarOutline,
    TuiBadgedContentComponent,
    TuiIcon,
    TuiBadge,
    TuiBadgedContentDirective,
    AvatarComponent,
    NgClass
  ],
  styleUrls: ['./manage-avatar.component.less']
})
export class ManageAvatarComponent implements OnInit, OnDestroy {
  @ViewChild('manageAvatar', {static: true}) content!: TemplateRef<any>;

  private readonly FIREBASE_AVATAR_URL_PATH = 'avatars/users';
  private readonly FIREBASE_DEFAULT_URL_PATH = this.FIREBASE_AVATAR_URL_PATH + '/default';

  protected userInfo: UserInfo | null = null;
  private readonly destroy$ = new Subject<void>();

  defaultAvatars: string[] = [];
  customAvatars: Avatar[] = [];
  isUpdated: boolean = false;
  isReset: boolean = false;
  deletedAvatarId: number = -1;

  constructor(
    private userInfoService: UserInfoService,
    private fileUploadService: FirebaseService,
    private profileSettingsService: ProfileSettingsService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit() {
    this.loadDefaultAvatars().then();
    this.loadCustomAvatars();
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(info => {
      this.userInfo = info;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected async onFileUploaded(file: File): Promise<void> {
    try {
      const filePath = await this.fileUploadService.uploadFile(file, this.FIREBASE_AVATAR_URL_PATH);
      this.profileSettingsService.addAndSetNewAvatar(filePath).subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({avatarUrl: filePath});
          this.playUpdatedAnimation();
          this.loadCustomAvatars();
          this.alertService.open('Profile picture updated', {appearance: 'success'}).subscribe();
        },
        error: () => {
          this.alertService.open('Failed to set new avatar', {appearance: 'error'}).subscribe();
        }
      });
    } catch (error) {
      this.alertService.open('Failed to upload avatar', {appearance: 'error'}).subscribe();
    }
  }

  protected deleteCustomAvatar(id: number) {
    const currentAvatarUrl = this.userInfo?.avatarUrl;
    this.deletedAvatarId = id;
    this.profileSettingsService.deleteCustomAvatar(id).subscribe({
      next: () => {
        const deletedUrl = this.customAvatars.find(avatar => avatar.id === id)?.url
        setTimeout(() => this.deletedAvatarId = -1, 500);
        if (currentAvatarUrl == deletedUrl) {
          this.playAvatarResetAnimation();
          this.userInfoService.updateUserInfo({avatarUrl: ''});
        }
        this.loadCustomAvatars();
        this.alertService.open('Avatar deleted', {appearance: 'success'}).subscribe();
      }, error: () => {
        this.alertService.open('Failed to delete avatar', {appearance: 'error'}).subscribe();
      }
    });
  }

  protected chooseDefaultAvatar(url: string) {
    this.profileSettingsService.chooseDefaultAvatar(url).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({avatarUrl: url});
        this.playUpdatedAnimation();
        this.alertService.open('Profile picture updated', {appearance: 'success'}).subscribe();
      }, error: () => {
        this.alertService.open('Failed to set new avatar', {appearance: 'error'}).subscribe();
      }
    })
  }

  protected chooseAnotherCustomAvatar(id: number) {
    this.profileSettingsService.chooseExistingCustomAvatar(id).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({avatarUrl: this.customAvatars.find(avatar => avatar.id === id)?.url});
        this.playUpdatedAnimation();
        this.alertService.open('Profile picture updated', {appearance: 'success'}).subscribe();
      }, error: () => {
        this.alertService.open('Failed to set new avatar', {appearance: 'error'}).subscribe();
      }
    });
  }

  protected deleteCurrentAvatar() {
    this.profileSettingsService.resetAvatar().subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({avatarUrl: ''});
        this.playAvatarResetAnimation();
        this.alertService.open('Profile picture deleted', {appearance: 'success'}).subscribe();
      }, error: () => {
        this.alertService.open('Failed to delete avatar', {appearance: 'error'}).subscribe();
      }
    });
  }

  private loadCustomAvatars() {
    return this.profileSettingsService.getAvatars().subscribe({
      next: (avatars) => {
        this.customAvatars = avatars;
      }, error: () => {
        this.alertService.open('Failed to load custom avatars', {appearance: 'error'}).subscribe();
      }
    });
  }

  private async loadDefaultAvatars() {
    try {
      // Fetch the default avatars from Firebase
      this.defaultAvatars = await this.fileUploadService.getDefaultAvatars(this.FIREBASE_DEFAULT_URL_PATH);
    } catch (error) {
      this.alertService.open('Failed to load default avatars', {label: 'Error'}).subscribe();
    }
  }

  private playAvatarResetAnimation() {
    this.isReset = true;
    setTimeout(() => this.isReset = false, 1000);
  }

  private playUpdatedAnimation() {
    this.isUpdated = true;
    setTimeout(() => this.isUpdated = false, 1000);
  }
}
