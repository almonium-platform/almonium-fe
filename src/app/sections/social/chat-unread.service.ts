import { Injectable, inject } from '@angular/core';
import {BehaviorSubject, fromEventPattern} from 'rxjs';
import {Event as StreamEvent, OwnUserResponse, StreamChat, UserResponse} from "stream-chat";
import {environment} from "../../../environments/environment";
import {UserInfoService} from "../../services/user-info.service";
import {LocalStorageService} from "../../services/local-storage.service";
import {SocialService} from "./social.service";

@Injectable({
  providedIn: 'root',
})
export class ChatUnreadService {
  private userInfoService = inject(UserInfoService);
  private localStorageService = inject(LocalStorageService);
  private socialService = inject(SocialService);

  private unreadCount$ = new BehaviorSubject<number>(0);
  private chatClient: StreamChat;
  private friendIds: string[] = [];

  constructor() {
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
        void this.chatClient.connectUser(
          {id: userInfo.id},
          userInfo.streamChatToken
        ).then(() => {
          void this.fetchUnreadCount();
        });
      }
    });

    fromEventPattern<StreamEvent>(
      (handler) => this.chatClient.on('user.presence.changed', handler),
      (handler) => this.chatClient.off('user.presence.changed', handler)
    ).subscribe(event => {
      if (event.user?.id && this.friendIds.includes(event.user.id)) {
        this.localStorageService.saveLastSeen(event.user.id, new Date());
      }
    });
  }

  public getUnreadCount() {
    return this.unreadCount$.asObservable();
  }

  public isOwnUser(u: UserResponse | OwnUserResponse | undefined): u is OwnUserResponse {
    return !!u && 'total_unread_count' in u;
  }

  public fetchUnreadCount(): void {
    const u = this.chatClient.user;
    const unreadCount = this.isOwnUser(u) ? Number(u.total_unread_count ?? 0) : 0;
    this.updateUnreadCount(unreadCount);
  }

  private updateUnreadCount(count: number) {
    this.unreadCount$.next(count);
  }
}
