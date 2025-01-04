import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {TuiAlertService, TuiAutoColorPipe} from "@taiga-ui/core";
import {Interest} from "./interest.model";
import {NgForOf} from "@angular/common";
import {TuiChip} from "@taiga-ui/kit";
import {FormsModule} from "@angular/forms";
import {StaticInfoService} from "../../services/static-info.service";

@Component({
  selector: 'app-interests',
  imports: [
    NgForOf,
    TuiChip,
    FormsModule,
    TuiAutoColorPipe
  ],
  templateUrl: './interests.component.html',
  styleUrl: './interests.component.less'
})
export class InterestsComponent implements OnInit {
  protected interests: Interest[] = [];
  @Input() currentInterests: Interest[] = [];
  @Output() selectedInterestsChange = new EventEmitter<Interest[]>(); // Emit selected interests

  constructor(
    private staticInfoService: StaticInfoService,
    private alertService: TuiAlertService,
  ) {
  }

  ngOnInit() {
    this.staticInfoService.getInterests().subscribe({
      next: (interests) => {
        this.interests = interests.sort(() => Math.random() - 0.5);
        this.currentInterests.forEach(selectedInterest => {
          const interest = this.interests.find(i => i.id === selectedInterest.id);
          if (interest) {
            interest.selected = true;
          }
        });
      },
      error: (error) => {
        console.error('Failed to get interests', error);
        this.alertService.open('Failed to get interests', {appearance: 'error'}).subscribe();
      }
    });
  }

  // Emit the selected interests whenever they change
  onInterestChange() {
    this.selectedInterestsChange.emit(this.interests.filter(i => i.selected));
  }
}
