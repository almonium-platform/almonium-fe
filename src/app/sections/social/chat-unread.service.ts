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
    console.log('ChatUnreadService initialized');

    // Listen to unread count updates from Stream events
    this.chatClient.on((event) => {
      if (event.total_unread_count !== undefined) {
        console.log('Updated unread count:', event.total_unread_count);
        this.updateUnreadCount(event.total_unread_count);
      }
    });
    this.userInfoService.userInfo$.subscribe((userInfo) => {
      if (!userInfo) {
        return;
      }
      this.chatClient.connectUser(
        {id: userInfo.id},
        userInfo.streamChatToken
      ).then(() => {
        this.fetchUnreadCount().then(() => {
          console.log('Fetched unread count');
        });
      });
    });
  }

  private updateUnreadCount(count: number) {
    this.unreadCount$.next(count);
  }

  getUnreadCount() {
    return this.unreadCount$.asObservable();
  }

  async fetchUnreadCount() {
    const unreadCount = Number(this.chatClient.user?.total_unread_count ?? 0);
    this.updateUnreadCount(unreadCount);
  }
}
