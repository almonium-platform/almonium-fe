import {ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {RecentAuthGuardStateService} from "./recent-auth-guard-state.service";
import {AuthComponent} from "../../authentication/auth/auth.component";
import {filter, Subject, takeUntil} from "rxjs";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-recent-auth-guard',
  template: `
    <ng-container *ngIf="isAuthModalVisible">
      <app-auth
        mode="embedded"
      ></app-auth>
    </ng-container>
  `,
  imports: [
    AuthComponent,
    NgIf
  ],
})
export class RecentAuthGuardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  @ViewChild(AuthComponent, {static: false}) authComponent!: AuthComponent;

  protected isAuthModalVisible = false;

  constructor(
    private recentGuardService: RecentAuthGuardStateService,
    private popupTemplateStateService: PopupTemplateStateService,
    private cdr: ChangeDetectorRef,
  ) {
  }

  ngOnInit() {
    this.recentGuardService.recentAuthState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
          this.isAuthModalVisible = state.visible;
          if (state.visible) {
            setTimeout(() => {
              if (this.authComponent && this.authComponent.content) {
                this.popupTemplateStateService.open(this.authComponent.content, 'auth', true);
              } else {
                console.error('AuthComponent or its content is undefined.');
              }
            });
          }
        }
      );

    this.popupTemplateStateService.drawerState$
      .pipe(
        takeUntil(this.destroy$),
        filter((state) => state.type === 'auth' && !state.visible)
      ).subscribe((state) => {
      if (!state.visible && state.type === 'auth') {
        this.isAuthModalVisible = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
