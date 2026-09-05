import {Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject} from '@angular/core';
import {Subject, takeUntil} from 'rxjs';
import {UserInfo} from '../../../../../models/userinfo.model';
import {UserInfoService} from '../../../../../services/user-info.service';
import {AvatarPickerComponent} from '../../../../../shared/profile/avatar-picker/avatar-picker.component';

@Component({
  selector: 'app-manage-avatar',
  templateUrl: './manage-avatar.component.html',
  styleUrl: './manage-avatar.component.less',
  imports: [AvatarPickerComponent],
})
export class ManageAvatarComponent implements OnInit, OnDestroy {
  private readonly userInfoService = inject(UserInfoService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('manageAvatar', {static: true}) content!: TemplateRef<unknown>;
  protected userInfo: UserInfo | null = null;

  ngOnInit(): void {
    this.userInfoService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(userInfo => this.userInfo = userInfo);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
