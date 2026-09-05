import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../app.constants';
import {environment} from '../../../environments/environment';
import {
  AddedWordsResult,
  Deck,
  parseAddedWordsResult,
  parseDeck,
  parseSharedCardView,
  parseSharedDeckView,
  parseViewerStatus,
  SharedCardView,
  SharedDeckView,
  SharedLinkViewerStatus,
} from './shared-link.model';

/** The two routes a link can open, and what a signed-in viewer may do there. */
@Injectable({providedIn: 'root'})
export class SharedLinkService {
  private http = inject(HttpClient);

  /** The public read: the same answer for everyone, signed in or not. */
  getCard(publicId: string): Observable<SharedCardView> {
    return this.http.get<unknown>(`${AppConstants.PUBLIC_SHARES_URL}/cards/${publicId}`)
      .pipe(map(parseSharedCardView));
  }

  getDeck(shareId: string): Observable<SharedDeckView> {
    return this.http.get<unknown>(`${AppConstants.PUBLIC_SHARES_URL}/decks/${shareId}`)
      .pipe(map(parseSharedDeckView));
  }

  cardViewer(publicId: string): Observable<SharedLinkViewerStatus> {
    return this.http.get<unknown>(`${AppConstants.SHARES_URL}/cards/${publicId}/viewer`, {withCredentials: true})
      .pipe(map(parseViewerStatus));
  }

  deckViewer(shareId: string): Observable<SharedLinkViewerStatus> {
    return this.http.get<unknown>(`${AppConstants.SHARES_URL}/decks/${shareId}/viewer`, {withCredentials: true})
      .pipe(map(parseViewerStatus));
  }

  addCard(publicId: string): Observable<AddedWordsResult> {
    return this.http.post<unknown>(`${AppConstants.SHARES_URL}/cards/${publicId}/words`, {}, {withCredentials: true})
      .pipe(map(parseAddedWordsResult));
  }

  addFromDeck(shareId: string, wordIds: string[]): Observable<AddedWordsResult> {
    return this.http.post<unknown>(`${AppConstants.SHARES_URL}/decks/${shareId}/words`, {wordIds}, {withCredentials: true})
      .pipe(map(parseAddedWordsResult));
  }

  /** The owner's decks: the one whose share id matches is the one behind the page they are on. */
  myDecks(): Observable<Deck[]> {
    return this.http.get<unknown[]>(AppConstants.DECKS_URL, {withCredentials: true})
      .pipe(map(decks => decks.map(deck => parseDeck(deck))));
  }

  setShareEnabled(deckId: string, shareEnabled: boolean): Observable<Deck> {
    return this.http.patch<unknown>(`${AppConstants.DECKS_URL}/${deckId}`, {shareEnabled}, {withCredentials: true})
      .pipe(map(parseDeck));
  }

  deckLink(shareId: string): string {
    return `${environment.feUrl}/d/${shareId}`;
  }

  cardLink(publicId: string): string {
    return `${environment.feUrl}/c/${publicId}`;
  }
}
