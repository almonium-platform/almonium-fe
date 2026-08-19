import {logger} from "../logger";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import {RecentAuthGuardStateService} from "./recent-auth-guard-state.service";
import {AuthComponent} from "../../authentication/auth/auth.component";
import {filter, Subject, takeUntil} from "rxjs";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";

@Component({
  selector: 'app-recent-auth-guard',
  template: `
    @if (isAuthModalVisible) {
      <app-auth
        mode="embedded"
      ></app-auth>
    }
  `,
  imports: [
    AuthComponent
  ],
})
export class RecentAuthGuardComponent implements OnInit, OnDestroy {
  private recentGuardService = inject(RecentAuthGuardStateService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();
  @ViewChild(AuthComponent, {static: false}) authComponent!: AuthComponent;

  protected isAuthModalVisible = false;

  ngOnInit() {
    this.recentGuardService.recentAuthState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
          this.isAuthModalVisible = state.visible;
          if (state.visible) {
            setTimeout(() => {
              if (this.authComponent?.content) {
                this.popupTemplateStateService.open(this.authComponent.content, 'auth', true);
              } else {
                logger.error('AuthComponent or its content is undefined.');
              }
            }, 50);
          }
        }
      );

    this.popupTemplateStateService.drawerState$
      .pipe(
        takeUntil(this.destroy$),
        filter((state) => state.type === 'auth' && !state.visible)
      ).subscribe(() => {
      this.isAuthModalVisible = false;
      this.recentGuardService.close();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
