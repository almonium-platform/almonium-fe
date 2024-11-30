import {Component, OnDestroy, OnInit} from '@angular/core';
import {RecentAuthGuardStateService} from "./recent-auth-guard-state.service";
import {NgIf} from "@angular/common";
import {AuthComponent} from "../../authentication/auth/auth.component";
import {Subscription} from "rxjs";

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
  protected visible = false;
  private subscription: Subscription | undefined;

  constructor(
    private recentGuardService: RecentAuthGuardStateService
  ) {
  }

  ngOnInit() {
    this.subscription = this.recentGuardService.recentAuthState$.subscribe((state) => {
      this.visible = state.visible;
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  closeAuthModal() {
    this.visible = false;
  }
}
