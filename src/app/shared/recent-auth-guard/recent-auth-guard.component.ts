import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {RecentAuthGuardStateService} from "./recent-auth-guard-state.service";
import {AuthComponent} from "../../authentication/auth/auth.component";
import {Subject, takeUntil} from "rxjs";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";

@Component({
  selector: 'app-recent-auth-guard',
  template: `
    <app-auth mode="embedded"></app-auth>
  `,
  imports: [
    AuthComponent
  ],
})
export class RecentAuthGuardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  @ViewChild(AuthComponent, {static: true}) authComponent!: AuthComponent;

  constructor(
    private recentGuardService: RecentAuthGuardStateService,
    private popupTemplateStateService: PopupTemplateStateService,
  ) {
  }

  ngOnInit() {
    this.recentGuardService.recentAuthState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
          if (state.visible) {
            this.popupTemplateStateService.open(this.authComponent.content, 'auth', true);
          } else {
            this.popupTemplateStateService.close();
          }
        }
      );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
