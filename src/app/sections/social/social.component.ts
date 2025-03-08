import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  ViewChild
} from "@angular/core";
import {SocialService} from "./social.service";
import {TuiInputComponent, TuiInputModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {BehaviorSubject, combineLatest, EMPTY, finalize, firstValueFrom, Subject, takeUntil} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap} from "rxjs/operators";
import {FriendshipAction, FriendshipStatus, RelatedUserProfile, UserPublicProfile} from "./social.model";
import {AvatarComponent} from "../../shared/avatar/avatar.component";
import {
  TuiAlertService,
  TuiDataList,
  TuiDropdownDirective,
  TuiHintDirective,
  TuiIcon,
  TuiPopup,
  TuiScrollbar
} from "@taiga-ui/core";
import {NgClass, NgIf, NgStyle, NgTemplateOutlet} from "@angular/common";
import {
  TuiBadgedContentComponent,
  TuiBadgeNotification,
  TuiDataListDropdownManager,
  TuiDrawer,
  TuiSegmented,
  TuiSkeleton
} from "@taiga-ui/kit";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {UrlService} from "../../services/url.service";
import {TranslateModule} from "@ngx-translate/core";

import {
  AvatarContext,
  AvatarLocation,
  ChannelActionsContext,
  ChannelHeaderInfoContext,
  ChannelService,
  ChatClientService,
  CustomTemplatesService,
  DefaultStreamChatGenerics,
  MessageActionsBoxContext,
  MessageService,
  StreamAutocompleteTextareaModule,
  StreamChatModule,
  StreamI18nService
} from "stream-chat-angular";
import {Channel, StreamChat, User} from "stream-chat";
import {environment} from "../../../environments/environment";
import {UserInfo} from "../../models/userinfo.model";
import {UserInfoService} from "../../services/user-info.service";
import {ChatHeaderComponent} from "./ chat-header/chat-header.component";
import {ChatUnreadService} from "./chat-unread.service";
import {AppConstants} from "../../app.constants";
import {CustomChatAvatarComponent} from "./custom-chat-avatar/custom-chat-avatar.component";
import {TuiActiveZone} from "@taiga-ui/cdk";
import {ConfirmModalComponent} from "../../shared/modals/confirm-modal/confirm-modal.component";
import {ButtonComponent} from "../../shared/button/button.component";
import {OverlayscrollbarsModule} from "overlayscrollbars-ngx";

