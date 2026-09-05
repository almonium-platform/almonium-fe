import {logger} from '../../../shared/logger';
import {getErrorMessage} from '../../../shared/http-error';
import {ChangeDetectorRef, Component, DestroyRef, inject, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Meta, Title} from '@angular/platform-browser';
import {AsyncPipe} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {HttpErrorResponse} from '@angular/common/http';
import {BehaviorSubject, finalize, forkJoin, of, switchMap} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AvatarComponent} from '../../../shared/avatar/avatar.component';
import {SharedWordComponent} from '../shared-word/shared-word.component';
import {SharedFooterComponent} from '../shared-footer/shared-footer.component';
import {DeadLinkComponent} from '../dead-link/dead-link.component';
import {SharedLinkService} from '../shared-link.service';
import {AddedWordsResult, SharedCardView, SharedLinkViewerStatus} from '../shared-link.model';
import {UserInfoService} from '../../../services/user-info.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {ReturnPathService} from '../../../services/return-path.service';
import {SetupStep, UserInfo} from '../../../models/userinfo.model';
import {languageBadgeFill} from '../language-badge';

type CardPanel = 'none' | 'sign-up' | 'add' | 'added' | 'held' | 'owner' | 'wrong-language';

/**
 * One card opened from a link. The card is given away in full - the word, every sense, every example - because a
 * half-shown card is a worse advertisement than a whole one. One primary action on the whole page, after the content.
 */
@Component({
  selector: 'app-shared-card',
  templateUrl: './shared-card.component.html',
  styleUrls: ['./shared-card.component.less'],
  imports: [RouterLink, AsyncPipe, AvatarComponent, SharedWordComponent, SharedFooterComponent, DeadLinkComponent],
})
export class SharedCardComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sharedLinkService = inject(SharedLinkService);
  private userInfoService = inject(UserInfoService);
  private languageNameService = inject(LanguageNameService);
  private returnPath = inject(ReturnPathService);
  private alertService = inject(TuiNotificationService);
  private pageTitle = inject(Title);
  private meta = inject(Meta);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  protected publicId = '';
  protected view: SharedCardView | null = null;
  protected viewer: SharedLinkViewerStatus | null = null;
  protected userInfo: UserInfo | null = null;
  protected sessionChecked = false;
  protected loading = true;
  protected loadError: string | null = null;
  protected deleted = false;
  protected lastAdded: AddedWordsResult | null = null;
  protected readonly adding$ = new BehaviorSubject(false);

  ngOnInit(): void {
    this.meta.updateTag({name: 'robots', content: 'noindex'});
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.publicId = params.get('id') ?? '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.meta.removeTag("name='robots'");
  }

  private load(): void {
    this.loading = true;
    this.loadError = null;
    forkJoin({
      view: this.sharedLinkService.getCard(this.publicId),
      user: this.userInfoService.loadUserInfo().pipe(catchError(() => of(null))),
    }).pipe(
      switchMap(({view, user}) => {
        this.view = view;
        this.userInfo = user;
        this.sessionChecked = true;
        this.pageTitle.setTitle(`${view.word.entry} · Shared card | Almonium`);
        if (user && this.returnPath.peek() === this.router.url) this.returnPath.consume();
        if (user && user.setupStep !== SetupStep.COMPLETED) {
          this.returnPath.remember(this.router.url);
          void this.router.navigate(['/onboarding']);
          return of(null);
        }
        if (!user) return of(null);
        return this.sharedLinkService.cardViewer(this.publicId);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: viewer => {
        this.viewer = viewer;
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          // A card link has no switch: the only way it dies is the card being deleted.
          this.deleted = true;
          return;
        }
        logger.error('Could not open the shared card', error);
        this.loadError = getErrorMessage(error, 'The card could not be opened. Please try again.');
      },
    });
  }

  get signedIn(): boolean {
    return !!this.userInfo;
  }

  get languageName(): string {
    return this.languageNameService.getLanguageName(this.view?.language);
  }

  get badgeFill(): string {
    return languageBadgeFill(this.view?.language ?? '');
  }

  get sharerProfileLink(): string | null {
    const username = this.view?.sharer.username;
    return this.signedIn && username ? `/users/${username}` : null;
  }

  get panel(): CardPanel {
    if (!this.view) return 'none';
    if (!this.signedIn) return 'sign-up';
    if (!this.viewer) return 'none';
    if (this.viewer.owner) return 'owner';
    if (this.lastAdded) return 'added';
    if (!this.viewer.hasLearner) return 'wrong-language';
    if (this.viewer.heldWordIds.length > 0) return 'held';
    return 'add';
  }

  get dueNote(): string {
    return (this.viewer?.dueAmongHeld ?? 0) > 0 ? 'it is due' : 'it is not due yet';
  }

  add(): void {
    this.adding$.next(true);
    this.sharedLinkService.addCard(this.publicId)
      .pipe(finalize(() => this.adding$.next(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.lastAdded = result;
          this.cdr.detectChanges();
        },
        error: (error: unknown) => this.alertService
          .open(getErrorMessage(error, 'The word could not be added. Please try again.'), {appearance: 'negative'})
          .subscribe(),
      });
  }

  createAccount(): void {
    this.returnPath.remember(this.router.url);
    void this.router.navigate(['/auth'], {fragment: 'sign-up'});
  }

  signIn(): void {
    this.returnPath.remember(this.router.url);
    void this.router.navigate(['/auth']);
  }
}
