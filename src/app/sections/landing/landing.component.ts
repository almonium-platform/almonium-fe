import {Component, OnInit, inject, ChangeDetectionStrategy} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {LANDING_ACCOUNT_DELETED_PARAM} from '../../authentication/logout/logout-reason';
import {PaywallComponent} from '../../shared/paywall/paywall.component';
import {APP_STORE_URL, PLAY_STORE_URL} from '../../shared/store-links';
import {PublicFooterComponent} from '../../shared/public-footer/public-footer.component';
import {LandingBooksComponent} from './books/landing-books.component';
import {LandingFeedbackComponent} from './feedback/landing-feedback.component';
import {LandingLexiconComponent} from './lexicon/landing-lexicon.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgTemplateOutlet, PaywallComponent, PublicFooterComponent, LandingFeedbackComponent, LandingBooksComponent, LandingLexiconComponent],
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './landing.component.less'
})
export class LandingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alerts = inject(TuiNotificationService);

  protected readonly appStoreUrl = APP_STORE_URL;
  protected readonly playStoreUrl = PLAY_STORE_URL;

  /** The crossword card's drawing: ATTENDRE across, with four words hanging from it. */
  protected readonly crosswordCells = [
    {row: 1, column: 7, letter: 'O'},
    ...[...'ATTENDRE'].map((letter, index) => ({row: 2, column: index + 1, letter})),
    {row: 3, column: 2, letter: 'I'}, {row: 3, column: 4, letter: 'P'}, {row: 3, column: 7, letter: 'A'},
    {row: 4, column: 2, letter: 'E'}, {row: 4, column: 4, letter: 'A'}, {row: 4, column: 7, letter: 'G'},
    {row: 5, column: 2, letter: 'D'}, {row: 5, column: 4, letter: 'U'}, {row: 5, column: 7, letter: 'E'},
  ];

  /** The Deep end card's drawing: three rungs held, the one being tried, two not reached. */
  protected readonly ladderRungs = [
    {label: $localize`200th`, state: 'held'},
    {label: $localize`500th`, state: 'held'},
    {label: $localize`1,000th`, state: 'held'},
    {label: $localize`2,000th`, state: 'current'},
    {label: $localize`3,000th`, state: 'ahead'},
    {label: $localize`5,000th`, state: 'ahead'},
  ];

  ngOnInit(): void {
    this.acknowledgeDeletedAccount();
  }

  /**
   * The logout route hard-reloads into `/?deleted=1` after an account is deleted, so the toast the
   * settings page would have shown cannot survive. It is shown here instead, once, and the flag is
   * dropped from the URL so a refresh or a shared link does not repeat it.
   */
  private acknowledgeDeletedAccount(): void {
    if (this.route.snapshot.queryParamMap.get(LANDING_ACCOUNT_DELETED_PARAM) !== '1') return;
    this.alerts.open($localize`Your account has been deleted.`, {appearance: 'positive'}).subscribe();
    void this.router.navigate([], {queryParams: {[LANDING_ACCOUNT_DELETED_PARAM]: null}, replaceUrl: true});
  }
}
