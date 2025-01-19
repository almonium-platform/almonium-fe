import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {TuiAlertService, TuiAutoColorPipe} from '@taiga-ui/core';
import {Interest} from './interest.model';

import {TuiChip, TuiSkeleton} from '@taiga-ui/kit';
import {FormsModule} from '@angular/forms';
import {StaticInfoService} from '../../services/static-info.service';

@Component({
  selector: 'app-interests',
  imports: [
    TuiChip,
    FormsModule,
    TuiAutoColorPipe,
    TuiSkeleton,
  ],
  templateUrl: './interests.component.html',
  styleUrl: './interests.component.less',
})
export class InterestsComponent implements OnInit {
  protected interests: Interest[] = [];
  protected loading: boolean = true;
  @Input() currentInterests: Interest[] = [];
  @Output() selectedInterestsChange = new EventEmitter<Interest[]>(); // Emit selected interests

  private predefinedInterests: Interest[] = [
    {id: 0, name: 'Geography'},
    {id: 0, name: 'Travel'},
    {id: 0, name: 'Sports'},
    {id: 0, name: 'History'},
    {id: 0, name: 'Politics'},
    {id: 0, name: 'Internet Culture & Memes'},
    {id: 0, name: 'Entertainment & Celebrities'},
    {id: 0, name: 'Environment & Sustainability'},
    {id: 0, name: 'Science & Technology'},
    {id: 0, name: 'Languages & Linguistics'},
    {id: 0, name: 'Lifestyle & Self-Improvement'},
    {id: 0, name: 'Innovation & Trends'},
    {id: 0, name: 'Literature & Books'},
    {id: 0, name: 'Philosophy'},
    {id: 0, name: 'Economy & Finance'},
    {id: 0, name: 'Psychology'},
    {id: 0, name: 'Parenting & Family'},
    {id: 0, name: 'Relationships'},
    {id: 0, name: 'Animals & Wildlife'},
    {id: 0, name: 'Food & Cooking'},
    {id: 0, name: 'Space'},
    {id: 0, name: 'Fashion & Style'},
    {id: 0, name: 'Startups & Entrepreneurship'},
    {id: 0, name: 'Arts & Culture'},
    {id: 0, name: 'Movies & Series'},
    {id: 0, name: 'Health & Wellness'},
    {id: 0, name: 'Mythology & Folklore'},
    {id: 0, name: 'Music'},
    {id: 0, name: 'Gaming'},
    {id: 0, name: 'Education'},
  ];

  constructor(
    private staticInfoService: StaticInfoService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit() {
    this.interests = this.predefinedInterests;

    this.staticInfoService.getInterests().subscribe({
      next: (interests) => {
        setTimeout(() => {
          this.interests = interests;
          this.loading = false;
          this.currentInterests.forEach((selectedInterest) => {
            const interest = this.interests.find((i) => i.name === selectedInterest.name);
            if (interest) {
              interest.selected = true;
            }
          });
        }, 500);
      },
      error: (error) => {
        console.error('Failed to get interests', error);
        this.alertService.open('Failed to get interests', {appearance: 'error'}).subscribe();
      },
    });
  }

  // Emit the selected interests whenever they change
  protected onInterestChange() {
    this.selectedInterestsChange.emit(this.interests.filter((i) => i.selected));
  }
}
