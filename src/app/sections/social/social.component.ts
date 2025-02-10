import {AfterViewInit, Component, OnDestroy, OnInit, signal, TemplateRef, ViewChild} from "@angular/core";
import {SocialService} from "./social.service";
import {TuiInputModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {combineLatest, EMPTY, from, Subject, takeUntil} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, switchMap} from "rxjs/operators";
import {Friend, FriendshipAction, RelatedUserPublicProfile, UserPublicProfile} from "./social.model";
import {AvatarComponent} from "../../shared/avatar/avatar.component";
import {TuiAlertService, TuiPopup, TuiScrollbar} from "@taiga-ui/core";
import {NgClass, NgIf, NgTemplateOutlet} from "@angular/common";
import {TuiDrawer, TuiSegmented, TuiSkeleton} from "@taiga-ui/kit";
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
  ]
})
export class SocialComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('channelPreview', {static: true}) channelPreview!: TemplateRef<any>;
  @ViewChild('customHeaderTemplate') headerTemplate!: TemplateRef<ChannelHeaderInfoContext>;

  private readonly destroy$ = new Subject<void>();
  private userInfo: UserInfo | null = null;

  protected usernameFormControl = new FormControl<string>('');
  protected friendFormControl = new FormControl<string>('');
  protected nothingFound = false;
  protected matchedUsers: UserPublicProfile[] = [];
  protected matchedFriends: Friend[] = [];
  protected requestedIds: number[] = [];
  protected outgoingRequests: RelatedUserPublicProfile[] = [];
  protected incomingRequests: RelatedUserPublicProfile[] = [];
  protected friends: Friend[] = [];
  protected filteredFriends: Friend[] = [];
  protected requestsIndex: number = 0;

  protected readonly open = signal(false);
  protected loadingIncomingRequests: boolean = false;
  protected loadingOutgoingRequests: boolean = false;

  // CHATS
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
  ) {
    this.chatClient = StreamChat.getInstance(environment.streamChatApiKey);
    this.displayAs = this.messageService.displayAs;
  }

  async ngOnInit() {
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

    this.getFriends();
    this.listenToUsernameField();
    this.listenToFriendUsernameField();
    this.listenToChannelSearch();
    this.channelService.init({type: 'messaging'}).then();
    await this.connectUser(this.userInfo!.id, this.userInfo?.streamChatToken ?? '');
    await this.queryUserChannels();
  }

  ngAfterViewInit() {
    this.customTemplatesService.channelPreviewInfoTemplate$.next(this.channelPreview);
    this.customTemplatesService.channelHeaderInfoTemplate$.next(this.headerTemplate);
  }

  protected openMenu() {
    this.openRequestsTab();
  }

  protected async openChat(friendId: number) {
    console.log('Open chat');

    // Ensure the user is connected before creating a chat
    await this.connectUser(this.userInfo!.id, this.userInfo?.streamChatToken ?? '');

    console.log('User connected');

    // Now create or retrieve the private chat
    const channel = await this.createPrivateChat(this.userInfo!.id, friendId.toString());
    if (!channel) {
      console.error('Failed to create chat.');
      return;
    }
    this.channelService.setAsActiveChannel(channel);

    if (channel) {
      console.log('Channel created:', channel);
    } else {
      console.error('Failed to create chat.');
    }
  }

  async queryUserChannels() {
    const channels = await this.chatService.chatClient.queryChannels({
      members: {$in: [this.userInfo?.id ?? '5']}, // Ensure this matches the current user ID
    });

    console.log('Queried channels:', channels);
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
        name: 'Private Chat',
        members: [userId, recipientId], // Both users in the private chat
        created_by_id: userId, // Set creator
      });

      await channel.create(); // Ensure the channel is created
      console.log('Private chat created:', channelId);

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
      console.log('User connected to Stream Chat:', userId);
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
      this.friendFormControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ),
      this.chatService.user$ // Observable containing the user
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([query, user]) => {
          if (!query || query.length < 3) {
            // Reset to show all channels if the search query is too short
            return from(this.channelService.init({type: 'messaging'}));
          }

          if (!user) {
            return EMPTY; // Prevent API calls if user is not available
          }

          // Define search filters
          const filters = {
            type: 'messaging',
            name: {$autocomplete: query}, // Partial match on channel name
            members: {$in: [user.id]} // Use the user ID from the observable
          };

          return from(this.channelService.init(filters)).pipe(
            catchError(() => {
              return EMPTY; // Handle errors gracefully
            })
          );
        })
      )
      .subscribe();
  }

  private listenToFriendUsernameField() {
    this.friendFormControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((username) => {
          const filteredFriends = this.friends.filter(friend =>
            friend.username.toLowerCase().includes((username ?? '').toLowerCase())
          );

          this.filteredFriends = filteredFriends;
          this.nothingFound = filteredFriends.length === 0;

          return [];
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
  }

  searchNewUsers() {
    this.socialService.searchAllByUsername(this.usernameFormControl.value ?? '').subscribe(friends => {
      console.log(friends);
    });
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

  acceptFriendRequest(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.ACCEPT).subscribe({
      next: () => {
        this.getFriends();
        this.incomingRequests = this.incomingRequests.filter(request => request.friendshipId !== id);
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
    return this.friendFormControl.value?.trim() === '';
  }

  protected openRequestsTab() {
    this.open.set(true);
    this.getOutgoingRequests();
    this.getIncomingRequests();
  }

  public onClose(): void {
    this.open.set(false);
  }

  protected getChatName(channel: Channel, defaultName: string): string {
    if (defaultName !== 'Private Chat') {
      return defaultName;
    }

    const currentUserId = this.chatService.chatClient.userID;

    // Get the other user in the channel
    const otherMember = Object.values(channel.state.members).find(
      (member) => member.user?.id !== currentUserId
    );

    return otherMember?.user?.name || 'Private Chat';
  }
}
