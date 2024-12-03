import {Component, OnDestroy, OnInit} from '@angular/core';
import {RecentAuthGuardStateService} from "./recent-auth-guard-state.service";
import {NgIf} from "@angular/common";
import {AuthComponent} from "../../authentication/auth/auth.component";
import {Subject, takeUntil} from "rxjs";

@Component({
  selector: 'app-recent-auth-guard',
  template: `
    <div *ngIf="visible" class="auth-modal-overlay">
      <app-auth (close)="closeAuthModal()" [mode]="'embedded'"></app-auth>
    </div>
  `,
  imports: [
    NgIf,
    AuthComponent
  ],
})
export class RecentAuthGuardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  protected visible = false;

  constructor(
    private recentGuardService: RecentAuthGuardStateService
  ) {
  }

  ngOnInit() {
    this.recentGuardService.recentAuthState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.visible = state.visible;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeAuthModal() {
    this.visible = false;
  }
}
