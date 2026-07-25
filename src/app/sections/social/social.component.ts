import {logger} from "../../shared/logger";
import {getErrorMessage} from '../../shared/http-error';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, signal, TemplateRef, ViewChild, inject } from "@angular/core";
import {SocialService} from "./social.service";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {BehaviorSubject, combineLatest, EMPTY, filter, finalize, firstValueFrom, of, Subject, takeUntil} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap} from "rxjs/operators";
import {PublicUserProfile, RelatedUserProfile, RelationshipAction, RelationshipStatus} from "./social.model";
import {AvatarComponent} from "../../shared/avatar/avatar.component";
import {TuiDataList, TuiIcon, TuiNotificationService, TuiScrollbar, TuiTextfieldComponent, TuiTextfieldOptionsDirective} from "@taiga-ui/core/components";
import {TuiDropdownDirective, TuiDropdownManual, TuiHintDirective, TuiPopup} from "@taiga-ui/core/portals";
import {NgClass, NgStyle, NgTemplateOutlet} from "@angular/common";
import {
  TuiBadgedContentComponent,
  TuiBadgeNotification,
  TuiDrawer,
  TuiSegmented
} from "@taiga-ui/kit/components";
import {TuiDataListDropdownManager, TuiSkeleton} from "@taiga-ui/kit/directives";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ActivatedRoute, Params, RouterLink} from "@angular/router";
import {UrlService} from "../../services/url.service";
import {TranslateModule} from "@ngx-translate/core";

import {
  AvatarContext,
  AvatarLocation,
  ChannelActionsContext,
  ChannelHeaderInfoContext,
  ChannelPreviewInfoContext,
  ChannelService,
  ChatClientService,
  CustomTemplatesService,
  MessageActionsBoxContext,
  MessageService,
  StreamAutocompleteTextareaModule,
  StreamChatModule,
  StreamI18nService
} from "stream-chat-angular";
import {Channel, ChannelFilters, StreamChat, User} from "stream-chat";
import {environment} from "../../../environments/environment";
import {UserInfo} from "../../models/userinfo.model";
import {UserInfoService} from "../../services/user-info.service";
import {ChatHeaderComponent} from "./chat-header/chat-header.component";
import {ChatUnreadService} from "./chat-unread.service";
import {AppConstants} from "../../app.constants";
import {CustomChatAvatarComponent} from "./custom-chat-avatar/custom-chat-avatar.component";
import {TuiActiveZone} from "@taiga-ui/cdk/directives";
import {ConfirmModalComponent} from "../../shared/modals/confirm-modal/confirm-modal.component";
import {ButtonComponent} from "../../shared/button/button.component";
import {OverlayscrollbarsModule} from "overlayscrollbars-ngx";
import {UserPreviewCardComponent} from "../../shared/user-preview-card/user-preview-card.component";
import {SocialChannelFacade} from './social-channel.facade';
import {SocialSidebarResizeDirective} from './social-sidebar-resize.directive';
import {SocialConfirmationService} from './social-confirmation.service';

@Component({
  selector: 'app-social',
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.less'],
  imports: [
    ReactiveFormsModule,
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
    ChatHeaderComponent,
    TuiDataList,
    TuiDataListDropdownManager,
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
    UserPreviewCardComponent,
    TuiTextfieldComponent,
    TuiDropdownDirective,
    TuiDropdownManual,
    TuiTextfieldOptionsDirective,
    SocialSidebarResizeDirective,
  ],
  providers: [SocialChannelFacade, SocialConfirmationService],
})
export class SocialComponent implements OnInit, OnDestroy, AfterViewInit {
  private socialService = inject(SocialService);
  private alertService = inject(TuiNotificationService);
  private urlService = inject(UrlService);
  private activatedRoute = inject(ActivatedRoute);
  private chatService = inject(ChatClientService);
  private channelService = inject(ChannelService);
  private streamI18nService = inject(StreamI18nService);
  private userInfoService = inject(UserInfoService);
  private customTemplatesService = inject(CustomTemplatesService);
  private messageService = inject(MessageService);
  private chatUnreadService = inject(ChatUnreadService);
  private cdr = inject(ChangeDetectorRef);
  protected channels = inject(SocialChannelFacade);
  protected confirmation = inject(SocialConfirmationService);