@Component({
  selector: 'app-social',
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.less'],
  imports: [
    TuiInputModule,
    ReactiveFormsModule,
    TuiTextfieldControllerModule,
    AvatarComponent,
    SharedLucideIconsModule,
    NgClass,
    TuiSegmented,
    TuiPopup,
    TuiDrawer,
    DismissButtonComponent,
    TuiScrollbar,
    TuiSkeleton,
    NgTemplateOutlet,
    StreamChatModule,
    TranslateModule,
    StreamAutocompleteTextareaModule,
    StreamChatModule,
    NgIf,
    ChatHeaderComponent,
    TuiDataList,
    TuiDataListDropdownManager,
    AvatarComponent,
    CustomChatAvatarComponent,
    TuiActiveZone,
    NgStyle,
    TuiHintDirective,
    ConfirmModalComponent,
    ButtonComponent,
    TuiIcon,
    OverlayscrollbarsModule,
    RouterLink,
    TuiBadgeNotification,
    TuiBadgedContentComponent,
  ]
})
export class SocialComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('channelPreview', {static: true}) channelPreview!: TemplateRef<any>;
  @ViewChild('customHeaderTemplate') headerTemplate!: TemplateRef<ChannelHeaderInfoContext>;
  @ViewChild('dropdownTemplate') dropdown!: TuiDropdownDirective;
  @ViewChild('avatarTemplate') avatarTemplate!: TemplateRef<AvatarContext>;
  @ViewChild('customChannelActions', {static: true}) customChannelActions!: TemplateRef<ChannelActionsContext>;
  @ViewChild('chatSearch') chatSearchField!: TuiInputComponent;
  @ViewChild('customMessageActions') customMessageActions!: TemplateRef<MessageActionsBoxContext>;

  private readonly destroy$ = new Subject<void>();
  private userInfo: UserInfo | null = null;

  protected usernameFormControl = new FormControl<string>('');
  protected friendFormControl = new FormControl<string>('');
  protected chatFormControl = new FormControl<string>('');
  protected nothingFound = false;
  protected matchedUsers: UserPublicProfile[] = [];
  protected requestedIds: string[] = [];
  protected outgoingRequests: RelatedUserProfile[] = [];
  protected incomingRequests: RelatedUserProfile[] = [];
  protected drawerUserTiles: RelatedUserProfile[] = [];
  protected blockedUsers: RelatedUserProfile[] = [];
  protected friends: RelatedUserProfile[] = [];
  protected requestsIndex: number = 0;
  protected incomingRequestsCount = 0;
  // drawer
  protected readonly isDrawerOpened = signal(false);
  protected drawerMode: 'requests' | 'friends' | 'blocked' | 'search' | 'menu' = 'menu';
  protected drawerHeader: string = 'Menu';
  protected loadingFriends: boolean = false;
  protected loadingBlocked: boolean = false;
  protected loadingIncomingRequests: boolean = false;
  protected loadingOutgoingRequests: boolean = false;
  protected noResultMessage: string = 'No results found';
  protected drawerIcon: string = 'menu';

  protected readonly FriendshipStatus = FriendshipStatus;
  protected showHiddenChannels$ = new BehaviorSubject<boolean>(false); // ✅ Tracks changes

  // confirm modal settings
  protected isConfirmModalVisible: boolean = false;
  protected modalTitle = '';
  protected modalMessage = '';
  protected modalConfirmText = '';
  protected modalAction: (() => void) | null = null;
  protected useCountdown: boolean = false;

  // CHATS
  private chatClient: StreamChat;
  protected displayAs: 'text' | 'html';
  protected hoveredChannel: Channel<DefaultStreamChatGenerics> | null = null;
  protected showContent = false;
  protected hoverTimeout: any;
  protected isChatOpen: boolean = false;
  protected filteredActions: string[] = [
    "cast-poll-vote",
    "connect-events",
    "create-attachment",
    "delete-channel",
    "delete-own-message",
    "join-channel",
    "leave-channel",
    "mute-channel",
    "query-poll-votes",
    "quote-message",
    "read-events",
    "search-messages",
    "send-custom-events",
    "send-links",
    "send-message",
    "send-poll",
    "send-reaction",
    "send-typing-events",
    "typing-events",
    "update-channel",
    "update-channel-members",
    "update-own-message",
    "upload-file"
  ];

  constructor(
    private socialService: SocialService,
    private alertService: TuiAlertService,
    private urlService: UrlService,
    private activatedRoute: ActivatedRoute,
    private chatService: ChatClientService,
    private channelService: ChannelService,
    private streamI18nService: StreamI18nService,
    private userInfoService: UserInfoService,
    private customTemplatesService: CustomTemplatesService,
    private messageService: MessageService,
    private chatUnreadService: ChatUnreadService,
    private cdr: ChangeDetectorRef,
  ) {
    this.chatClient = StreamChat.getInstance(environment.streamChatApiKey);
    this.displayAs = this.messageService.displayAs;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.channelService.deselectActiveChannel();
  }

  async ngOnInit() {
    this.chatFormControl.valueChanges.subscribe(value => console.log("🔄 Input Changed:", value));

    this.chatFormControl.valueChanges
      .pipe(
        distinctUntilChanged(),
        debounceTime(300)
      )
      .subscribe(value => {
        if (value === null) {
          return;
        }
        const trimmedValue = value.trim();
        if (value !== trimmedValue) {
          this.chatFormControl.setValue(trimmedValue, {emitEvent: false}); // Prevent infinite loop
        }
      });
    this.channelService.activeChannel$
      .pipe(distinctUntilChanged(), startWith(await firstValueFrom(this.channelService.activeChannel$)))
      .subscribe((channel) => {
        if (channel) {
          this.setChatTitle(channel);
          this.openChat();
        }
        this.chatUnreadService.fetchUnreadCount();
      });

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
      this.channelService.init({members: {$in: [this.userInfo.id]}}, undefined, undefined, false).then();
      this.chatUnreadService.fetchUnreadCount();
    });

    this.streamI18nService.setTranslation();

    this.activatedRoute.queryParams.subscribe(params => {
      if (params['tab'] === 'friends') {
        this.drawerMode = 'friends';
        this.openDrawerAndSetupData();
      }
      if (params['requests'] === 'received') {
        this.drawerMode = 'requests';
        this.requestsIndex = 0;
        this.openDrawerAndSetupData();
      }
      if (params['requests'] === 'sent') {
        this.drawerMode = 'requests';
        this.requestsIndex = 1;
        this.openDrawerAndSetupData();
      }
      this.urlService.clearUrl();
    });

    this.getIncomingRequests();

    this.listenToUsernameField();
    this.listenToFriendSearch();
    this.listenToChannelSearch();
  }

  protected listenToFriendSearch() {
    this.friendFormControl.valueChanges.subscribe(value => {
      if (value === null) return;
      this.drawerUserTiles = this.friends.filter(friend => friend.username.toLowerCase().includes(value.toLowerCase()));
    });
  }

  ngAfterViewInit() {
    this.customTemplatesService.channelPreviewInfoTemplate$.next(this.channelPreview);
    this.customTemplatesService.channelHeaderInfoTemplate$.next(this.headerTemplate);
    this.customTemplatesService.avatarTemplate$.next(this.avatarTemplate);
    this.customTemplatesService.channelActionsTemplate$.next(this.customChannelActions);
    this.customTemplatesService.messageActionsBoxTemplate$.next(this.customMessageActions);
  }

  private setChatTitle(channel: Channel<DefaultStreamChatGenerics>) {
    setTimeout(() => {
      const chatTitleElement = document.querySelector('[data-testid="name"]');
      if (!chatTitleElement) return;

      chatTitleElement.textContent = this.getChatName(channel, channel.data?.name || AppConstants.PRIVATE_CHAT_NAME);
      this.cdr.detectChanges();
    }, 1);
  }

  /**
   * Creates a private 1-on-1 (P2P) chat channel between two users.
   * @param userId The current user's ID (should already be connected).
   * @param recipientId The user ID of the person they want to chat with.
   * @param friendshipId The ID of the friendship between the two users.
   * @returns A promise that resolves with the created channel.
   */
  async createPrivateChat(userId: string, recipientId: string, friendshipId: string) {
    if (!this.chatClient.user) {
      throw new Error('User must be connected before creating a chat.');
    }

    // Unique channel ID (e.g., `private_user1_user2`)
    const channelId = `private_${friendshipId}`;

    const channel = this.chatService.chatClient.channel('messaging', channelId, {
      name: AppConstants.PRIVATE_CHAT_NAME,
      members: [userId, recipientId], // Both users in the private chat
      created_by_id: userId, // Set creator
    });

    await channel.create(); // Ensure the channel is created
    await channel.watch();  // ✅ Fix: Wait for the channel to be initialized

    console.log('Private chat created and watched:', channelId);

    return channel;
  }

  private listenToUsernameField() {
    this.usernameFormControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        map((username) => {
          const sanitizedUsername = this.sanitizeUsername(username);
          this.usernameFormControl.setValue(sanitizedUsername, {emitEvent: false}); // ✅ Update FormControl value
          return sanitizedUsername;
        }),
        switchMap((username) => {
          if (username.length < 3) {
            this.matchedUsers = [];
            this.nothingFound = false;
            return [];
          }
          return this.socialService.searchAllByUsername(username).pipe(
            catchError(() => {
              this.nothingFound = true;
              return [];
            })
          );
        })
      )
      .subscribe((friends: UserPublicProfile[]) => {
        this.matchedUsers = friends;
        this.nothingFound = friends.length === 0;
      });
  }

  private sanitizeUsername(username: string | null): string {
    if (!username) return "";
    return username
      .trim() // ✅ Remove spaces before/after
      .toLowerCase() // ✅ Convert to lowercase
      .replace(/\s+/g, "") // ✅ Remove spaces inside
      .replace(/-/g, "_") // ✅ Replace "-" with "_"
      .replace(/[^a-z0-9_]/g, ""); // ✅ Remove all other disallowed characters
  }

  private listenToChannelSearch() {
    combineLatest([
      this.chatFormControl.valueChanges.pipe(
        startWith(this.chatFormControl.value || ''),
        debounceTime(300),
        distinctUntilChanged()
      ),
      this.showHiddenChannels$,
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(async ([query]) => {
          const user = await firstValueFrom(this.chatService.user$); // ✅ Get user only when needed
          if (!user) return;

          const trimmedQuery = query?.trim(); // ✅ Remove spaces to avoid invalid queries

          if (!trimmedQuery) {
            this.reloadChannelList();
            return EMPTY; // Prevent API calls if the query is empty
          }

          // 🔹 Filters for user’s channels (membership required)
          const filterWithMembership: Record<string, any> = {
            members: {$in: [user.id]}, // Ensure the user is a member of the channels
          };

          let orConditions: any[] = [];

          if (trimmedQuery) {
            orConditions.push(
              {
                "member.user.name": {$autocomplete: trimmedQuery},
                name: AppConstants.PRIVATE_CHAT_NAME,
                hidden: this.showHiddenChannels$.value,
              },
            );

            // ✅ Include "Saved Messages" if the query matches its name
            if (AppConstants.SELF_CHAT_NAME.toLowerCase().includes(trimmedQuery.toLowerCase())) {
              orConditions.push(
                {
                  name: {$eq: AppConstants.SELF_CHAT_NAME},
                  ...filterWithMembership
                });
            }
          }

          // 🔹 Filters for **public (broadcast) channels**, regardless of membership
          const filterForPublicChannels: Record<string, any> = {
            type: "broadcast",
            name: {$autocomplete: trimmedQuery},
            hidden: this.showHiddenChannels$.value,
          };

          // ✅ Fix: Always include broadcast channels (including Almonium) in $or
          if (orConditions.length > 0) {
            orConditions.push(filterForPublicChannels);
          } else {
            // If no other conditions exist, we still need the broadcast filter
            orConditions = [filterForPublicChannels];
          }

          let finalFilters: Record<string, any> = {$or: orConditions};
          console.log('Final filters:', finalFilters);
          try {
            this.channelService.reset();
            await this.channelService.init(finalFilters, undefined, undefined, false);
            return [];
          } catch (error) {
            console.error("Error fetching channels:", error);
            return EMPTY;
          }
        })
      )
      .subscribe();
  }

  range(n: number): number[] {
    return Array.from({length: n}, (_, i) => i);
  }

  getOutgoingRequests() {
    this.loadingOutgoingRequests = true;
    this.socialService.getOutgoingRequests().subscribe(outgoingRequests => {
      this.outgoingRequests = outgoingRequests;
      this.drawerUserTiles = outgoingRequests;
      this.loadingOutgoingRequests = false;
    });
  }

  getIncomingRequests() {
    this.loadingIncomingRequests = true;
    this.socialService.getIncomingRequests().subscribe(incomingRequests => {
      this.incomingRequests = incomingRequests;
      this.drawerUserTiles = incomingRequests;
      this.loadingIncomingRequests = false;
      this.incomingRequestsCount = incomingRequests.length;
    });
  }

  getFriends() {
    this.loadingFriends = true;
    this.socialService.getFriends().subscribe(friends => {
      this.friends = friends;
      this.drawerUserTiles = friends;
      this.loadingFriends = false;
    });
  }

  getBlocked() {
    this.loadingBlocked = true;
    this.socialService.getBlocked().subscribe(blocked => {
      this.blockedUsers = blocked;
      this.drawerUserTiles = blocked;
      this.loadingBlocked = false;
    });
  }

  openChatWithFriend(friend: RelatedUserProfile) {
    this.closeDrawer();

    const cid = 'messaging:private_' + friend.friendshipId;
    this.openChatByCid(cid).then((found) => {
      if (!found) {
        this.createPrivateChat(this.userInfo!.id, friend.id, friend.friendshipId).then(channel => {
          this.channelService.setAsActiveChannel(channel);
        });
      }
    });
  }

  async openChatByCid(id: string): Promise<boolean> {
    const filters = {
      cid: {$eq: id},
    };

    const channels = await this.chatService.chatClient.queryChannels(filters);
    if (channels.length > 0) {
      this.channelService.setAsActiveChannel(channels[0]);
      return true;
    } else {
      return false;
    }
  }

  // to avoid multiple requests
  protected sendRequestInProgressIds = new Set<string>();
  protected unblockInProgressIds = new Set<string>();
  protected acceptInProgressIds = new Set<string>();
  protected rejectInProgressIds = new Set<string>();
  protected cancelInProgressIds = new Set<string>();

  cancelFriendRequest(friendshipId: string) {
    if (this.cancelInProgressIds.has(friendshipId)) {
      console.warn('Cancel request already in progress');
      return;
    }
    this.cancelInProgressIds.add(friendshipId);

    this.socialService.patchFriendship(friendshipId, FriendshipAction.CANCEL)
      .pipe(finalize(() => this.cancelInProgressIds.delete(friendshipId)))
      .subscribe({
        next: () => {
          this.outgoingRequests = this.outgoingRequests.filter(request => request.friendshipId !== friendshipId);
          this.drawerUserTiles = this.outgoingRequests;
          this.alertService.open('Friend request cancelled', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to cancel friendship request', {appearance: 'error'}).subscribe();
        }
      });
  }

  acceptFriendRequest(candidate: RelatedUserProfile) {
    if (this.acceptInProgressIds.has(candidate.friendshipId)) {
      console.warn('Accept request already in progress');
      return;
    }

    this.acceptInProgressIds.add(candidate.friendshipId);
    console.log(this.acceptInProgressIds);

    this.socialService.patchFriendship(candidate.friendshipId, FriendshipAction.ACCEPT)
      .subscribe({
        next: () => {
          this.createPrivateChat(this.userInfo!.id, candidate.id.toString(), candidate.friendshipId).then(_ => {
            this.incomingRequestsCount--;
            this.incomingRequests
              .filter(profile => profile === candidate)
              .map(profile => profile.friendshipStatus = FriendshipStatus.FRIENDS);
            this.acceptInProgressIds.delete(candidate.friendshipId);
          })
          this.alertService.open('Friend request accepted', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to accept friendship request', {appearance: 'error'}).subscribe();
          this.acceptInProgressIds.delete(candidate.friendshipId);
        }
      });
  }

  rejectFriendRequest(id: string) {
    if (this.rejectInProgressIds.has(id)) {
      console.warn('Reject request already in progress');
      return;
    }
    this.rejectInProgressIds.add(id);

    this.socialService.patchFriendship(id, FriendshipAction.REJECT)
      .pipe(finalize(() => this.rejectInProgressIds.delete(id)))
      .subscribe({
        next: () => {
          console.log(JSON.stringify(this.incomingRequests));
          this.incomingRequests = this.incomingRequests.filter(request => request.friendshipId !== id);
          console.log(JSON.stringify(this.incomingRequests));
          this.alertService.open('Friend request rejected', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to reject friendship request', {appearance: 'error'}).subscribe();
        }
      });
  }

  unblock(friendId: string, friendshipId: string) {
    if (this.unblockInProgressIds.has(friendshipId)) {
      console.warn('Unblock request already in progress');
      return;
    }
    this.unblockInProgressIds.add(friendshipId);

    this.chatClient.unBlockUser(friendId.toString()).then(() => {
    });
    this.socialService.patchFriendship(friendshipId, FriendshipAction.UNBLOCK)
      .pipe(finalize(() => this.unblockInProgressIds.delete(friendshipId)))
      .subscribe({
        next: () => {
          this.blockedUsers = this.blockedUsers.filter(user => user.id !== friendId);
          this.drawerUserTiles = this.blockedUsers;
          this.alertService.open('User unblocked', {appearance: 'success'}).subscribe();
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to unblock user', {appearance: 'error'}).subscribe();
        }
      });
  }

  sendFriendRequest(id: string) {
    if (this.requestedIds.includes(id)) {
      console.warn('Request already sent');
      return;
    }

    if (this.sendRequestInProgressIds.has(id)) {
      console.warn('Request already in progress');
      return;
    }

    this.sendRequestInProgressIds.add(id);

    this.socialService.createFriendshipRequest(id)
      .pipe(finalize(() => this.sendRequestInProgressIds.delete(id)))
      .subscribe({
        next: (friendship) => {
          console.log(friendship);
          this.alertService.open('We notified user about your request', {appearance: 'success'}).subscribe();
          this.requestedIds.push(id);

          setTimeout(() => {
            this.matchedUsers = this.matchedUsers.filter(user => user.id !== id);
            this.requestedIds = this.requestedIds.filter(requestedId => requestedId !== id);
          }, 2000);
        },
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to send friendship request', {appearance: 'error'}).subscribe();
        }
      });
  }

  unfriend(friendId: string, friendshipId: string) {
    this.socialService.patchFriendship(friendshipId, FriendshipAction.UNFRIEND).subscribe({
      next: () => {
        this.friends = this.friends.filter(friend => friend.id !== friendId);
        this.drawerUserTiles = this.friends;
        this.alertService.open('That user is no longer your friend', {appearance: 'success'}).subscribe();
        this.setDrawerMode('friends');
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to remove friend', {appearance: 'error'}).subscribe();
      }
    });
  }

  block(friendId: string, friendshipId: string) {
    this.chatClient.blockUser(friendId.toString()).then(() => {
    });
    this.socialService.patchFriendship(friendshipId, FriendshipAction.BLOCK).subscribe({
      next: () => {
        this.friends = this.friends.filter(friend => friend.id !== friendId);
        this.drawerUserTiles = this.friends;
        this.alertService.open('User blocked', {appearance: 'success'}).subscribe();
        this.setDrawerMode('blocked');
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to block user', {appearance: 'error'}).subscribe();
      }
    });
  }

  protected openDrawerAndSetupData() {
    this.openDrawer();
    if (this.drawerMode === 'menu') {
      this.menuSetup();
    } else {
      this.drawerIcon = 'chevron-left';
    }
    if (this.drawerMode === 'requests') {
      this.drawerHeader = 'Requests';

      if (this.requestsIndex === 0) {
        this.getIncomingRequests();
        this.noResultMessage = `You have no incoming friend requests.`;
      } else {
        this.getOutgoingRequests();
        this.noResultMessage = `You have no outgoing friend requests.`;
      }
    }
    if (this.drawerMode === 'friends') {
      this.drawerHeader = 'Friends';
      this.getFriends();
      this.noResultMessage = `You don't have any friends yet.`;
    }
    if (this.drawerMode === 'blocked') {
      this.drawerHeader = 'Blocked';
      this.noResultMessage = `You haven't blocked anyone.`;
      this.getBlocked();
    }
    if (this.drawerMode === 'search') {
      this.drawerHeader = 'Search';
    }
  }

  protected isDrawerDataLoading() {
    if (this.drawerMode === 'requests') {
      return this.requestsIndex === 0 ? this.loadingIncomingRequests : this.loadingOutgoingRequests;
    }
    if (this.drawerMode === 'friends') {
      return this.loadingFriends;
    }
    if (this.drawerMode === 'blocked') {
      return this.loadingBlocked;
    }
    return false;
  }

  public openDrawer(): void {
    this.isDrawerOpened.set(true);
  }

  public closeDrawer(): void {
    this.isDrawerOpened.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(_: KeyboardEvent) {
    this.isDrawerOpened.set(false);
  }

  protected getChatName(channel: Channel<DefaultStreamChatGenerics>, defaultName: string): string {
    if (defaultName !== AppConstants.PRIVATE_CHAT_NAME) {
      return defaultName;
    }

    const currentUserId = this.chatService.chatClient.userID;

    // Get the other user in the channel
    const otherMember = Object.values(channel.state.members).find(
      (member) => member.user?.id !== currentUserId
    );

    return otherMember?.user?.name || AppConstants.PRIVATE_CHAT_NAME;
  }

  hideChat(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.hide().then(() => {
      });
    }, 30);
  }

  showChat(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.show().then(() => {
        this.reloadChannelList();
      });
    }, 30);
  }

  muteChat(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.mute().then(() => {
      });
    }, 30);
  }

  isUnread(channel: Channel<DefaultStreamChatGenerics>) {
    return channel.countUnread() > 0;
  }

  isLastMessageFromOtherUser(channel: Channel<DefaultStreamChatGenerics>): boolean {
    const lastMessage = channel.state.messages[channel.state.messages.length - 1];
    return (lastMessage && lastMessage.user?.id !== this.chatService.chatClient.userID);
  }

  markAsRead(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.markRead().then(() => {
      });
    }, 30);
  }

  markAsUnread(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      const lastMessage = channel.state.messages[channel.state.messages.length - 1];

      // Only mark as unread if the last message was sent by someone else
      if (lastMessage && this.isLastMessageFromOtherUser(channel)) {
        channel.markUnread({message_id: lastMessage.id}).then(() => {
        }).catch(err => console.error('Mark as unread failed', err));
      } else {
        console.warn('Cannot mark as unread: No valid message from another user');
      }
    }, 30);
  }

  unmuteChat(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.unmute().then(() => {
      });
    }, 30);
  }

  isChannelMuted(channel: Channel<DefaultStreamChatGenerics>): boolean {
    return channel.muteStatus().muted;
  }

  isPrivateChat(channel: Channel<DefaultStreamChatGenerics>) {
    return channel.data?.name === AppConstants.PRIVATE_CHAT_NAME;
  }

  isSelfChat(channel: Channel<DefaultStreamChatGenerics>) {
    return channel.data?.name === AppConstants.SELF_CHAT_NAME;
  }

  isPublicChannel(channel: Channel<DefaultStreamChatGenerics>) {
    return !this.isPrivateChat(channel) && !this.isSelfChat(channel);
  }

  isHiddenChannel(channel: Channel<DefaultStreamChatGenerics>) {
    return channel.data?.hidden;
  }

  toggleHiddenChats() {
    this.showHiddenChannels$.next(!this.showHiddenChannels$.value);
  }

  reloadChannelList() {
    this.channelService.reset();
    this.channelService.init({
      hidden: this.showHiddenChannels$.value,
      members: {$in: [this.userInfo!.id]}
    }, undefined, undefined, false).then(() => {
    });
  }

  joinChannel(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.addMembers([this.userInfo!.id]).then(() => {
        this.chatFormControl.setValue('');
        setTimeout(() => {
          this.channelService.setAsActiveChannel(channel);
        }, 600);
      });
    }, 30);
  }

  amMember(channel: Channel<DefaultStreamChatGenerics>): boolean {
    return channel.state.members[this.userInfo!.id] !== undefined
  }

  getInterlocutorId(): string | null {
    // Ensure hoveredChannel and members exist
    if (!this.hoveredChannel?.state?.members) {
      return null;
    }

    // Find the first member who is NOT the current user
    const interlocutor = Object.values(this.hoveredChannel.state.members).find(
      (member) => member.user?.id !== this.userInfo!.id
    );

    // Return their ID or null if not found
    return interlocutor ? interlocutor.user?.id ?? null : null
  }

  startAvatarHover(channel: Channel<DefaultStreamChatGenerics>) {
    this.hoveredChannel = channel;
    this.hoverTimeout = setTimeout(() => this.showContent = true, 1000);
  }

  stopAvatarHover() {
    this.hoveredChannel = null;
    clearTimeout(this.hoverTimeout);
    this.showContent = false;
  }

  openUser(location: AvatarLocation) {
    if (location === 'channel-preview' && this.isPrivateChat(this.hoveredChannel!)) {
      const interlocutorId = this.getInterlocutorId();
      console.log('Opening chat with user:', interlocutorId);
    }
  }

  onRequestsIndexChange($event: number) {
    this.requestsIndex = $event;
    this.openDrawerAndSetupData();
  }

  openFriendDropdown(id: string) {
    console.log('Opening dropdown for friend:', id);
  }

  setDrawerMode(mode: string) {
    this.drawerMode = mode as 'requests' | 'friends' | 'blocked' | 'menu';
    this.openDrawerAndSetupData();
  }

  menuSetup() {
    this.matchedUsers = [];
    this.drawerHeader = 'Menu';
    this.friendFormControl.setValue('');
    this.usernameFormControl.setValue('');
    this.drawerIcon = 'menu';
    this.drawerUserTiles = [];
  }

  openChat() {
    this.isChatOpen = true;
  }

  backToChannels() {
    this.isChatOpen = false;
  }

  openSearch() {
    if (!this.isCollapsed) return;
    this.isCollapsed = false;
    this.isManuallyResized = true;
    this.sidebarWidth = window.innerWidth / 3 - 8;
    setTimeout(() => {
      this.chatSearchField?.nativeFocusableElement?.focus();
    }, 100);
  }

  sidebarWidth = window.innerWidth / 3 - 8;
  isResizing = false;
  isCollapsed = false;
  isManuallyResized = false;

  startResizing(event: MouseEvent) {
    if (window.innerWidth < 640) return;
    this.isResizing = true;
    this.isManuallyResized = true;
    document.addEventListener('mousemove', this.resizeSidebar);
    document.addEventListener('mouseup', this.stopResizing);
  }

  resizeSidebar = (event: MouseEvent) => {
    if (!this.isResizing) return;

    let newWidth = event.clientX;

    // Collapse to avatar mode if width is too small
    if (newWidth < 68) {
      this.sidebarWidth = 68;
      this.isCollapsed = true;
    } else if (newWidth > 600) {
      this.sidebarWidth = 600; // Prevent exceeding max width
      this.isCollapsed = false;
    } else {
      this.sidebarWidth = newWidth;
      this.isCollapsed = false;
    }
  };

  stopResizing = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.resizeSidebar);
    document.removeEventListener('mouseup', this.stopResizing);
  };

  get hiddenChatsTooltip() {
    return this.showHiddenChannels$.value ? 'Switch to visible chats' : 'Switch to hidden chats';
  }

  // confirm modal chats
  protected targetChannel: Channel<DefaultStreamChatGenerics> | null = null;

  protected prepareConfirmModalForChatDeletion(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);
    this.targetChannel = channel;

    this.modalTitle = 'Delete Chat';
    this.modalMessage = 'Are you sure? This action cannot be undone';
    this.modalConfirmText = 'Delete';
    this.modalAction = this.deleteChat.bind(this);
    this.useCountdown = false;
    this.isConfirmModalVisible = true;
  }

  protected deleteChat() {
    if (!this.targetChannel) {
      console.error('Channel to delete is not set');
      return;
    }

    this.targetChannel.delete().then(() => {
      this.targetChannel = null;
    });
  }

  protected prepareChatTruncationConfirmationModal(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);
    this.targetChannel = channel;

    this.modalTitle = 'Clear Chat History';
    this.modalMessage = 'Are you sure? This action cannot be undone';
    this.modalConfirmText = 'Clear';
    this.modalAction = this.clearChat.bind(this);
    this.useCountdown = false;
    this.isConfirmModalVisible = true;
  }

  protected clearChat() {
    if (!this.targetChannel) {
      console.error('Channel to clear is not set');
      return;
    }

    this.targetChannel.truncate().then(() => {
      this.targetChannel = null;
    });
  }

  protected prepareLeaveChannelModal(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);
    this.targetChannel = channel;

    this.modalTitle = 'Leave Channel';
    this.modalMessage = 'Are you sure? You will no longer receive messages from this channel. You can rejoin later.';
    this.modalConfirmText = 'Leave';
    this.modalAction = this.leaveChannel.bind(this);
    this.useCountdown = false;
    this.isConfirmModalVisible = true;
  }

  protected leaveChannel() {
    if (!this.targetChannel) {
      console.error('Channel to clear is not set');
      return;
    }

    this.targetChannel.show().then();
    this.targetChannel.unmute().then();
    this.targetChannel.removeMembers([this.userInfo!.id]).then(() => {
    });
  }

  protected prepareUnfriendModal(friendId: string, friendshipId: string) {
    this.closeDrawer();
    this.modalTitle = 'Unfriend';
    this.modalMessage = 'Are you sure you want to unfriend this user?';
    this.modalConfirmText = 'Unfriend';
    this.modalAction = () => this.unfriend(friendId, friendshipId);
    this.isConfirmModalVisible = true;
  }

  protected prepareBlockModal(friendId: string, friendshipId: string) {
    this.closeDrawer();
    this.modalTitle = 'Block User';
    this.modalMessage = 'Are you sure you want to block this user?';
    this.modalConfirmText = 'Block';
    this.modalAction = () => this.block(friendId, friendshipId);
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
}
