import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {StreamChat} from "stream-chat";
import {environment} from "../../../environments/environment";
import {UserInfoService} from "../../services/user-info.service";

@Injectable({
  providedIn: 'root',
})
export class ChatUnreadService {
  private unreadCount$ = new BehaviorSubject<number>(0);
  private chatClient: StreamChat;

  constructor(
    private userInfoService: UserInfoService,
  ) {
    this.chatClient = StreamChat.getInstance(environment.streamChatApiKey);

    // Listen to unread count updates from Stream events
    this.chatClient.on((event) => {
      if (event.total_unread_count !== undefined) {
        this.updateUnreadCount(event.total_unread_count);
      }
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