  @ViewChild('channelPreview', {static: true}) channelPreview!: TemplateRef<ChannelPreviewInfoContext>;
  @ViewChild('customHeaderTemplate') headerTemplate!: TemplateRef<ChannelHeaderInfoContext>;
  @ViewChild('dropdownTemplate') dropdown!: TuiDropdownDirective;
  @ViewChild('avatarTemplate') avatarTemplate!: TemplateRef<AvatarContext>;
  @ViewChild('customChannelActions', {static: true}) customChannelActions!: TemplateRef<ChannelActionsContext>;
  @ViewChild('chatSearch', {read: ElementRef}) chatInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('customMessageActions') customMessageActions!: TemplateRef<MessageActionsBoxContext>;
  @ViewChild(SocialSidebarResizeDirective) sidebarResize!: SocialSidebarResizeDirective;

  private readonly destroy$ = new Subject<void>();
  private userInfo: UserInfo | null = null;

  protected usernameFormControl = new FormControl<string>('');
  protected friendFormControl = new FormControl<string>('');
  protected chatFormControl = new FormControl<string>('');
  protected nothingFound = false;
  protected matchedUsers: PublicUserProfile[] = [];
  protected requestedIds: string[] = [];
  protected outgoingRequests: RelatedUserProfile[] = [];
  protected incomingRequests: RelatedUserProfile[] = [];
  protected drawerUserTiles: RelatedUserProfile[] = [];
  protected blockedUsers: RelatedUserProfile[] = [];
  protected friends: RelatedUserProfile[] = [];
  protected requestsIndex = 0;
  protected incomingRequestsCount = 0;
  // drawer
  protected readonly isDrawerOpened = signal(false);
  protected drawerMode: 'requests' | 'friends' | 'blocked' | 'search' | 'menu' = 'menu';
  protected drawerHeader = 'Menu';
  protected loadingFriends = false;
  protected loadingBlocked = false;
  protected loadingIncomingRequests = false;
  protected loadingOutgoingRequests = false;
  protected noResultMessage = 'No results found';
  protected drawerIcon = 'menu';

  protected readonly FriendshipStatus = RelationshipStatus;
  protected showHiddenChannels$ = new BehaviorSubject<boolean>(false); // ✅ Tracks changes

  // CHATS
  private chatClient: StreamChat;
  protected displayAs: 'text' | 'html';
  protected hoveredChannel: Channel | null = null;
  protected currentLocation = '';
  protected isChatOpen = false;
  protected redirectId: string | undefined = undefined;

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

  constructor() {
    this.chatClient = StreamChat.getInstance(environment.streamChatApiKey);
    this.displayAs = this.messageService.displayAs;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.channelService.deselectActiveChannel();
  }

