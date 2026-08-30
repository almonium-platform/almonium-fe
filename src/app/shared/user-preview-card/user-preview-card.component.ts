import {logger} from "../logger";
import {getErrorMessage} from '../http-error';
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject} from '@angular/core';
import {ProfileService} from "./profile.service";
import {RelationshipStatus, UserProfileInfo} from "./user-profile.model";
import {AvatarComponent} from "../avatar/avatar.component";
import {SharedLucideIconsModule} from "../shared-lucide-icons.module";
import {ReactiveFormsModule} from "@angular/forms";
import {TuiDataListComponent, TuiNotificationService, TuiOption} from "@taiga-ui/core/components";
import {TuiDropdownDirective, TuiDropdownOptionsDirective} from "@taiga-ui/core/portals";
import {TuiDataListDropdownManager, TuiSkeleton} from "@taiga-ui/kit/directives";
import {TuiActiveZone} from "@taiga-ui/cdk/directives";
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
import {RelationshipAction} from "../relationship.model";
import {LanguageNameService} from "../../services/language-name.service";
import {TargetLanguageWithProficiency} from "../../onboarding/language-setup/language-setup.model";
import {sharedItemsFirst} from './user-preview-card-display';
import {AsyncPipe} from '@angular/common';

@Component({
  selector: 'app-user-preview-card',
  imports: [
    AvatarComponent,
    SharedLucideIconsModule,
    ReactiveFormsModule,
    TuiDataListComponent,
    TuiDataListDropdownManager,
    TuiDropdownDirective,
    TuiActiveZone,
    TuiDropdownOptionsDirective,
    ConfirmModalComponent,
    TuiSkeleton,
    TuiOption,
    AsyncPipe,
  ],
  templateUrl: './user-preview-card.component.html',
  styleUrl: './user-preview-card.component.less'
})
export class UserPreviewCardComponent implements OnInit, OnDestroy {
  private userService = inject(ProfileService);
  private userInfoService = inject(UserInfoService);
  private socialService = inject(SocialService);
  private chatService = inject(ChatClientService);
  private alertService = inject(TuiNotificationService);
  private router = inject(Router);
  private languageNameService = inject(LanguageNameService);

  @Input() userId!: string;
  @Input() publicProfile: UserProfileInfo | null = null;

  @Output() closed = new EventEmitter<void>();
  // constant to store how many interests to display
  protected readonly MAX_INTERESTS = 4;
  protected readonly MAX_TARGET_LANGS = 3;
  private readonly destroy$ = new Subject<void>();
  private userInfo: UserInfo | null = null;

  protected userProfileInfo: UserProfileInfo | null = null;
  private chatClient: StreamChat;

  // confirm modal settings
  protected isConfirmModalVisible = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  private dropdownOpen = false;
  private authenticatedPerspectiveFor: string | null = null;
  protected targetLanguagesExpanded = false;
  protected interestsExpanded = false;

  protected buttonConfig: {label: string; icon: string; appearance: 'primary' | 'secondary'; action: () => void} = {
    label: '',
    icon: '',
    appearance: 'primary',
    action: () => undefined,
  };

