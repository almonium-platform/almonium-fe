import {Component, Input} from '@angular/core';
import {OnboardingService} from "../onboarding.service";
import {TuiAlertService} from "@taiga-ui/core";
import {UserInfoService} from "../../services/user-info.service";
import {SetupStep} from "../../models/userinfo.model";
import {Interest} from "../../shared/interests/interest.model";
import {FormsModule} from "@angular/forms";
import {InterestsComponent} from "../../shared/interests/interests.component";

@Component({
  selector: 'app-interests-setup',
  imports: [
    FormsModule,
    InterestsComponent
  ],
  templateUrl: './interests-setup.component.html',
  styleUrl: './interests-setup.component.less'
})
export class InterestsSetupComponent {
  @Input() currentInterests: Interest[] = [];
  protected selectedInterests: Interest[] = [];

  constructor(
    private onboardingService: OnboardingService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
  ) {
  }

  submit() {
    this.onboardingService.saveInterests(this.selectedInterests.map(i => i.id)).subscribe({
      next: () => {
        this.userInfoService.updateUserInfo({setupStep: SetupStep.COMPLETED});
      },
      error: (error) => {
        console.error('Failed to save interests', error);
        this.alertService.open('Failed to save interests', {appearance: 'error'}).subscribe();
      }
    });
  }

  onSelectedInterestsChange(interests: Interest[]) {
    this.selectedInterests = interests; // Update selected interests
    this.userInfoService.updateUserInfo({interests: interests});
  }
}
