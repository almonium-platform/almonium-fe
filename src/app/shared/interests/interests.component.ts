import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {TuiAlertService, TuiAutoColorPipe} from "@taiga-ui/core";
import {Interest} from "./interest.model";
import {NgForOf} from "@angular/common";
import {TuiChip, TuiSkeleton} from "@taiga-ui/kit";
import {FormsModule} from "@angular/forms";
import {StaticInfoService} from "../../services/static-info.service";

@Component({
  selector: 'app-interests',
  imports: [
    NgForOf,
    TuiChip,
    FormsModule,
    TuiAutoColorPipe,
    TuiSkeleton
  ],
  templateUrl: './interests.component.html',
  styleUrl: './interests.component.less'
})
export class InterestsComponent implements OnInit {
  protected interests: Interest[] = [];
  protected loading: boolean = true;
  @Input() currentInterests: Interest[] = [];
  @Output() selectedInterestsChange = new EventEmitter<Interest[]>(); // Emit selected interests

  constructor(
    private staticInfoService: StaticInfoService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit() {
    this.populateSkeletons();
    this.staticInfoService.getInterests().subscribe({
      next: (interests) => {
        this.interests = interests.sort(() => Math.random() - 0.5);
        setTimeout(() => {
          this.loading = false;
          // this.interests = interests;
          this.currentInterests.forEach(selectedInterest => {
            const interest = this.interests.find(i => i.id === selectedInterest.id);
            if (interest) {
              interest.selected = true;
            }
          });
        }, 500);
      },
      error: (error) => {
        console.error('Failed to get interests', error);
        this.alertService.open('Failed to get interests', {appearance: 'error'}).subscribe();
      }
    });
  }

  // Emit the selected interests whenever they change
  protected onInterestChange() {
    this.selectedInterestsChange.emit(this.interests.filter(i => i.selected));
  }

  private getRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  private populateSkeletons() {
    // generate 33 skeletons of interests with random text length from 5 to 12
    this.interests = new Array(33).fill(null).map(() => ({
      id: 0,
      name: this.getRandomString(Math.floor(Math.random() * 7) + 5), // Random length between 6 and 12
      selected: false
    }));
  }
}
