import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
  ViewChild
} from "@angular/core";
import {SocialService} from "./social.service";
import {TuiInputModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {combineLatest, EMPTY, firstValueFrom, Subject, takeUntil} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, startWith, switchMap} from "rxjs/operators";
import {Friend, FriendshipAction, FriendshipStatus, RelatedUserProfile, UserPublicProfile} from "./social.model";
import {AvatarComponent} from "../../shared/avatar/avatar.component";
import {TuiAlertService, TuiDataList, TuiDropdownDirective, TuiPopup, TuiScrollbar} from "@taiga-ui/core";
import {NgClass, NgIf, NgTemplateOutlet} from "@angular/common";
import {TuiDataListDropdownManager, TuiDrawer, TuiSegmented, TuiSkeleton} from "@taiga-ui/kit";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../services/url.service";
import {TranslateModule} from "@ngx-translate/core";
import {
  ChannelHeaderInfoContext,
  ChannelService,
  ChatClientService,
  CustomTemplatesService,
  DefaultStreamChatGenerics,
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

  ]
})
export class SocialComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('channelPreview', {static: true}) channelPreview!: TemplateRef<any>;
  @ViewChild('customHeaderTemplate') headerTemplate!: TemplateRef<ChannelHeaderInfoContext>;
  @ViewChild('dropdown') dropdown!: TuiDropdownDirective;

  private readonly destroy$ = new Subject<void>();
  private userInfo: UserInfo | null = null;

  protected usernameFormControl = new FormControl<string>('');
  protected chatFormControl = new FormControl<string>('');
  protected nothingFound = false;
  protected matchedUsers: UserPublicProfile[] = [];
  protected matchedFriends: Friend[] = [];
  protected requestedIds: number[] = [];
  protected outgoingRequests: RelatedUserProfile[] = [];
  protected incomingRequests: RelatedUserProfile[] = [];
  protected friends: Friend[] = [];
  protected filteredFriends: Friend[] = [];
  protected requestsIndex: number = 0;

  protected readonly requestsTabOpened = signal(false);
  protected loadingIncomingRequests: boolean = false;
  protected loadingOutgoingRequests: boolean = false;

  protected readonly FriendshipStatus = FriendshipStatus;

  // CHATS
  private readonly PRIVATE_CHAT_NAME = 'Private Chat';
  private chatClient: StreamChat;
  protected displayAs: 'text' | 'html';

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

  async ngOnInit() {
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
      this.channelService.init({type: 'messaging', members: {$in: [this.userInfo.id]}}).then();
      this.connectUser(this.userInfo!.id, this.userInfo?.streamChatToken ?? '');
      this.chatUnreadService.fetchUnreadCount();
    });

    this.streamI18nService.setTranslation();

    this.activatedRoute.queryParams.subscribe(params => {
      if (params['requests'] === 'received') {
        this.requestsIndex = 0;
        this.openRequestsTab();
      }
      if (params['requests'] === 'sent') {
        this.requestsIndex = 1;
        this.openRequestsTab();
      }
      this.urlService.clearUrl();
    });

    this.listenToUsernameField();
    this.listenToChannelSearch();
    this.getFriends();
  }

  ngAfterViewInit() {
    this.customTemplatesService.channelPreviewInfoTemplate$.next(this.channelPreview);
    this.customTemplatesService.channelHeaderInfoTemplate$.next(this.headerTemplate);
  }

  private setChatTitle(channel: Channel<DefaultStreamChatGenerics>) {
    setTimeout(() => {
      const chatTitleElement = document.querySelector('[data-testid="name"]');
      if (!chatTitleElement) return;

      chatTitleElement.textContent = this.getChatName(channel, channel.data?.name || this.PRIVATE_CHAT_NAME);
      this.cdr.detectChanges();
    }, 1);
  }

  /**
   * Creates a private 1-on-1 (P2P) chat channel between two users.
   * @param userId The current user's ID (should already be connected).
   * @param recipientId The user ID of the person they want to chat with.
   * @returns A promise that resolves with the created channel.
   */
  async createPrivateChat(userId: string, recipientId: string) {
    try {
      if (!this.chatClient.user) {
        throw new Error('User must be connected before creating a chat.');
      }

      // Unique channel ID (e.g., `private_user1_user2`)
      const channelId = `private_${[userId, recipientId].sort().join('_')}`;

      const channel = this.chatService.chatClient.channel('messaging', channelId, {
        name: this.PRIVATE_CHAT_NAME,
        members: [userId, recipientId], // Both users in the private chat
        created_by_id: userId, // Set creator
      });

      await channel.create(); // Ensure the channel is created
      await channel.watch();  // ✅ Fix: Wait for the channel to be initialized

      console.log('Private chat created and watched:', channelId);

      return channel;
    } catch (error) {
      console.error('Error creating private chat:', error);
      return null;
    }
  }

  /**
   * Connects a user to Stream Chat.
   * @param userId The unique ID of the user.
   * @param userToken The authentication token for the user.
   * @returns A promise that resolves when the user is connected.
   */
  async connectUser(userId: string, userToken: string): Promise<void> {
    try {
      await this.chatClient.connectUser(
        {id: userId}, // User object with at least an ID
        userToken
      );
      const user = this.chatClient.user;
      console.log('User connected to Stream Chat:', user);
    } catch (error) {
      console.error('Error connecting user:', error);
    }
  }

  private listenToUsernameField() {
    this.usernameFormControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((username) => {
          if ((username?.length ?? 0) < 3) {
            // Clear the results and reset the "nothing found" flag
            this.matchedUsers = [];
            this.nothingFound = false;
            return []; // Emit an empty array
          }
          return this.socialService.searchAllByUsername(username || '').pipe(
            catchError(() => {
              this.nothingFound = true; // Handle errors
              return []; // Return an empty array in case of errors
            })
          );
        })
      )
      .subscribe((friends: UserPublicProfile[]) => {
        this.matchedUsers = friends;
        this.nothingFound = friends.length === 0;
      });
  }

  private listenToChannelSearch() {
    combineLatest([
      this.chatFormControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ),
      this.chatService.user$ // Observable containing the current user
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(async ([query, user]) => {
          if (!user) {
            return EMPTY; // Prevent API calls if the user is not available
          }

          const trimmedQuery = query?.trim(); // ✅ Remove spaces to avoid invalid queries

          const filters: Record<string, any> = {
            type: 'messaging',
            members: {$in: [user.id]} // Ensure the user is a member of the channels
          };

          if (!trimmedQuery) {
            // ✅ If input is empty, return all channels (like in ngOnInit)
            try {
              this.channelService.reset();
              await this.channelService.init(filters);
              return [];
            } catch (error) {
              console.error("Error fetching all channels:", error);
              return EMPTY;
            }
          }

          let orConditions: any[] = [
            {"member.user.name": {$autocomplete: trimmedQuery}}
          ];

          // ✅ Include "Saved Messages" if the query matches its name
          if ("Saved Messages".toLowerCase().includes(trimmedQuery.toLowerCase())) {
            orConditions.push({"name": {$eq: "Saved Messages"}});
          }

          // ✅ Only add `$or` if there are multiple conditions
          if (orConditions.length > 1) {
            filters["$or"] = orConditions;
          } else {
            Object.assign(filters, orConditions[0]);
          }

          try {
            this.channelService.reset();
            await this.channelService.init(filters);
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
      this.loadingOutgoingRequests = false;
    });
  }

  getIncomingRequests() {
    this.loadingIncomingRequests = true;
    this.socialService.getIncomingRequests().subscribe(incomingRequests => {
      this.incomingRequests = incomingRequests;
      this.loadingIncomingRequests = false;
    });
  }

  getFriends() {
    this.socialService.fetchFriends().subscribe(friends => {
      this.friends = friends;
      this.filteredFriends = friends;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.channelService.deselectActiveChannel();
  }

  searchNewUsers() {
    this.socialService.searchAllByUsername(this.usernameFormControl.value ?? '').subscribe(friends => {
      console.log(friends);
    });
  }

  openChatWithNewFriend(friendId: number) {
    this.closeRequestsTab();

    const filters = {
      cid: {$eq: 'messaging:private_' + this.userInfo?.id + '_' + friendId},
    };

    this.chatService.chatClient.queryChannels(filters).then(
      (channels) => {
        if (channels.length > 0) {
          this.channelService.setAsActiveChannel(channels[0]);
        } else {
          console.error('Chat with friend not found');
        }
      }
    )
  }

  cancelFriendRequest(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.CANCEL).subscribe({
      next: () => {
        this.outgoingRequests = this.outgoingRequests.filter(request => request.friendshipId !== id);
        this.alertService.open('Friend request cancelled', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to cancel friendship request', {appearance: 'error'}).subscribe();
      }
    });
  }

  acceptFriendRequest(candidate: RelatedUserProfile) {
    this.socialService.patchFriendship(candidate.friendshipId, FriendshipAction.ACCEPT).subscribe({
      next: () => {
        this.createPrivateChat(this.userInfo!.id, candidate.id.toString()).then(_ => {
          this.incomingRequests
            .filter(profile => profile === candidate)
            .map(profile => profile.friendshipStatus = FriendshipStatus.FRIENDS);
        })
        this.alertService.open('Friend request accepted', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to accept friendship request', {appearance: 'error'}).subscribe();
      }
    });
  }

  rejectFriendRequest(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.REJECT).subscribe({
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

  unfriend(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.UNFRIEND).subscribe({
      next: () => {
        this.alertService.open('Friend removed', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to remove friend', {appearance: 'error'}).subscribe();
      }
    });
  }

  block(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.BLOCK).subscribe({
      next: () => {
        this.alertService.open('User blocked', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to block user', {appearance: 'error'}).subscribe();
      }
    });
  }

  unblock(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.UNBLOCK).subscribe({
      next: () => {
        this.alertService.open('User unblocked', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to unblock user', {appearance: 'error'}).subscribe();
      }
    });
  }

  sendFriendRequest(id: number) {
    this.socialService.createFriendshipRequest(id).subscribe({
      next: (friendship) => {
        console.log(friendship);
        this.alertService.open('We notified user about your request', {appearance: 'success'}).subscribe();
        this.requestedIds.push(id);
        setTimeout(() => {
          this.getOutgoingRequests();
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

  protected isNotFiltered() {
    return this.chatFormControl.value?.trim() === '';
  }

  protected openRequestsTab() {
    this.requestsTabOpened.set(true);
    this.getOutgoingRequests();
    this.getIncomingRequests();
  }

  public closeRequestsTab(): void {
    this.requestsTabOpened.set(false);
  }

  protected getChatName(channel: Channel<DefaultStreamChatGenerics>, defaultName: string): string {
    if (defaultName !== this.PRIVATE_CHAT_NAME) {
      return defaultName;
    }

    const currentUserId = this.chatService.chatClient.userID;

    // Get the other user in the channel
    const otherMember = Object.values(channel.state.members).find(
      (member) => member.user?.id !== currentUserId
    );

    return otherMember?.user?.name || this.PRIVATE_CHAT_NAME;
  }

  deleteChat(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    channel.delete().then(() => {
      dropdown.toggle(false);
    });
  }

  truncateChat(channel: Channel<DefaultStreamChatGenerics>, dropdown: TuiDropdownDirective) {
    dropdown.toggle(false);

    setTimeout(() => {
      channel.truncate().then(() => {
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
}
