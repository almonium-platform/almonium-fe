import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../../app.constants';
import {AlmoChat, AlmoReply, parseAlmoChats, parseAlmoReply} from './almo-chat.model';

/**
 * The part of Almo's channel that Stream cannot do. The messages travel through Stream like any
 * other chat's; this asks the server for the channels' existence, and for the reply.
 */
@Injectable({providedIn: 'root'})
export class AlmoChatService {
  private readonly http = inject(HttpClient);

  /** One channel per active target language for a member, nothing for a free account. Idempotent. */
  ensureChats(): Observable<AlmoChat[]> {
    return this.http
      .post<unknown>(AppConstants.ALMO_CHATS_URL, {}, {withCredentials: true})
      .pipe(map(value => parseAlmoChats(value)));
  }

  /** Asks Almo to answer the message the learner just sent in that language's channel. */
  requestReply(language: string, userMessageId: string): Observable<AlmoReply> {
    return this.http
      .post<unknown>(
        `${AppConstants.ALMO_CHATS_URL}/${encodeURIComponent(language)}/replies`,
        {userMessageId},
        {withCredentials: true},
      )
      .pipe(map(value => parseAlmoReply(value)));
  }
}
