import {Component, OnInit} from '@angular/core';
import {ParticlesComponent} from "../particles/particles.component";
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

    if (this.isUUID(this.username)) {
      this.profileService.getUserPublicProfileById(this.username).subscribe({
        next: (profileInfo) => {
          this.publicProfile = profileInfo;
        },
        error: (error) => {
          this.alertService.open(error.error?.message || "Couldn't get profile", {appearance: 'error'}).subscribe();
        },
      });
    } else {
      this.profileService.getUserPublicProfileByUsername(this.username).subscribe({
        next: (profileInfo) => {
          this.publicProfile = profileInfo;
        },
        error: (error) => {
          this.alertService.open(error.error?.message || "Couldn't get profile", {appearance: 'error'}).subscribe();
        },
      });
    }
  }

  /**
   * Helper function to check if a string is a valid UUID (v4 or v7)
   */
  private isUUID(input: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(input);
  }
}
