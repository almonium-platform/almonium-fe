import {Component, OnInit} from '@angular/core';
import {ParticlesComponent} from "../particles/particles.component";
import {UserInfoService} from "../../services/user-info.service";
import {ProfileService} from "../user-preview-card/profile.service";
import {ActivatedRoute} from "@angular/router";
import {TuiAlertService} from "@taiga-ui/core";
import {UserPreviewCardComponent} from "../user-preview-card/user-preview-card.component";
import {UserProfileInfo} from "../user-preview-card/user-profile.model";

@Component({
  selector: 'app-user-card',
  template: `
    <app-particles></app-particles>
    @if (publicProfile) {
      <div class="flex items-center justify-center w-full h-full base-container">
        <app-user-preview-card class="relative" [publicProfile]="publicProfile"></app-user-preview-card>
      </div>
    }
  `,
  standalone: true,
  imports: [
    ParticlesComponent,
    UserPreviewCardComponent
  ]
})
export class UserCardComponent implements OnInit {
  username: string | null = null;  // Store the username
  publicProfile: UserProfileInfo | null = null;

  constructor(
    private userInfoService: UserInfoService,
    private profileService: ProfileService,
    private route: ActivatedRoute,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit(): void {
    this.username = this.route.snapshot.paramMap.get('username');
    if (!this.username) {
      this.alertService.open('No userId provided', {appearance: 'error'}).subscribe();
      return;
    }

    this.profileService.getUserPublicProfile(this.username)
      .subscribe({
        next: (profileInfo) => {
          this.publicProfile = profileInfo;
        },
        error: (error) => {
          this.alertService.open(error.error?.message || "Couldn't get profile", {appearance: 'error'}).subscribe();
        },
      });

    //
    // this.userInfoService.userInfo$.subscribe(userInfo => {
    //   if (!userInfo) {
    //     // call public
    //   } else {
    //   }
    // });
  }
}
