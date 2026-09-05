import {logger} from "../../shared/logger";
import {getErrorMessage} from '../../shared/http-error';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, signal, TemplateRef, ViewChild, inject } from "@angular/core";
import {SocialService} from "./social.service";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {BehaviorSubject, combineLatest, filter, finalize, firstValueFrom, of, Subject, takeUntil} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap} from "rxjs/operators";
import {PublicUserProfile, RelatedUserProfile, RelationshipAction, RelationshipStatus, UserSearchResult} from "./social.model";
import {LanguageNameService} from "../../services/language-name.service";
import {AvatarComponent} from "../../shared/avatar/avatar.component";
import {TuiDataList, TuiIcon, TuiNotificationService, TuiScrollbar, TuiTextfieldComponent, TuiTextfieldOptionsDirective} from "@taiga-ui/core/components";
import {TuiDropdownDirective, TuiDropdownManual, TuiDropdownOptionsDirective, TuiHintDirective} from "@taiga-ui/core/portals";
import {DatePipe, NgClass, NgStyle, NgTemplateOutlet} from "@angular/common";
import {
  TuiBadgedContentComponent,
  TuiBadgeNotification,
  TuiSegmented
} from "@taiga-ui/kit/components";
import {TuiDataListDropdownManager, TuiSkeleton} from "@taiga-ui/kit/directives";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ActivatedRoute, Params, Router} from "@angular/router";
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
  DateParserService,
  MessageActionsBoxContext,
  MessageActionsService,
  CustomMetadataContext,
  MessageInputComponent,
  MessageService,
  parseDate,
  StreamMessage,
  StreamAutocompleteTextareaModule,
  StreamChatModule,
  StreamI18nService
} from "stream-chat-angular";
import {Channel, StreamChat, User} from "stream-chat";
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
import {CHANNEL_SORT, SocialChannelFacade} from './social-channel.facade';
import {AlmoChatComponent} from './almo/almo-chat.component';
import {AlmoChatCoordinator} from './almo/almo-chat.coordinator';
import {AlmoComposerDirective} from './almo/almo-composer.directive';
import {MAX_MESSAGE_LENGTH, SOCIAL_COPY} from './social-copy';
import {SocialSidebarResizeDirective} from './social-sidebar-resize.directive';
import {SocialConfirmationService} from './social-confirmation.service';

/** One row in the Messages section of chat search. */
interface MessageHit {
  id: string;
  text: string;
  cid: string;
  channelName: string;
}

@Component({
  selector: 'app-social',
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.less', './social-people.less', './social-stream-overrides.less'],
  imports: [
    ReactiveFormsModule,
    AvatarComponent,
    SharedLucideIconsModule,
    NgClass,
    TuiSegmented,
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
    TuiBadgeNotification,
    TuiBadgedContentComponent,
    UserPreviewCardComponent,
    TuiTextfieldComponent,
    TuiDropdownDirective,
    TuiDropdownManual,
    TuiDropdownOptionsDirective,
    TuiTextfieldOptionsDirective,
    SocialSidebarResizeDirective,
    DatePipe,
    AlmoChatComponent,
    AlmoComposerDirective,
  ],
  providers: [SocialChannelFacade, SocialConfirmationService, DateParserService, AlmoChatCoordinator],
})
export class SocialComponent implements OnInit, OnDestroy, AfterViewInit {
  private socialService = inject(SocialService);
  private alertService = inject(TuiNotificationService);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private chatService = inject(ChatClientService);
  private channelService = inject(ChannelService);
  private streamI18nService = inject(StreamI18nService);
  private userInfoService = inject(UserInfoService);
  private customTemplatesService = inject(CustomTemplatesService);
  private messageService = inject(MessageService);
  private messageActionsService = inject(MessageActionsService);
  private chatUnreadService = inject(ChatUnreadService);
  private cdr = inject(ChangeDetectorRef);
  private dateParser = inject(DateParserService);
  private languageNames = inject(LanguageNameService);
  protected channels = inject(SocialChannelFacade);
  protected confirmation = inject(SocialConfirmationService);

  @ViewChild('channelPreview', {static: true}) channelPreview!: TemplateRef<ChannelPreviewInfoContext>;
  @ViewChild('customHeaderTemplate') headerTemplate!: TemplateRef<ChannelHeaderInfoContext>;
  @ViewChild('dropdownTemplate') dropdown!: TuiDropdownDirective;
  @ViewChild('avatarTemplate') avatarTemplate!: TemplateRef<AvatarContext>;
  @ViewChild('customChannelActions', {static: true}) customChannelActions!: TemplateRef<ChannelActionsContext>;
  @ViewChild('chatSearch', {read: ElementRef}) chatInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('peopleSearchInput', {read: ElementRef}) peopleSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('customMessageActions') customMessageActions!: TemplateRef<MessageActionsBoxContext>;
  @ViewChild('emptyMessageListPlaceholder', {static: true}) emptyMessageListPlaceholder!: TemplateRef<void>;
  @ViewChild('messageStamp', {static: true}) messageStamp!: TemplateRef<CustomMetadataContext>;
  @ViewChild('messageFooter', {static: true}) messageFooter!: TemplateRef<CustomMetadataContext>;
  @ViewChild(SocialSidebarResizeDirective) sidebarResize!: SocialSidebarResizeDirective;

