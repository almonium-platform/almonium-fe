import {logger} from "../logger";
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Interest} from './interest.model';

import {TuiChip} from '@taiga-ui/kit/components';
import {TuiSkeleton} from '@taiga-ui/kit/directives';
import {FormsModule} from '@angular/forms';
import {StaticInfoService} from '../../services/static-info.service';

@Component({
  selector: 'app-interests',
  imports: [
    TuiChip,
    FormsModule,
    TuiSkeleton,
  ],
  templateUrl: './interests.component.html',
  styleUrl: './interests.component.less',
})
export class InterestsComponent implements OnInit {
  private staticInfoService = inject(StaticInfoService);
  private alertService = inject(TuiNotificationService);

  protected interests: Interest[] = [];
  protected loading = true;
  @Input() currentInterests: Interest[] = [];
  @Output() selectedInterestsChange = new EventEmitter<Interest[]>(); // Emit selected interests

  private readonly curatedInterestNames = new Set([
    'Geography', 'Travel', 'Sports', 'History', 'Politics',
    'Environment & Sustainability', 'Science & Technology', 'Languages & Linguistics',
    'Lifestyle & Self-Improvement', 'Literature & Books', 'Philosophy', 'Economy & Finance',
    'Psychology', 'Parenting & Family', 'Relationships', 'Animals & Wildlife', 'Food & Cooking',
    'Space', 'Fashion & Style', 'Arts & Culture',
  ]);

  ngOnInit() {
    this.staticInfoService.getInterests().subscribe({
      next: (interests) => {
        setTimeout(() => {
          this.interests = interests.filter(interest => this.curatedInterestNames.has(interest.name));
          this.loading = false;
          this.currentInterests.forEach((selectedInterest) => {
            const interest = this.interests.find((i) => i.name === selectedInterest.name);
            if (interest) {
              interest.selected = true;
            }
          });
          this.onInterestChange();
        }, 500);
      },
      error: (error) => {
        logger.error('Failed to get interests', error);
        this.alertService.open('Failed to get interests', {appearance: 'negative'}).subscribe();
      },
    });
  }

  // Emit the selected interests whenever they change
  protected onInterestChange() {
    this.selectedInterestsChange.emit(this.interests.filter((i) => i.selected));
  }
}
