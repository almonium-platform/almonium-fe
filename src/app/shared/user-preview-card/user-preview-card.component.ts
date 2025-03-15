import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {ProfileService} from "./profile.service";
import {RelationshipStatus, UserProfileInfo} from "./user-profile.model";
import {AvatarComponent} from "../avatar/avatar.component";
import {ButtonComponent} from "../button/button.component";
import {SharedLucideIconsModule} from "../shared-lucide-icons.module";
import {ReactiveFormsModule} from "@angular/forms";
import {
  TuiAlertService,
  TuiAutoColorPipe,
  TuiDataListComponent,
  TuiDropdownDirective,
  TuiDropdownOptionsDirective,
  TuiOption
} from "@taiga-ui/core";
import {TuiChip, TuiDataListDropdownManager} from "@taiga-ui/kit";
import {TuiActiveZone} from "@taiga-ui/cdk";
import {SocialService} from "../../sections/social/social.service";
import {ConfirmModalComponent} from "../modals/confirm-modal/confirm-modal.component";
import {StreamChat, User} from "stream-chat";
import {environment} from "../../../environments/environment";
import {AppConstants} from "../../app.constants";
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";
import {UserInfoService} from "../../services/user-info.service";
import {UserInfo} from "../../models/userinfo.model";
import {ChatClientService} from "stream-chat-angular";
import {Router} from "@angular/router";
import {RelationshipAction} from "../../sections/social/social.model";

@Component({
  selector: 'app-user-preview-card',
  imports: [
    AvatarComponent,
    ButtonComponent,
    SharedLucideIconsModule,
    ReactiveFormsModule,
    TuiAutoColorPipe,
    TuiChip,
    TuiDataListComponent,
    TuiDataListDropdownManager,
    TuiDropdownDirective,
    TuiOption,
    TuiActiveZone,
    TuiDropdownOptionsDirective,
    ConfirmModalComponent
  ],
  templateUrl: './user-preview-card.component.html',
  styleUrl: './user-preview-card.component.less'
})
export class UserPreviewCardComponent implements OnInit, OnDestroy {
  @Input() userId!: string;
  @Output() close = new EventEmitter<void>();
  // constant to store how many interests to display
  protected readonly MAX_INTERESTS = 4;
  protected readonly MAX_TARGET_LANGS = 4;
  protected readonly MAX_FLUENT_LANGS = 4;
  private readonly destroy$ = new Subject<void>();
  private userInfo: UserInfo | null = null;

  protected userProfileInfo: UserProfileInfo | null = null;
  private chatClient: StreamChat;

  // confirm modal settings
  protected isConfirmModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  private dropdownOpen = false;

  protected buttonConfig = {
    label: '',
    icon: '',
    action: () => {
    },
  };

  constructor(
    private userService: ProfileService,
    private userInfoService: UserInfoService,
    private socialService: SocialService,
    private chatService: ChatClientService,
    private alertService: TuiAlertService,
    private router: Router,
  ) {
    this.chatClient = StreamChat.getInstance(environment.streamChatApiKey);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    this.populateUserProfileInfo();
    this.initViewer();
  }

  private initViewer() {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe((info) => {
      if (!info) {
        return;
      }
      this.userInfo = info;
      const userId = this.userInfo.id;
      const userToken = this.userInfo.streamChatToken;
      const userName = this.userInfo.username;

      const user: User = {
        id: userId,
        name: userName,
        image: this.userInfo.avatarUrl ?? `https://getstream.io/random_png/?name=${userName}`,
      };

      this.chatService.init(environment.streamChatApiKey, user, userToken);
    });
  }

  private populateUserProfileInfo() {
    this.userService.getUserProfile(this.userId).subscribe(user => {
      if (!user) return;
      this.userProfileInfo = user;
      this.setButtonConfig();
    });
  }