  /**
   * 10: the composer comes and goes with the thread it belongs to, so the guard is attached as it
   * arrives rather than once at start-up.
   */
  @ViewChild(MessageInputComponent) set composer(input: MessageInputComponent | undefined) {
    this.guardComposerLength(input);
  }

  private readonly destroy$ = new Subject<void>();
  private readonly scheduledTasks = new Set<ReturnType<typeof setTimeout>>();
  private userInfo: UserInfo | null = null;

  protected usernameFormControl = new FormControl<string>('');
  protected chatFormControl = new FormControl<string>('');
  /** The handle the rows on screen actually answer for. */
  private searchedHandle = '';
  protected matchedUsers: UserSearchResult[] = [];
  protected requestedIds: string[] = [];
  protected outgoingRequests: RelatedUserProfile[] = [];
  protected incomingRequests: RelatedUserProfile[] = [];
  protected peopleUserTiles: RelatedUserProfile[] = [];
  protected blockedUsers: RelatedUserProfile[] = [];
  /**
   * 10: who this account has blocked, by Stream id. Stream hands the list over with the connected
   * user, so the thread can answer "can I write here" without a request of its own; block and
   * unblock keep it in step for the rest of the session.
   */
  private readonly blockedUserIds = new Set<string>();
  private guardedComposer?: MessageInputComponent;
  protected readonly copy = SOCIAL_COPY;
  protected friends: RelatedUserProfile[] = [];
  protected incomingRequestsCount = 0;
  /** Two characters is enough to be looking for a handle; three hid too many people. */
  protected static readonly MIN_HANDLE_SEARCH_LENGTH = 2;
  private static readonly SEARCH_DEBOUNCE_MS = 250;
  protected readonly MIN_HANDLE_SEARCH_LENGTH = SocialComponent.MIN_HANDLE_SEARCH_LENGTH;

  // people panel
  protected readonly isPeopleOpen = signal(false);
  protected peopleMode: 'requests' | 'friends' | 'blocked' = 'friends';
  protected loadingFriends = false;
  protected loadingBlocked = false;
  protected loadingIncomingRequests = false;
  protected loadingOutgoingRequests = false;
  protected noResultMessage = 'No results found';

  protected readonly FriendshipStatus = RelationshipStatus;

  /**
   * 01: the archive is a place you enter, not a switch you flip. The subject still drives the
   * channel query — a Stream "hidden" channel is what an archived one is made of.
   */
  protected showArchived$ = new BehaviorSubject<boolean>(false);
  protected archivedCount = 0;
  protected archiveHasUnread = false;

  // Search answers in sections rather than one undifferentiated list.
  protected searchQuery = '';
  protected isSearching = false;
  protected searchChats: Channel[] = [];
  protected searchJoinable: Channel[] = [];
  protected searchMessages: MessageHit[] = [];