  ngOnInit(): void {
    this.setupChatFormControl();

    combineLatest([
      this.userInfoService.userInfo$.pipe(filter(info => !!info)),
      this.activatedRoute.queryParams
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(([userInfo, params]) => {
      this.userInfo = userInfo;
      this.channels.setCurrentUser(userInfo.id);
      this.initializeChat(userInfo);

      this.handleQueryParams(params);
      // Initialize chat with user info

      // Now decide whether to open a specific chat or initialize channel service
      if (this.redirectId) {
        const cid = this.channels.friendshipCid(this.redirectId);
        setTimeout(() => {
          void this.openChatByCid(cid).then((found) => {
            if (!found) {
              logger.error("Could not find chat with cid:", cid);
            }
          });
        }, 300);
      } else {
        void this.channelService.init({members: {$in: [this.userInfo.id]}}, undefined, undefined, false);
      }
    });

    this.setupActiveChannelSubscription();
    this.streamI18nService.setTranslation();
    this.getIncomingRequests();
    this.listenToUsernameField();
    this.listenToFriendSearch();
    this.listenToChannelSearch();
  }

  private setupChatFormControl() {
    this.chatFormControl.valueChanges
      .pipe(
        distinctUntilChanged(),
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        if (value === null) {
          return;
        }
        const trimmedValue = value.trim();
        if (value !== trimmedValue) {
          this.chatFormControl.setValue(trimmedValue, {emitEvent: false});
        }
      });
  }

  private setupActiveChannelSubscription() {
    this.channelService.activeChannel$
      .pipe(
        distinctUntilChanged(),
        startWith(null),
        switchMap(channel => {
          if (!channel) {
            return of(null);
          }
          return firstValueFrom(of(channel));
        }),
        filter(channel => !!channel),
        takeUntil(this.destroy$)
      )
      .subscribe((channel) => {
        this.setChatTitle(channel);
        this.openChat();
        void this.chatUnreadService.fetchUnreadCount();
      });
  }

  private initializeChat(userInfo: UserInfo) {
    const userId = userInfo.id;
    const userToken = this.userInfoService.streamChatToken;
    if (!userToken) {
      logger.error('Cannot initialize chat without a server-issued Stream token.');
      return;
    }
    const userName = userInfo.username;
    const user: User = {
      id: userId,
      name: userName,
      image: userInfo.avatarUrl ?? `https://getstream.io/random_png/?name=${userName}`,
    };

    void this.chatService.init(environment.streamChatApiKey, user, userToken);
  }

  private handleQueryParams(params: Params) {
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
    const chat: unknown = params['chat'];
    if (typeof chat === 'string') {
      this.redirectId = chat;
      logger.debug('Redirecting to chat with cid:', this.channels.friendshipCid(this.redirectId));
    }
    this.urlService.clearUrl();
  }

  protected listenToFriendSearch() {
    this.friendFormControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
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

  private setChatTitle(channel: Channel) {
    setTimeout(() => {
      const chatTitleElement = document.querySelector('[data-testid="name"]');
      if (!chatTitleElement) return;

      chatTitleElement.textContent = this.channels.name(channel, channel.data?.name ?? AppConstants.PRIVATE_CHAT_NAME);
      this.cdr.detectChanges();
    }, 1);
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
      .subscribe((friends: PublicUserProfile[]) => {
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
        startWith(this.chatFormControl.value ?? ''),
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
            this.channels.reload(this.showHiddenChannels$.value);
            return EMPTY; // Prevent API calls if the query is empty
          }

          // 🔹 Filters for user’s channels (membership required)
          const filterWithMembership: ChannelFilters = {
            members: {$in: [user.id]}, // Ensure the user is a member of the channels
          };

          let orConditions: ChannelFilters[] = [];

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
          const filterForPublicChannels: ChannelFilters = {
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

          const finalFilters: ChannelFilters = {
            $or: orConditions as [ChannelFilters, ChannelFilters, ...ChannelFilters[]],
          };

          try {
            this.channelService.reset();
            await this.channelService.init(finalFilters, undefined, undefined, false);
            return [];
          } catch (error) {
            logger.error("Error fetching channels:", error);
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

    const cid = this.channels.friendshipCid(friend.relationshipId);
    void this.openChatByCid(cid).then((found) => {
      if (!found) {
        void this.channels.createPrivateChat(friend.id, friend.relationshipId).then(channel => {
          this.channelService.setAsActiveChannel(channel);
        });
      }
    });
  }

  async openChatByCid(id: string): Promise<boolean> {
    return this.channels.openByCid(id);
  }

  // to avoid multiple requests
  protected sendRequestInProgressIds = new Set<string>();
  protected unblockInProgressIds = new Set<string>();
  protected acceptInProgressIds = new Set<string>();
  protected rejectInProgressIds = new Set<string>();
  protected cancelInProgressIds = new Set<string>();

  cancelFriendRequest(friendshipId: string) {
    if (this.cancelInProgressIds.has(friendshipId)) {
      logger.warn('Cancel request already in progress');
      return;
    }
    this.cancelInProgressIds.add(friendshipId);

    this.socialService.patchFriendship(friendshipId, RelationshipAction.CANCEL)
      .pipe(finalize(() => this.cancelInProgressIds.delete(friendshipId)))
      .subscribe({
        next: () => {
          this.outgoingRequests = this.outgoingRequests.filter(request => request.relationshipId !== friendshipId);
          this.drawerUserTiles = this.outgoingRequests;
          this.alertService.open('Friend request cancelled', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to cancel friendship request'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  acceptFriendRequest(candidate: RelatedUserProfile) {
    if (this.acceptInProgressIds.has(candidate.relationshipId)) {
      logger.warn('Accept request already in progress');
      return;
    }

    this.acceptInProgressIds.add(candidate.relationshipId);

    this.socialService.patchFriendship(candidate.relationshipId, RelationshipAction.ACCEPT)
      .subscribe({
        next: () => {
          void this.channels.createPrivateChat(candidate.id.toString(), candidate.relationshipId).then(() => {
            this.incomingRequestsCount--;
            this.incomingRequests
              .filter(profile => profile === candidate)
              .map(profile => profile.relationshipStatus = RelationshipStatus.FRIENDS);
            this.acceptInProgressIds.delete(candidate.relationshipId);
          })
          this.alertService.open('Friend request accepted', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to accept friendship request'), {appearance: 'negative'}).subscribe();
          this.acceptInProgressIds.delete(candidate.relationshipId);
        }
      });
  }

  rejectFriendRequest(id: string) {
    if (this.rejectInProgressIds.has(id)) {
      logger.warn('Reject request already in progress');
      return;
    }
    this.rejectInProgressIds.add(id);

    this.socialService.patchFriendship(id, RelationshipAction.REJECT)
      .pipe(finalize(() => this.rejectInProgressIds.delete(id)))
      .subscribe({
        next: () => {
          this.incomingRequests = this.incomingRequests.filter(request => request.relationshipId !== id);
          this.alertService.open('Friend request rejected', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to reject friendship request'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  unblock(friendId: string, friendshipId: string) {
    if (this.unblockInProgressIds.has(friendshipId)) {
      logger.warn('Unblock request already in progress');
      return;
    }
    this.unblockInProgressIds.add(friendshipId);

    void this.chatClient.unBlockUser(friendId.toString());
    this.socialService.patchFriendship(friendshipId, RelationshipAction.UNBLOCK)
      .pipe(finalize(() => this.unblockInProgressIds.delete(friendshipId)))
      .subscribe({
        next: () => {
          this.blockedUsers = this.blockedUsers.filter(user => user.id !== friendId);
          this.drawerUserTiles = this.blockedUsers;
          this.alertService.open('User unblocked', {appearance: 'positive'}).subscribe();
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to unblock user'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  sendFriendRequest(id: string) {
    if (this.requestedIds.includes(id)) {
      logger.warn('Request already sent');
      return;
    }

    if (this.sendRequestInProgressIds.has(id)) {
      logger.warn('Request already in progress');
      return;
    }

    this.sendRequestInProgressIds.add(id);

    this.socialService.createFriendshipRequest(id)
      .pipe(finalize(() => this.sendRequestInProgressIds.delete(id)))
      .subscribe({
        next: () => {
          this.alertService.open('We notified user about your request', {appearance: 'positive'}).subscribe();
          this.requestedIds.push(id);

          setTimeout(() => {
            this.matchedUsers = this.matchedUsers.filter(user => user.id !== id);
            this.requestedIds = this.requestedIds.filter(requestedId => requestedId !== id);
          }, 2000);
        },
        error: (error) => {
          logger.error(error);
          this.alertService.open(getErrorMessage(error, 'Failed to send friendship request'), {appearance: 'negative'}).subscribe();
        }
      });
  }

  unfriend(friendId: string, friendshipId: string) {
    this.socialService.patchFriendship(friendshipId, RelationshipAction.UNFRIEND).subscribe({
      next: () => {
        this.friends = this.friends.filter(friend => friend.id !== friendId);
        this.drawerUserTiles = this.friends;
        this.alertService.open('That user is no longer your friend', {appearance: 'positive'}).subscribe();
        this.setDrawerMode('friends');
      },
      error: (error) => {
        logger.error(error);
        this.alertService.open(getErrorMessage(error, 'Failed to remove friend'), {appearance: 'negative'}).subscribe();
      }
    });
  }

  block(friendId: string, friendshipId: string) {
    void this.chatClient.blockUser(friendId.toString());
    this.socialService.patchFriendship(friendshipId, RelationshipAction.BLOCK).subscribe({
      next: () => {
        this.friends = this.friends.filter(friend => friend.id !== friendId);
        this.drawerUserTiles = this.friends;
        this.alertService.open('User blocked', {appearance: 'positive'}).subscribe();
        this.setDrawerMode('blocked');
      },
      error: (error) => {
        logger.error(error);
        this.alertService.open(getErrorMessage(error, 'Failed to block user'), {appearance: 'negative'}).subscribe();
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

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    this.isDrawerOpened.set(false);
  }

  hideChat(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      void channel.hide();
    }, 30);
  }

  showChat(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      void channel.show().then(() => {
        this.channels.reload(this.showHiddenChannels$.value);
      });
    }, 30);
  }

  muteChat(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      void channel.mute();
    }, 30);
  }

  isUnread(channel: Channel) {
    return channel.countUnread() > 0;
  }

  isLastMessageFromOtherUser(channel: Channel): boolean {
    return this.channels.isLastMessageFromAnotherUser(channel);
  }

  markAsRead(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      void channel.markRead();
    }, 30);
  }

  markAsUnread(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      const lastMessage = channel.state.messages[channel.state.messages.length - 1];

      // Only mark as unread if the last message was sent by someone else
      if (lastMessage && this.isLastMessageFromOtherUser(channel)) {
        channel.markUnread({message_id: lastMessage.id}).catch(err => logger.error('Mark as unread failed', err));
      } else {
        logger.warn('Cannot mark as unread: No valid message from another user');
      }
    }, 30);
  }

  unmuteChat(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      void channel.unmute();
    }, 30);
  }

  isChannelMuted(channel: Channel): boolean {
    return channel.muteStatus().muted;
  }

  isHiddenChannel(channel: Channel) {
    return channel.data?.hidden;
  }

  toggleHiddenChats() {
    this.showHiddenChannels$.next(!this.showHiddenChannels$.value);
  }

  joinChannel(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      void this.channels.join(channel).then(() => {
        this.chatFormControl.setValue('');
      });
    }, 30);
  }

  protected hoveredInterlocutorId = undefined;

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

  startAvatarHover(channel: Channel, location: string) {
    this.hoveredChannel = channel;
    this.currentLocation = location;
  }

  private timeout?: ReturnType<typeof setTimeout>;

  stopAvatarHover() {
    this.timeout = setTimeout(() => {
      this.hoveredChannel = null;
      this.currentLocation = '';
    }, 200);
  }

  protected previewCardOnLeave() {
    this.stopAvatarHover()
  }

  previewCardOnHover() {
    clearTimeout(this.timeout);
  }

  openUser(location: AvatarLocation) {
    if (location === 'channel-preview' && this.channels.isPrivate(this.hoveredChannel!)) {
      const interlocutorId = this.getInterlocutorId();
      logger.info('Opening chat with user:', interlocutorId);
    }
  }

  private excludedLocations: AvatarLocation[] = ['channel-preview', 'channel-header'];

  shouldShowDropdown(channel: Channel, location: AvatarLocation): boolean {
    if (!this.excludedLocations.includes(location)) {
      return false;
    }

    const firstCheck = (this.currentLocation === location)
      && (this.hoveredChannel !== null)
      && this.channels.isPrivate(this.hoveredChannel);

    return firstCheck && channel.cid === this.hoveredChannel?.cid;
  }

  onRequestsIndexChange($event: number) {
    this.requestsIndex = $event;
    this.openDrawerAndSetupData();
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
    if (!this.sidebarResize.isCollapsed) return;
    this.sidebarResize.expand();
    setTimeout(() => {
      this.chatInputRef?.nativeElement.focus();
    }, 100);
  }

  get hiddenChatsTooltip() {
    return this.showHiddenChannels$.value ? 'Switch to visible chats' : 'Switch to hidden chats';
  }

  protected prepareConfirmModalForChatDeletion(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);
    this.confirmation.open({
      title: 'Delete Chat',
      message: 'Are you sure? This action cannot be undone',
      confirmText: 'Delete',
      action: () => void channel.delete(),
    });
  }

  protected prepareChatTruncationConfirmationModal(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);
    this.confirmation.open({
      title: 'Clear Chat History',
      message: 'Are you sure? This action cannot be undone',
      confirmText: 'Clear',
      action: () => void channel.truncate(),
    });
  }

  protected prepareLeaveChannelModal(channel: Channel, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);
    this.confirmation.open({
      title: 'Leave Channel',
      message: 'Are you sure? You will no longer receive messages from this channel. You can rejoin later.',
      confirmText: 'Leave',
      action: () => {
        void channel.show();
        void channel.unmute();
        void channel.removeMembers([this.userInfo!.id]);
      },
    });
  }

  protected prepareUnfriendModal(friendId: string, friendshipId: string) {
    this.closeDrawer();
    this.confirmation.open({
      title: 'Unfriend',
      message: 'Are you sure you want to unfriend this user?',
      confirmText: 'Unfriend',
      action: () => this.unfriend(friendId, friendshipId),
    });
  }

  protected prepareBlockModal(friendId: string, friendshipId: string) {
    this.closeDrawer();
    this.confirmation.open({
      title: 'Block User',
      message: 'Are you sure you want to block this user?',
      confirmText: 'Block',
      action: () => this.block(friendId, friendshipId),
    });
  }
}
