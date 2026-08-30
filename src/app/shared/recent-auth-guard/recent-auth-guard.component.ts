import {getErrorMessage} from '../http-error';
import {ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, TemplateRef, ViewChild, inject} from '@angular/core';
import {RecentAuthGuardStateService} from "./recent-auth-guard-state.service";
import {finalize, filter, Subject, takeUntil} from "rxjs";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiIcon, TuiInput, TuiTextfieldComponent} from '@taiga-ui/core';
import {TuiPassword} from '@taiga-ui/kit';
import {AuthSettingsService} from '../../sections/settings/auth/auth-settings.service';
import {AuthService} from '../../authentication/auth/auth.service';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {AuthMethod} from '../../authentication/auth/auth.types';
import {UserInfoService} from '../../services/user-info.service';
import {AppConstants} from '../../app.constants';

@Component({
  selector: 'app-recent-auth-guard',
  templateUrl: './recent-auth-guard.component.html',
  styleUrl: './recent-auth-guard.component.less',
  imports: [ReactiveFormsModule, TuiIcon, TuiInput, TuiPassword, TuiTextfieldComponent],
})
export class RecentAuthGuardComponent implements OnInit, OnDestroy {
  private recentGuardService = inject(RecentAuthGuardStateService);
  private recentAuthService = inject(RecentAuthGuardService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private authSettingsService = inject(AuthSettingsService);
  private authService = inject(AuthService);
  private userInfoService = inject(UserInfoService);
  private cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();
  @ViewChild('content', {static: true}) content!: TemplateRef<unknown>;
  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;

  protected isAuthModalVisible = false;
  protected actionLabel = 'Continue';
  protected authMethods: AuthMethod[] = [];
  protected email = '';
  protected loading = false;
  protected methodsLoading = false;
  protected fieldError = '';
  protected readonly form = new FormGroup({
    password: new FormControl('', [Validators.required, Validators.minLength(AppConstants.MIN_PASSWORD_LENGTH)]),
  });

  ngOnInit() {
    this.recentGuardService.recentAuthState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
          this.isAuthModalVisible = state.visible;
          this.actionLabel = state.actionLabel;
          if (state.visible) {
            this.prepareCard();
            setTimeout(() => {
              this.popupTemplateStateService.open(this.content, 'auth', false, true);
              setTimeout(() => this.cancelButton?.nativeElement.focus());
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

  protected hasMethod(provider: string): boolean {
    return this.authMethods.some(method => method.provider.toLowerCase() === provider);
  }

  protected submitPassword(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }
    this.runVerification(this.authService.reauth(this.form.controls.password.value ?? ''));
  }

  protected verifyWithProvider(provider: 'google' | 'apple'): void {
    if (this.loading) return;
    const authentication = provider === 'google'
      ? this.authService.googleSignIn('reauth')
      : this.authService.appleSignIn('reauth');
    this.runVerification(authentication);
  }

  protected sendPasswordReset(): void {
    if (!this.email || this.loading) return;
    this.loading = true;
    this.authService.forgotPassword(this.email)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => this.fieldError = 'A password reset link has been sent. This action will wait for you.',
        error: error => this.fieldError = getErrorMessage(error, 'Could not send the password reset link'),
      });
  }

  protected cancel(): void {
    this.popupTemplateStateService.close();
  }

  private prepareCard(): void {
    this.email = this.userInfoService.currentUserInfo?.email ?? '';
    this.fieldError = '';
    this.form.reset();
    this.methodsLoading = true;
    this.authSettingsService.populateAuthMethods()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: methods => {
          this.authMethods = methods;
          this.methodsLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.methodsLoading = false;
          this.fieldError = getErrorMessage(error, 'Could not load your sign-in methods');
          this.cdr.markForCheck();
        },
      });
  }

  private runVerification(authentication: ReturnType<AuthService['reauth']>): void {
    this.loading = true;
    this.fieldError = '';
    authentication.pipe(finalize(() => {
      this.loading = false;
      this.cdr.markForCheck();
    })).subscribe({
      next: () => {
        this.popupTemplateStateService.close();
        this.recentAuthService.updateStatusAndShowAlert();
      },
      error: error => {
        this.fieldError = getErrorMessage(error, 'Identity verification failed');
        this.cdr.markForCheck();
      },
    });
  }
}
