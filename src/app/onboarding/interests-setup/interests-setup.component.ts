import {logger} from "../../shared/logger";
import {TuiNotificationService} from "@taiga-ui/core/components";
import {Component, EventEmitter, Input, OnInit, Output, inject} from '@angular/core';
import {OnboardingService} from "../onboarding.service";
import {UserInfoService} from "../../services/user-info.service";
import {SetupStep} from "../../models/userinfo.model";
import {Interest} from "../../shared/interests/interest.model";
import {FormsModule} from "@angular/forms";
import {InterestsComponent} from "../../shared/interests/interests.component";
import {ButtonComponent} from "../../shared/button/button.component";
import {BehaviorSubject, finalize} from "rxjs";
import {OnboardingDraftService} from "../onboarding-draft.service";

@Component({
  selector: 'app-interests-setup',
  imports: [
    FormsModule,
    InterestsComponent,
    ButtonComponent
  ],
  templateUrl: './interests-setup.component.html',
  styleUrl: './interests-setup.component.less'
})
export class InterestsSetupComponent implements OnInit {
  private onboardingService = inject(OnboardingService);
  private alertService = inject(TuiNotificationService);
  private userInfoService = inject(UserInfoService);
  private draft = inject(OnboardingDraftService);

  @Input() currentInterests: Interest[] = [];
  @Output() back = new EventEmitter<void>();
  /** What the chips start with: the picks left before a drop-off, else what the server already has. */
  protected initialInterests: Interest[] = [];
  protected selectedInterests: Interest[] = [];
  /** A soft floor: below it the button is outlined and a line says why, but it never blocks. */
  protected readonly softFloor = 3;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  ngOnInit() {
    this.initialInterests = this.draft.read('interests') ?? this.currentInterests;
  }

  submit() {
    this.loadingSubject$.next(true);

    this.onboardingService.saveInterests(this.selectedInterests.map(i => i.id))
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.draft.discard('interests');
          this.userInfoService.updateUserInfo({setupStep: SetupStep.PROFILE});
        },
        error: (error) => {
          logger.error('Failed to save interests', error);
          this.alertService.open('Failed to save interests', {appearance: 'negative'}).subscribe();
        }
      });
  }

  protected get atFloor(): boolean {
    return this.selectedInterests.length >= this.softFloor;
  }

  onSelectedInterestsChange(interests: Interest[]) {
    this.selectedInterests = interests; // Update selected interests
    this.draft.write('interests', interests.map(({id, name}) => ({id, name})));
    this.userInfoService.updateUserInfo({interests: interests});
  }
}
