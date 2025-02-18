import {Injectable} from '@angular/core';
import {BehaviorSubject, fromEventPattern} from 'rxjs';
import {StreamChat} from "stream-chat";
import {environment} from "../../../environments/environment";
import {UserInfoService} from "../../services/user-info.service";
import {LocalStorageService} from "../../services/local-storage.service";
import {SocialService} from "./social.service";

@Injectable({
  providedIn: 'root',
})
export class ChatUnreadService {
  private unreadCount$ = new BehaviorSubject<number>(0);
  private chatClient: StreamChat;
  private friendIds: number[] = [];

  constructor(
    private userInfoService: UserInfoService,
    private localStorageService: LocalStorageService,
    private socialService: SocialService,
  ) {
    this.chatClient = StreamChat.getInstance(environment.streamChatApiKey);

    // Listen to unread count updates from Stream events
    this.chatClient.on((event) => {
      if (event.total_unread_count !== undefined) {
        this.updateUnreadCount(event.total_unread_count);
      }
    });

    // todo replace, friends should be part of userInfo
    this.socialService.getFriends().subscribe((friends) => {
      this.friendIds = friends.map((f) => f.id);
    });

    this.userInfoService.userInfo$.subscribe((userInfo) => {
      if (!userInfo) {
        return;
      }
      if (!this.chatClient.user) {
        this.chatClient.connectUser(
          {id: userInfo.id},
          userInfo.streamChatToken
        ).then(() => {
          this.fetchUnreadCount().then(() => {
          });
        });
      }
    });

    fromEventPattern(
      (handler) => this.chatClient.on('user.presence.changed', handler),
      (handler) => this.chatClient.off('user.presence.changed', handler)
    ).subscribe((event: any) => {
      if (this.friendIds.includes(Number(event.user?.id))) {
        this.localStorageService.saveLastSeen(event.user.id, new Date());
      }
    });
  }

  public getUnreadCount() {
    return this.unreadCount$.asObservable();
  }

  public async fetchUnreadCount() {
    const unreadCount = Number(this.chatClient.user?.total_unread_count ?? 0);
    this.updateUnreadCount(unreadCount);
  }

  private updateUnreadCount(count: number) {
    this.unreadCount$.next(count);
  }
}