  private setButtonConfig(): void {
    if (!this.userProfileInfo) {
      console.error('No user profile, cannot set button config');
      return;

    }
    switch (this.userProfileInfo.relationshipStatus) {
      case 'FRIENDS':
        this.buttonConfig = {
          label: 'Message',
          icon: 'message-circle',
          action: this.openChat.bind(this),
        };
        break;
      case 'PENDING_INCOMING':
        this.buttonConfig = {
          label: 'Accept Request',
          icon: 'user-round-plus',
          action: this.acceptFriendRequest.bind(this),
        };
        break;
      case 'PENDING_OUTGOING':
        this.buttonConfig = {
          label: 'Cancel Request',
          icon: 'x',
          action: this.cancelFriendRequest.bind(this),
        };
        break;
      case "STRANGER":
        if (this.userProfileInfo.acceptsRequests) {
          console.log('User accepts requests');
          this.buttonConfig = {
            label: 'Send Request',
            icon: 'user-round-plus',
            action: this.sendFriendRequest.bind(this),
          };
        } else {
          this.buttonConfig = {
            label: '',
            icon: '',
            action: () => {
            },
          };
        }
        break;
      case 'BLOCKED':
        this.buttonConfig = {
          label: '',
          icon: '',
          action: () => {
          },
        };
    }
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  protected prepareUnfriendModal() {
    this.modalTitle = 'Unfriend';
    this.modalMessage = 'Are you sure you want to unfriend this user?';
    this.modalConfirmText = 'Unfriend';
    this.modalAction = () => this.unfriend();
    this.isConfirmModalVisible = true;
  }

  protected closeConfirmModal() {
    this.isConfirmModalVisible = false;
  }

  protected confirmModalAction() {
    if (this.modalAction) {
      this.modalAction();
    } else {
      console.error('No action set for confirm modal');
    }
    this.closeConfirmModal();
  }

  prepareBlockModal() {
    this.modalTitle = 'Block User';
    this.modalMessage = 'Are you sure you want to block this user?';
    this.modalConfirmText = 'Block';
    this.modalAction = () => this.block();
    this.isConfirmModalVisible = true;
  }

  protected block() {
    const userId = this.userProfileInfo?.id;
    if (!userId) {
      console.error('No user profile');
      return;
    }

    this.chatClient.blockUser(userId).then(() => {
    });

    this.loadingSubject$.next(true);
    this.socialService.block(userId)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (profileInfo) => {
          this.userProfileInfo = profileInfo;
          this.setButtonConfig();

          this.alertService.open('User blocked', {appearance: 'success'}).subscribe();
          this.userProfileInfo.relationshipStatus = RelationshipStatus.BLOCKED;
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to block user', {appearance: 'error'}).subscribe();
        }
      });
  }

  protected unblock() {
    const relationshipId = this.userProfileInfo?.relationshipId;
    const friendId = this.userProfileInfo?.id;

    if (!relationshipId || !friendId) {
      console.error('No relationshipId or friendId');
      return;
    }

    this.chatClient.unBlockUser(friendId).then(() => {
    });

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(relationshipId, RelationshipAction.UNBLOCK)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('User unblocked', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to unblock user', {appearance: 'error'}).subscribe();
        }
      });
  }

  private unfriend() {
    const relationshipId = this.userProfileInfo?.relationshipId;
    if (!relationshipId) {
      console.error('No user profile or relationshipId');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(relationshipId, RelationshipAction.UNFRIEND)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('That user is no longer your friend', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to remove friend', {appearance: 'error'}).subscribe();
        }
      });
  }

  private openChat() {
    const relationshipId = this.userProfileInfo?.relationshipId;

    if (!this.userProfileInfo || !relationshipId) {
      console.error('No user profile or relationshipId');
      return;
    }

    this.router.navigate(['/social'], {queryParams: {chat: relationshipId}}).then();
  }

  private cancelFriendRequest() {
    const relationshipId = this.userProfileInfo?.relationshipId;

    if (!relationshipId) {
      console.error('No relationshipId');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(relationshipId, RelationshipAction.CANCEL)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('Friend request cancelled', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to cancel friendship request', {appearance: 'error'}).subscribe();
        }
      });
  }

  private acceptFriendRequest(): void {
    // Capture values in local variables
    const userProfileInfo = this.userProfileInfo;
    const relationshipId = this.userProfileInfo?.relationshipId;
    const userInfo = this.userInfo;

    // Check for null in the captured variables
    if (!userProfileInfo || !userInfo || !userProfileInfo.relationshipId || !relationshipId) {
      console.error('No user profile or invalid relationshipId');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(userProfileInfo.relationshipId, RelationshipAction.ACCEPT)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.createPrivateChat(userInfo.id, userProfileInfo.id, relationshipId)
            .then(() => {
              this.userProfileInfo = userProfileInfo;
              this.setButtonConfig();

              this.alertService.open('Friend request accepted', {appearance: 'success'}).subscribe();
            });
        },
        error: (error) => console.error(error),
      });
  }

  private async createPrivateChat(userId: string, recipientId: string, relationshipId: string) {
    if (!this.chatClient.user) {
      throw new Error('User must be connected before creating a chat.');
    }

    // Unique channel ID (e.g., `private_user1_user2`)
    const channelId = `private_${relationshipId}`;

    const channel = this.chatService.chatClient.channel('messaging', channelId, {
      name: AppConstants.PRIVATE_CHAT_NAME,
      members: [userId, recipientId], // Both users in the private chat
      created_by_id: userId, // Set creator
    });

    await channel.create(); // Ensure the channel is created
    await channel.watch();  // ✅ Fix: Wait for the channel to be initialized

    return channel;
  }

  private sendFriendRequest() {
    const userProfileId = this.userProfileInfo?.id;
    if (!userProfileId) {
      console.error('No user profile id');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.createFriendshipRequest(userProfileId)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('We notified user about your request', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to send friendship request', {appearance: 'error'}).subscribe();
        }
      });
  }

  protected closeActionsDropdown($event: boolean, friendDropdown: TuiDropdownDirective) {
    this.dropdownOpen = $event;
    if (!$event) {
      friendDropdown.toggle(false);
    }
  }

  protected onMouseLeave() {
    setTimeout(() => {
      if (!this.dropdownOpen) {
        this.close.emit();
      }
    }, 10);
  }
}