  // CHATS
  private chatClient: StreamChat;
  protected displayAs: 'text' | 'html';
  protected hoveredChannel: Channel | null = null;
  protected activeChannel: Channel | null = null;
  protected currentLocation = '';
  /** The preview card is pinned open by a click or keyboard focus; hover no longer dismisses it. */
  protected isPreviewCardPinned = false;
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
    this.scheduledTasks.forEach(task => clearTimeout(task));
    this.scheduledTasks.clear();
    this.destroy$.next();
    this.destroy$.complete();
    this.channelService.deselectActiveChannel();
  }

  ngOnInit(): void {
    this.setupChatFormControl();
    this.setupPostTimestamps();
    this.setupBlockedUsers();

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
        this.schedule(() => {
          void this.openChatByCid(cid).then((found) => {
            if (!found) {
              logger.error("Could not find chat with cid:", cid);
            }
          });
        }, 300);
      } else {
        void this.channelService.init({members: {$in: [this.userInfo.id]}}, CHANNEL_SORT, undefined, false);
      }

      void this.refreshArchiveSummary();
    });

    this.setupActiveChannelSubscription();
    this.onViewportResize();
    this.registerMessageActions();
    this.streamI18nService.setTranslation();
    this.getIncomingRequests();
    this.listenToUsernameField();
    this.listenToChannelSearch();
  }

  private setupChatFormControl() {
    this.chatFormControl.valueChanges
      .pipe(
        distinctUntilChanged(),
        debounceTime(SocialComponent.SEARCH_DEBOUNCE_MS),
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

  /**
   * 25: a post carries only its clock time. The date separator above it already names
   * the day, and "Today at 2:51 AM" repeats what the divider already said. The chat bubble
   * carries the same bare clock inside the pill, so nothing anywhere restates the date.
   */
  private setupPostTimestamps(): void {
    this.dateParser.customDateTimeParser = date => parseDate(date, 'time');
  }

  /**
   * 10: Stream sends the blocked list down with the connected user, so this is a subscription
   * rather than a request, and block and unblock keep it in step for the rest of the session.
   */
  private setupBlockedUsers(): void {
    this.chatService.user$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (!user) return;
      this.blockedUserIds.clear();
      (user.blocked_user_ids ?? []).forEach(id => this.blockedUserIds.add(id));
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
        this.activeChannel = channel;
        this.setChatTitle(channel);
        this.openChat();
        void this.chatUnreadService.fetchUnreadCount();
        void this.refreshArchiveSummary();
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
      // Only a real picture is worth sending: with no image Stream leaves the field empty and the
      // avatar falls back to the same letter disc a profile card draws, rather than to a stranger's
      // random portrait that no other surface would ever show.
      image: userInfo.avatarUrl ?? undefined,
    };

    void this.chatService.init(environment.streamChatApiKey, user, userToken);
  }

  private handleQueryParams(params: Params) {
    if (params['tab'] === 'friends') {
      this.peopleMode = 'friends';
      this.openPeopleAndSetupData();
    }
    if (params['requests'] === 'received' || params['requests'] === 'sent') {
      this.peopleMode = 'requests';
      this.openPeopleAndSetupData();
    }
    const chat: unknown = params['chat'];
    if (typeof chat === 'string') {
      this.redirectId = chat;
      logger.debug('Redirecting to chat with cid:', this.channels.friendshipCid(this.redirectId));
    }
    this.urlService.clearUrl();
  }

  ngAfterViewInit() {
    this.customTemplatesService.channelPreviewInfoTemplate$.next(this.channelPreview);
    this.customTemplatesService.channelHeaderInfoTemplate$.next(this.headerTemplate);
    this.customTemplatesService.avatarTemplate$.next(this.avatarTemplate);
    this.customTemplatesService.channelActionsTemplate$.next(this.customChannelActions);
    this.customTemplatesService.messageActionsBoxTemplate$.next(this.customMessageActions);
    this.customTemplatesService.emptyMainMessageListPlaceholder$.next(this.emptyMessageListPlaceholder);
    this.customTemplatesService.customMessageMetadataInsideBubbleTemplate$.next(this.messageStamp);
    this.customTemplatesService.customMessageMetadataTemplate$.next(this.messageFooter);
  }

  private setChatTitle(channel: Channel) {
    this.schedule(() => {
      const chatTitleElement = document.querySelector('[data-testid="name"]');
      if (!chatTitleElement) return;

      chatTitleElement.textContent = this.channels.name(channel, channel.data?.name ?? '');
      this.cdr.detectChanges();
    }, 1);
  }

  private listenToUsernameField() {
    this.usernameFormControl.valueChanges
      .pipe(
        debounceTime(SocialComponent.SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        map((username) => {
          const sanitizedUsername = this.sanitizeUsername(username);
          this.usernameFormControl.setValue(sanitizedUsername, {emitEvent: false}); // ✅ Update FormControl value
          return sanitizedUsername;
        }),
        switchMap((username) => {
          if (username.length < SocialComponent.MIN_HANDLE_SEARCH_LENGTH) {
            return of<UserSearchResult[]>([]);
          }
          return this.socialService.searchAllByUsername(username).pipe(
            catchError(() => of<UserSearchResult[]>([]))
          );
        })
      )
      .subscribe((candidates: UserSearchResult[]) => {
        this.matchedUsers = candidates;
        // Answers arrive one debounce behind the keystrokes, and the panel must not call a handle
        // missing until the answer for that exact handle is in.
        this.searchedHandle = this.usernameFormControl.value ?? '';
      });
  }

  /**
   * 04: two characters in, the one field takes the list over from whichever tab is showing. The
   * tabs stay put and their counts do not move - they are views over your own relationships, and
   * the field cuts across all three.
   */
  protected get isSearchingPeople(): boolean {
    return (this.usernameFormControl.value ?? '').length >= SocialComponent.MIN_HANDLE_SEARCH_LENGTH;
  }

  protected get peopleSearchPending(): boolean {
    return this.isSearchingPeople && this.searchedHandle !== (this.usernameFormControl.value ?? '');
  }

  /** The results section by section: the people you already know, then everybody else. */
  protected get friendMatches(): UserSearchResult[] {
    return this.matchedUsers.filter(candidate => this.candidateState(candidate) === 'friend');
  }

  protected get otherMatches(): UserSearchResult[] {
    return this.matchedUsers.filter(candidate => this.candidateState(candidate) !== 'friend');
  }

  /** 05: the empty-friends button is a pointer at that field, not a route to a second screen. */
  protected focusPeopleSearch(): void {
    this.peopleSearchInput?.nativeElement.focus();
  }

  protected clearPeopleSearch(): void {
    this.usernameFormControl.setValue('');
    this.focusPeopleSearch();
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
        debounceTime(SocialComponent.SEARCH_DEBOUNCE_MS),
        map(value => (value ?? '').trim()),
        distinctUntilChanged()
      ),
      this.showArchived$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([query, archived]) => {
        this.searchQuery = query;
        if (!query) {
          this.clearSearchResults();
          this.channels.reload(archived);
          return;
        }
        void this.runChatSearch(query);
      });
  }

  private clearSearchResults(): void {
    this.isSearching = false;
    this.searchChats = [];
    this.searchJoinable = [];
    this.searchMessages = [];
  }

  /**
   * Chats first, then the channels you could join, then messages. A private chat carries no name
   * of its own, so it has to be found through its members.
   */
  private async runChatSearch(query: string): Promise<void> {
    const client = this.chatService.chatClient;
    const userId = client.userID;
    if (!userId) return;

    this.isSearching = true;
    try {
      const [byMember, byName, broadcast] = await Promise.all([
        client.queryChannels(
          {type: AppConstants.PRIVATE_CHAT_TYPE, members: {$in: [userId]}, 'member.user.name': {$autocomplete: query}},
          {last_message_at: -1},
          {limit: 10},
        ),
        client.queryChannels(
          {members: {$in: [userId]}, name: {$autocomplete: query}},
          {last_message_at: -1},
          {limit: 10},
        ),
        client.queryChannels(
          {type: 'broadcast', name: {$autocomplete: query}},
          {last_message_at: -1},
          {limit: 10},
        ),
      ]);

      if (this.searchQuery !== query) return;

      const mine = new Map<string, Channel>();
      [...byMember, ...byName].forEach(channel => mine.set(channel.cid, channel));
      if (AppConstants.SELF_CHAT_NAME.toLowerCase().includes(query.toLowerCase())) {
        const saved = await this.selfChannel();
        if (saved) mine.set(saved.cid, saved);
      }

      this.searchChats = [...mine.values()];
      this.searchJoinable = broadcast.filter(channel => !this.channels.isMember(channel));
      this.searchMessages = await this.searchInMessages(userId, query);
    } catch (error) {
      logger.error('Chat search failed', error);
    } finally {
      if (this.searchQuery === query) {
        this.isSearching = false;
      }
      this.cdr.detectChanges();
    }
  }

  /** Message search is a bonus section: if the app is not entitled to it, the rest still answers. */
  private async searchInMessages(userId: string, query: string): Promise<MessageHit[]> {
    try {
      const response = await this.chatService.chatClient.search(
        {members: {$in: [userId]}},
        query,
        {limit: 5},
      );
      return response.results
        .map(result => result.message)
        .filter(message => !!message.text)
        .map(message => ({
          id: message.id,
          text: message.text ?? '',
          cid: message.channel?.cid ?? '',
          channelName: message.channel?.name ?? message.user?.name ?? 'Chat',
        }))
        .filter(hit => !!hit.cid);
    } catch (error) {
      logger.debug('Message search unavailable', error);
      return [];
    }
  }

  private registerMessageActions(): void {
    this.messageActionsService.customActions$.next([
      {
        actionName: 'save-to-saved-messages',
        actionLabelOrTranslationKey: 'Save to Saved Messages',
        isVisible: () => true,
        actionHandler: (message: StreamMessage) => void this.saveToSavedMessages(message),
      },
    ]);
  }

  private async saveToSavedMessages(message: StreamMessage): Promise<void> {
    const text = message.text?.trim();
    if (!text) return;

    try {
      const saved = await this.selfChannel();
      if (!saved) {
        this.alertService.open('Saved Messages is not ready yet.', {appearance: 'negative'}).subscribe();
        return;
      }
      await saved.sendMessage({text});
      this.alertService.open('Saved to Saved Messages', {appearance: 'positive'}).subscribe();
    } catch (error) {
      logger.error('Could not save the message', error);
      this.alertService.open('Could not save that message.', {appearance: 'negative'}).subscribe();
    }
  }

  protected channelImage(channel: Channel): string | undefined {
    const image = channel.data?.image;
    return typeof image === 'string' ? image : undefined;
  }

  /** An empty row says what the chat is, rather than repeating one generic absence. */
  protected emptyPreview(channel: Channel): string {
    if (this.channels.isSelf(channel)) return 'Only you can see this';
    if (this.channels.isAlmo(channel)) return 'Nothing said yet';
    if (this.channels.isPublic(channel)) return 'No updates yet';
    return 'No messages yet';
  }

  protected lastMessagePreview(channel: Channel): string {
    return channel.state.messages.at(-1)?.text ?? this.emptyPreview(channel);
  }

  protected openSearchResult(channel: Channel): void {
    this.channelService.setAsActiveChannel(channel);
    this.chatFormControl.setValue('');
  }

  protected joinFromSearch(channel: Channel): void {
    void this.channels.join(channel).then(() => this.chatFormControl.setValue(''));
  }

  protected openMessageHit(hit: MessageHit): void {
    void this.channels.openByCid(hit.cid).then(() => this.chatFormControl.setValue(''));
  }

  protected clearSearch(event: Event): void {
    event.stopPropagation();
    this.chatFormControl.setValue('');
  }

  private async selfChannel(): Promise<Channel | null> {
    const client = this.chatService.chatClient;
    const userId = client.userID;
    if (!userId) return null;
    const [saved] = await client.queryChannels(
      {type: AppConstants.SELF_CHAT_TYPE, members: {$in: [userId]}},
      undefined,
      {limit: 1},
    );
    return saved ?? null;
  }

  range(n: number): number[] {
    return Array.from({length: n}, (_, i) => i);
  }

  getOutgoingRequests() {
    this.loadingOutgoingRequests = true;
    this.socialService.getOutgoingRequests().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingOutgoingRequests = false),
    ).subscribe({
      next: outgoingRequests => {
        this.outgoingRequests = outgoingRequests;
      },
      error: error => this.showSocialLoadError('outgoing friend requests', error),
    });
  }

  getIncomingRequests() {
    this.loadingIncomingRequests = true;
    this.socialService.getIncomingRequests().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingIncomingRequests = false),
    ).subscribe({
      next: incomingRequests => {
        this.incomingRequests = incomingRequests;
        this.incomingRequestsCount = incomingRequests.filter(
          request => request.relationshipStatus === RelationshipStatus.PENDING_INCOMING
        ).length;
      },
      error: error => this.showSocialLoadError('incoming friend requests', error),
    });
  }

  getFriends() {
    this.loadingFriends = true;
    this.socialService.getFriends().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingFriends = false),
    ).subscribe({
      next: friends => {
        this.friends = friends;
        this.peopleUserTiles = friends;
      },
      error: error => this.showSocialLoadError('friends', error),
    });
  }

  getBlocked() {
    this.loadingBlocked = true;
    this.socialService.getBlocked().pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingBlocked = false),
    ).subscribe({
      next: blocked => {
        this.blockedUsers = blocked;
        this.peopleUserTiles = blocked;
      },
      error: error => this.showSocialLoadError('blocked users', error),
    });
  }

  private showSocialLoadError(resource: string, error: unknown): void {
    logger.error(`Could not load ${resource}`, error);
    this.alertService.open(`Could not load ${resource}. Please try again.`, {appearance: 'negative'}).subscribe();
  }

  protected candidateState(candidate: UserSearchResult): 'friend' | 'requested' | 'blocked' | 'none' {
    if (this.requestedIds.includes(candidate.id)) return 'requested';
    switch (candidate.relationshipStatus) {
      case RelationshipStatus.FRIENDS:
        return 'friend';
      case RelationshipStatus.PENDING_OUTGOING:
      case RelationshipStatus.PENDING_INCOMING:
        return 'requested';
      case RelationshipStatus.BLOCKED:
        return 'blocked';
      default:
        return 'none';
    }
  }

  protected isOwnMessage(message: StreamMessage): boolean {
    return !!this.userInfo && message.user?.id === this.userInfo.id;
  }

  /**
   * A double check once somebody has read it, a single one while it is only delivered: the receipt
   * the desktop mock draws beside the time, kept rather than dropped with Stream's own metadata row.
   */
  protected receiptIcon(message: StreamMessage): string {
    if (message.status === 'sending') return 'clock';
    if (message.status === 'failed') return 'circle-x';
    return message.readBy?.length ? 'check-check' : 'check';
  }

  /** A post announces something, and the thing it announces rides under it as one action. */
  protected postCtaLabel(message: StreamMessage): string | null {
    const label = (message as unknown as Record<string, unknown>)['ctaLabel'];
    return typeof label === 'string' && label.trim() ? label : null;
  }

  protected openPostCta(message: StreamMessage): void {
    const url = (message as unknown as Record<string, unknown>)['ctaUrl'];
    if (typeof url !== 'string' || !url) return;
    if (url.startsWith('/')) {
      void this.router.navigateByUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  /**
   * The one line under a name in the People panel. A friend already said what they are, so the
   * search row says "Friend"; everyone else is described by what they study.
   */
  protected personSubtitle(person: PublicUserProfile, relationship?: string): string {
    if (relationship === 'friend') return 'Friend';
    if (!person.learning.length) return '';
    return `Learning ${this.languageNames.getLanguageNames(person.learning).join(', ')}`;
  }

  protected messageCandidate(candidate: UserSearchResult): void {
    if (!candidate.relationshipId) return;
    this.openChatWithFriend({
      ...candidate,
      relationshipId: candidate.relationshipId,
      relationshipStatus: RelationshipStatus.FRIENDS,
    });
  }

  openChatWithFriend(friend: RelatedUserProfile) {
    this.closePeople();

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
        // The chat this friendship gets is created by the server and arrives on its own, for
        // whoever is looking - including the friend, who is not here to make one.
        next: () => {
          this.incomingRequestsCount--;
          this.incomingRequests
            .filter(profile => profile === candidate)
            .map(profile => profile.relationshipStatus = RelationshipStatus.FRIENDS);
          this.acceptInProgressIds.delete(candidate.relationshipId);
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
    this.blockedUserIds.delete(friendId.toString());
    this.socialService.patchFriendship(friendshipId, RelationshipAction.UNBLOCK)
      .pipe(finalize(() => this.unblockInProgressIds.delete(friendshipId)))
      .subscribe({
        next: () => {
          this.blockedUsers = this.blockedUsers.filter(user => user.id !== friendId);
          this.peopleUserTiles = this.blockedUsers;
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
          const username = this.matchedUsers.find(candidate => candidate.id === id)?.username;
          const recipient = username ? `@${username}` : 'that user';
          this.alertService.open(`Request sent to ${recipient}.`, {appearance: 'positive'}).subscribe();
          this.requestedIds.push(id);
          this.matchedUsers = this.matchedUsers.map(user =>
            user.id === id ? {...user, relationshipStatus: RelationshipStatus.PENDING_OUTGOING} : user
          );
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
        this.peopleUserTiles = this.friends;
        this.alertService.open('That user is no longer your friend', {appearance: 'positive'}).subscribe();
        this.setPeopleMode('friends');
      },
      error: (error) => {
        logger.error(error);
        this.alertService.open(getErrorMessage(error, 'Failed to remove friend'), {appearance: 'negative'}).subscribe();
      }
    });
  }

  block(friendId: string, friendshipId: string) {
    void this.chatClient.blockUser(friendId.toString());
    this.blockedUserIds.add(friendId.toString());
    this.socialService.patchFriendship(friendshipId, RelationshipAction.BLOCK).subscribe({
      next: () => {
        this.friends = this.friends.filter(friend => friend.id !== friendId);
        this.peopleUserTiles = this.friends;
        this.alertService.open('User blocked', {appearance: 'positive'}).subscribe();
        this.setPeopleMode('blocked');
      },
      error: (error) => {
        logger.error(error);
        this.alertService.open(getErrorMessage(error, 'Failed to block user'), {appearance: 'negative'}).subscribe();
      }
    });
  }

  protected openPeopleAndSetupData() {
    this.openPeople();
    if (this.peopleMode === 'requests') {
      // One scroll, two headers: Received carries the work, Sent is usually a row or two.
      this.peopleUserTiles = [];
      this.getIncomingRequests();
      this.getOutgoingRequests();
      this.noResultMessage = `You have no friend requests.`;
    }
    if (this.peopleMode === 'friends') {
      this.getFriends();
      this.noResultMessage = 'You have not added anyone yet.';
    }
    if (this.peopleMode === 'blocked') {
      this.noResultMessage = `No one is blocked.`;
      this.getBlocked();
    }
  }

  /** Language rooms are broadcast channels: readable, leavable, never writable. */
  protected get isActiveChannelReadOnly(): boolean {
    return !!this.activeChannel && this.channels.isPublic(this.activeChannel);
  }

  /**
   * A channel post and a note to yourself are read, so their feed is capped to a reading measure
   * instead of the pane. A 1:1 exchange is not: those bubbles are already capped and edge-aligned.
   */
  protected get isActiveChannelReadingColumn(): boolean {
    if (!this.activeChannel) return false;
    return this.channels.isPublic(this.activeChannel) || this.channels.isSelf(this.activeChannel);
  }

  /**
   * 10: the account on the other side is gone. The thread stays readable - the history is as much
   * the survivor's as it was the other person's - but there is nobody to send to, so the composer
   * is replaced rather than disabled: a field the app will reject should not be on screen at all.
   */
  protected get isActiveChannelDeleted(): boolean {
    return !!this.activeChannel && this.channels.isInterlocutorDeleted(this.activeChannel);
  }

  /**
   * 10: the person on the other side, when this account has blocked them. Blocking is reversible,
   * so the thread keeps its history and the composer states who and offers the way back, rather
   * than the conversation disappearing. The private channel is addressed by its friendship, which
   * is what makes the id the unblock call needs recoverable from the channel alone.
   */
  protected get blockedInterlocutor(): {id: string; handle: string; friendshipId: string} | null {
    const channel = this.activeChannel;
    if (!channel || !this.channels.isPrivate(channel) || !this.userInfo) return null;

    const other = Object.values(channel.state.members).find(member => member.user?.id !== this.userInfo!.id)?.user;
    if (!other || !this.blockedUserIds.has(other.id)) return null;

    const friendshipId = this.channels.friendshipIdOf(channel);
    if (!friendshipId) return null;

    return {id: other.id, handle: other.name ?? other.id, friendshipId};
  }

  protected unblockInterlocutor(blocked: {id: string; friendshipId: string}): void {
    this.unblock(blocked.id, blocked.friendshipId);
  }

  /**
   * 10: refuse an over-long message before it is sent, not after Stream bounces it.
   *
   * The cap is the channel type's `max_message_length`, which Stream enforces itself; without a
   * check here that enforcement arrives as a failed bubble, which says a send went wrong rather
   * than that it was never going to fit. There is no live counter by design - the number only
   * matters at the moment it stops you.
   *
   * The guard has to sit in front of the SDK's own send handler rather than around
   * `ChannelService.sendMessage`, because the composer empties the textarea before it awaits that
   * call: refusing any further in would take the message away as it told the user it was too long.
   */
  private guardComposerLength(input?: MessageInputComponent): void {
    if (!input || input === this.guardedComposer) return;
    this.guardedComposer = input;

    const send = input.messageSent.bind(input);
    input.messageSent = async () => {
      if ((input.textareaValue ?? '').length > MAX_MESSAGE_LENGTH) {
        this.alertService.open(SOCIAL_COPY.tooLong, {appearance: 'negative'}).subscribe();
        return;
      }
      await send();
    };
  }

  /**
   * 10: why a message is sitting in the thread unsent. `failed` is a send that never reached
   * Stream and can be tried again; `refused` is one Stream rejected outright, which retrying
   * cannot fix - the SDK draws the same distinction to decide whether a tap resends.
   */
  protected messageFailure(message: StreamMessage): 'failed' | 'refused' | null {
    if (message.status !== 'failed') return null;
    return message.errorStatusCode === 403 ? 'refused' : 'failed';
  }

  protected retrySend(message: StreamMessage): void {
    void this.channelService.resendMessage(message);
  }

  protected get activeChannelTopic(): string {
    return this.activeChannel ? this.channels.topic(this.activeChannel) : '';
  }

  protected get emptyChannelTitle(): string {
    if (this.activeChannel && this.channels.isSelf(this.activeChannel)) return 'Your own notebook';
    if (this.activeChannel && this.channels.isAlmo(this.activeChannel)) return 'Nothing said yet';
    if (this.isActiveChannelReadOnly) return 'Nothing posted yet';
    return 'No messages yet';
  }

  protected get emptyChannelBody(): string {
    // 11: same voice as his channel: short, plain, no praise. The openers below are the other way in.
    if (this.activeChannel && this.channels.isAlmo(this.activeChannel)) {
      return 'Almo answers in the language of this chat. Write first, or take one of the openers below.';
    }
    if (this.activeChannel && this.channels.isSelf(this.activeChannel)) {
      return 'Forward messages here, or write to yourself. Nobody else can see this chat.';
    }
    if (this.isActiveChannelReadOnly) {
      return `New books, packs and features for ${this.activeChannelTopic} will land here.`;
    }
    return 'Say hello — this is the start of the conversation.';
  }

  protected isPeopleDataLoading() {
    if (this.peopleMode === 'requests') {
      return this.loadingIncomingRequests || this.loadingOutgoingRequests;
    }
    if (this.peopleMode === 'friends') {
      return this.loadingFriends;
    }
    if (this.peopleMode === 'blocked') {
      return this.loadingBlocked;
    }
    return false;
  }

  /**
   * 07: rail, snaps and the drag handle are desktop only. A width persisted on a wide screen
   * must not follow the list onto a phone, where the list is the whole column.
   */
  private static readonly NARROW_VIEWPORT_PX = 640;
  protected readonly isNarrowViewport = signal(false);

  @HostListener('window:resize')
  protected onViewportResize(): void {
    this.isNarrowViewport.set(globalThis.innerWidth <= SocialComponent.NARROW_VIEWPORT_PX);
  }

  public openPeople(): void {
    this.closePreviewCard();
    this.isPeopleOpen.set(true);
  }

  public closePeople(): void {
    this.isPeopleOpen.set(false);
    // The panel reopens on its tab list, not on whoever was searched for last. Cleared through the
    // pipe rather than silently, so the next search for the same handle is not swallowed as a repeat.
    this.usernameFormControl.setValue('');
  }

  /** A new chat starts by picking a person, so it lands in People rather than an empty thread. */
  protected startNewChat(): void {
    this.peopleMode = 'friends';
    this.openPeopleAndSetupData();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.activeRowMenu) {
      this.closeRowMenu();
      return;
    }
    if (this.hoveredChannel) {
      this.closePreviewCard();
      return;
    }
    this.isPeopleOpen.set(false);
  }

  protected archiveChat(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);

    this.schedule(() => {
      void channel.hide().then(() => {
        this.channels.reload(this.showArchived$.value);
        void this.refreshArchiveSummary();
      });
    }, 30);
  }

  protected unarchiveChat(channel: Channel, dropdown: TuiDropdownDirective, event?: Event) {
    event?.stopPropagation();
    this.closeRowMenu(dropdown);

    this.schedule(() => {
      void channel.show().then(() => {
        this.channels.reload(this.showArchived$.value);
        void this.refreshArchiveSummary();
      });
    }, 30);
  }

  muteChat(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);

    this.schedule(() => {
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
    this.closeRowMenu(dropdown);

    this.schedule(() => {
      void channel.markRead();
    }, 30);
  }

  markAsUnread(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);

    this.schedule(() => {
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
    this.closeRowMenu(dropdown);

    this.schedule(() => {
      void channel.unmute();
    }, 30);
  }

  isChannelMuted(channel: Channel): boolean {
    return channel.muteStatus().muted;
  }

  protected isArchived(channel: Channel): boolean {
    return !!channel.data?.hidden;
  }

  protected get isArchiveOpen(): boolean {
    return this.showArchived$.value;
  }

  protected openArchive(): void {
    this.showArchived$.next(true);
  }

  protected closeArchive(): void {
    this.showArchived$.next(false);
  }

  /**
   * The Archived row only exists when there is an archive; a chat that arrives in it stays there
   * and lights the row rather than jumping back into the list.
   */
  private async refreshArchiveSummary(): Promise<void> {
    const client = this.chatService.chatClient;
    const userId = client.userID;
    if (!userId) return;

    try {
      const archived = await client.queryChannels(
        {hidden: true, members: {$in: [userId]}},
        {last_message_at: -1},
        {limit: 30},
      );
      this.archivedCount = archived.length;
      this.archiveHasUnread = archived.some(channel => channel.countUnread() > 0);
      this.cdr.detectChanges();
    } catch (error) {
      logger.error('Could not read the archive', error);
    }
  }

  /** Right-click on the row is an accelerator for the same menu the button opens. */
  /**
   * The row menu the list currently has open. Right-click never propagates far enough for the
   * dropdowns to notice each other, so the list holds the one that is open and closes it itself.
   */
  private activeRowMenu?: TuiDropdownDirective;

  /** Asking a row for its menu replaces whatever menu was open: one at a time, never a stack. */
  protected openRowMenu(menu: TuiDropdownDirective, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeRowMenu();
    this.activeRowMenu = menu;
    menu.toggle(true);
  }

  /**
   * With no argument, closes whichever menu is open. With one, closes that menu alone - a zone
   * that has just lost focus may have been replaced already, and must not close its successor.
   */
  protected closeRowMenu(menu?: TuiDropdownDirective): void {
    (menu ?? this.activeRowMenu)?.toggle(false);
    if (!menu || this.activeRowMenu === menu) {
      this.activeRowMenu = undefined;
    }
  }

  joinChannel(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);

    this.schedule(() => {
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

  /** A cursor crossing a column of avatars must not fire a card per row. */
  private static readonly PREVIEW_CARD_OPEN_DELAY_MS = 120;
  private hoverOpenTimeout?: ReturnType<typeof setTimeout>;

  startAvatarHover(channel: Channel | undefined, location: string) {
    if (!channel || this.isPreviewCardPinned || this.channels.isInterlocutorDeleted(channel)) return;
    clearTimeout(this.timeout);
    clearTimeout(this.hoverOpenTimeout);
    this.hoverOpenTimeout = this.schedule(() => {
      this.hoveredChannel = channel;
      this.currentLocation = location;
    }, SocialComponent.PREVIEW_CARD_OPEN_DELAY_MS);
  }

  /** Click and keyboard focus open the same card, and pin it until it is dismissed. */
  protected togglePreviewCard(channel: Channel | undefined, location: AvatarLocation) {
    // 10: there is no profile behind a deleted account, so the disc stops being a way in to one.
    if (!channel || !this.channels.isPrivate(channel) || this.channels.isInterlocutorDeleted(channel)) return;
    clearTimeout(this.timeout);
    clearTimeout(this.hoverOpenTimeout);

    const isSameCard = this.hoveredChannel?.cid === channel.cid && this.currentLocation === location;
    if (isSameCard && this.isPreviewCardPinned) {
      this.closePreviewCard();
      return;
    }

    this.hoveredChannel = channel;
    this.currentLocation = location;
    this.isPreviewCardPinned = true;
  }

  protected closePreviewCard() {
    clearTimeout(this.timeout);
    clearTimeout(this.hoverOpenTimeout);
    this.isPreviewCardPinned = false;
    this.hoveredChannel = null;
    this.currentLocation = '';
  }

  private timeout?: ReturnType<typeof setTimeout>;

  private schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const task = globalThis.setTimeout(() => {
      this.scheduledTasks.delete(task);
      callback();
    }, delay);
    this.scheduledTasks.add(task);
    return task;
  }

  stopAvatarHover() {
    clearTimeout(this.hoverOpenTimeout);
    if (this.isPreviewCardPinned) return;
    this.timeout = this.schedule(() => {
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

  private excludedLocations: AvatarLocation[] = ['channel-preview', 'channel-header'];

  shouldShowDropdown(channel: Channel | undefined, location: AvatarLocation): boolean {
    if (!this.excludedLocations.includes(location)) {
      return false;
    }

    const firstCheck = (this.currentLocation === location)
      && (this.hoveredChannel !== null)
      && this.channels.isPrivate(this.hoveredChannel);

    return firstCheck && !!channel && channel.cid === this.hoveredChannel?.cid;
  }

  setPeopleMode(mode: string) {
    this.peopleMode = mode as 'requests' | 'friends' | 'blocked';
    this.openPeopleAndSetupData();
  }

  protected get peopleIndex(): number {
    return this.peopleMode === 'requests' ? 1 : this.peopleMode === 'blocked' ? 2 : 0;
  }

  protected onPeopleIndexChange(index: number): void {
    // Picking a tab is a request to see that tab. The field searches every account whichever one is
    // showing, but it must not sit over the view the user just asked for.
    this.usernameFormControl.setValue('');
    this.setPeopleMode((['friends', 'requests', 'blocked'] as const)[index] ?? 'friends');
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
    this.schedule(() => {
      this.chatInputRef?.nativeElement.focus();
    }, 100);
  }

  protected prepareConfirmModalForChatDeletion(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);
    this.confirmation.open({
      title: 'Delete chat',
      message: 'The chat and its messages are removed for both of you. This cannot be undone.',
      confirmText: 'Delete',
      action: () => void channel.delete(),
    });
  }

  protected prepareChatTruncationConfirmationModal(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);
    this.confirmation.open({
      title: 'Clear history',
      message: 'Every message in this chat is removed for you. This cannot be undone.',
      confirmText: 'Clear',
      action: () => void channel.truncate(),
    });
  }

  /**
   * Leaving is reversible, so the modal names the channel and commits in plum. It lives in the
   * row menu; the header carries no permanent Leave button.
   */
  private confirmLeave(channel: Channel) {
    const name = this.channels.name(channel, 'this channel');
    this.confirmation.open({
      title: `Leave ${name}?`,
      message: `You will stop receiving ${this.channels.topic(channel)} updates here. You can rejoin from search at any time.`,
      confirmText: 'Leave',
      tone: 'default',
      action: () => {
        void channel.show();
        void channel.unmute();
        void channel.removeMembers([this.userInfo!.id]);
      },
    });
  }

  protected prepareLeaveChannelModal(channel: Channel, dropdown: TuiDropdownDirective) {
    this.closeRowMenu(dropdown);
    this.confirmLeave(channel);
  }

  protected prepareUnfriendModal(friendId: string, friendshipId: string) {
    this.closePeople();
    this.confirmation.open({
      title: 'Unfriend',
      message: 'Are you sure you want to unfriend this user?',
      confirmText: 'Unfriend',
      action: () => this.unfriend(friendId, friendshipId),
    });
  }

  protected prepareBlockModal(friendId: string, friendshipId: string) {
    this.closePeople();
    this.confirmation.open({
      title: 'Block User',
      message: 'Are you sure you want to block this user?',
      confirmText: 'Block',
      action: () => this.block(friendId, friendshipId),
    });
  }
}