  constructor() {
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
      this.loadAuthenticatedProfilePerspective();
      const userId = this.userInfo.id;
      const userToken = this.userInfoService.streamChatToken;
      if (!userToken) {
        return;
      }
      const userName = this.userInfo.username;

      const user: User = {
        id: userId,
        name: userName,
        image: this.userInfo.avatarUrl ?? `https://getstream.io/random_png/?name=${userName}`,
      };

      void this.chatService.init(environment.streamChatApiKey, user, userToken);
    });
  }

  private loadAuthenticatedProfilePerspective(): void {
    if (!this.publicProfile
      || !this.userInfo
      || this.userInfo.id === this.publicProfile.id
      || this.authenticatedPerspectiveFor === this.publicProfile.id) {
      return;
    }

    this.authenticatedPerspectiveFor = this.publicProfile.id;
    this.userService.getUserProfile(this.publicProfile.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: profile => {
          this.userProfileInfo = profile;
          this.setButtonConfig();
        },
        error: error => {
          this.authenticatedPerspectiveFor = null;
          logger.warn('Could not load the authenticated profile perspective', error);
        },
      });
  }

  private populateUserProfileInfo() {
    if (this.publicProfile) {
      this.userProfileInfo = this.publicProfile;
      this.setButtonConfig();
      return;
    }

    this.userService.getUserProfile(this.userId).subscribe(user => {
      if (!user) return;
      this.userProfileInfo = user;
      this.setButtonConfig();
    });
  }

  private setButtonConfig(): void {
    if (!this.userProfileInfo) {
      logger.error('No user profile, cannot set button config');
      return;

    }
    switch (this.userProfileInfo.relationshipStatus) {
      case RelationshipStatus.FRIENDS:
        this.buttonConfig = {
          label: 'Message',
          icon: 'message-circle',
          appearance: 'secondary',
          action: this.openChat.bind(this),
        };
        break;
      case RelationshipStatus.PENDING_INCOMING:
        this.buttonConfig = {
          label: 'Accept Request',
          icon: 'user-round-plus',
          appearance: 'primary',
          action: this.acceptFriendRequest.bind(this),
        };
        break;
      case RelationshipStatus.PENDING_OUTGOING:
        this.buttonConfig = {
          label: 'Cancel Request',
          icon: 'x',
          appearance: 'secondary',
          action: this.cancelFriendRequest.bind(this),
        };
        break;
      case RelationshipStatus.STRANGER:
        if (this.userProfileInfo.acceptsRequests) {
          logger.debug('User accepts requests');
          this.buttonConfig = {
            label: 'Add friend',
            icon: 'user-round-plus',
            appearance: 'primary',
            action: this.sendFriendRequest.bind(this),
          };
        } else {
          this.buttonConfig = {
            label: '',
            icon: '',
            appearance: 'primary',
            action: () => undefined,
          };
        }
        break;
      case RelationshipStatus.BLOCKED:
        this.buttonConfig = {
          label: '',
          icon: '',
          appearance: 'primary',
          action: () => undefined,
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
      year: 'numeric'
    });
  }

  protected get fluentLanguages(): string {
    return this.languageNameService.getLanguageNames(this.userProfileInfo?.fluentLangs ?? []).join(', ');
  }

  protected get targetLanguages(): TargetLanguageWithProficiency[] {
    const targetLanguages = this.userProfileInfo?.targetLangs ?? [];
    return sharedItemsFirst(targetLanguages, target => this.isSharedTargetLanguage(target.language));
  }

  protected get interests(): string[] {
    const interests = this.userProfileInfo?.interests ?? [];
    return sharedItemsFirst(interests, interest => this.isSharedInterest(interest));
  }

  protected languageName(code: string): string {
    return this.languageNameService.getLanguageName(code);
  }

  protected isSharedTargetLanguage(code: string): boolean {
    return new Set<string>(this.userInfo?.targetLangs ?? []).has(code);
  }

  protected isSharedInterest(interest: string): boolean {
    const normalizedInterest = interest.trim().toLocaleLowerCase();
    return this.userInfo?.interests.some(viewerInterest =>
      viewerInterest.name.trim().toLocaleLowerCase() === normalizedInterest) ?? false;
  }

  protected get connectionSummary(): string | null {
    const sharedLanguage = this.targetLanguages.find(target => this.isSharedTargetLanguage(target.language));
    if (sharedLanguage) {
      return `Learning ${this.languageName(sharedLanguage.language)}, like you`;
    }

    const sharedInterest = this.interests.find(interest => this.isSharedInterest(interest));
    return sharedInterest ? `Also interested in ${sharedInterest}` : null;
  }

  protected get canManageRelationship(): boolean {
    return !!this.userInfo && this.userInfo.id !== this.userProfileInfo?.id;
  }

  protected get canUseRelationshipAction(): boolean {
    return !!this.userProfileInfo && this.userInfo?.id !== this.userProfileInfo.id;
  }

  protected showMore(section: 'languages' | 'interests'): void {
    if (!this.userProfileInfo) {
      return;
    }

    if (this.publicProfile) {
      if (section === 'languages') {
        this.targetLanguagesExpanded = true;
      } else {
        this.interestsExpanded = true;
      }
      return;
    }

    void this.router.navigate(['/users', this.userProfileInfo.username]);
  }

  protected viewProfile() {
    if (!this.userProfileInfo) return;
    this.closed.emit();
    void this.router.navigate(['/users', this.userProfileInfo.username]);
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
      logger.error('No action set for confirm modal');
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
      logger.error('No user profile');
      return;
    }

    void this.chatClient.blockUser(userId);

    this.loadingSubject$.next(true);
    this.socialService.block(userId)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (profileInfo) => {
          this.userProfileInfo = profileInfo;
          this.setButtonConfig();

          this.alertService.open('User blocked', {appearance: 'positive'}).subscribe();
          this.userProfileInfo.relationshipStatus = RelationshipStatus.BLOCKED;
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to block user'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  protected unblock() {
    const relationshipId = this.userProfileInfo?.relationshipId;
    const friendId = this.userProfileInfo?.id;

    if (!relationshipId || !friendId) {
      logger.error('No relationshipId or friendId');
      return;
    }

    void this.chatClient.unBlockUser(friendId);

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(relationshipId, RelationshipAction.UNBLOCK)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('User unblocked', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to unblock user'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  private unfriend() {
    const relationshipId = this.userProfileInfo?.relationshipId;
    if (!relationshipId) {
      logger.error('No user profile or relationshipId');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(relationshipId, RelationshipAction.UNFRIEND)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('That user is no longer your friend', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to remove friend'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  private openChat() {
    const relationshipId = this.userProfileInfo?.relationshipId;

    if (!this.userProfileInfo || !relationshipId) {
      logger.error('No user profile or relationshipId');
      return;
    }

    void this.router.navigate(['/social'], {queryParams: {chat: relationshipId}}).then();
  }

  private cancelFriendRequest() {
    const relationshipId = this.userProfileInfo?.relationshipId;

    if (!relationshipId) {
      logger.error('No relationshipId');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(relationshipId, RelationshipAction.CANCEL)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('Friend request cancelled', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to cancel friendship request'), {appearance: 'negative'}).subscribe();
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
      logger.error('No user profile or invalid relationshipId');
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.patchFriendship(userProfileInfo.relationshipId, RelationshipAction.ACCEPT)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          void this.createPrivateChat(userInfo.id, userProfileInfo.id, relationshipId)
            .then(() => {
              this.userProfileInfo = userProfileInfo;
              this.setButtonConfig();

              this.alertService.open('Friend request accepted', {appearance: 'positive'}).subscribe();
            });
        },
        error: (error) => logger.error(error),
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
      logger.error('No user profile id');
      return;
    }

    if (!this.userInfo) {
      void this.router.navigate(['/auth'], {
        queryParams: {returnUrl: `/users/${this.userProfileInfo?.username ?? userProfileId}`},
      });
      return;
    }

    this.loadingSubject$.next(true);
    this.socialService.createFriendshipRequest(userProfileId)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: (userProfileInfo) => {
          this.userProfileInfo = userProfileInfo;
          this.setButtonConfig();

          this.alertService.open('We notified user about your request', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to send friendship request'), {appearance: 'negative'}).subscribe();
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
        this.closed.emit();
      }
    }, 10);
  }
}
