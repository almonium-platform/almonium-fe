import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject} from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {firstValueFrom, Observable, of, Subject, timer} from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import {AppConstants} from '../../app.constants';
import {UserInfoService} from '../../services/user-info.service';
import {ProfileSettingsService} from '../../sections/settings/profile/profile-settings.service';

@Component({
  selector: 'app-username',
  templateUrl: './username.component.html',
  styleUrls: ['./username.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class UsernameComponent implements OnInit, OnDestroy {
  private readonly userInfoService = inject(UserInfoService);
  private readonly profileSettingsService = inject(ProfileSettingsService);
  private readonly alertService = inject(TuiNotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  protected currentUsername = '';
  protected isSaving = false;
  private savePromise: Promise<boolean> | null = null;

  protected readonly usernameControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(AppConstants.MIN_USERNAME_LENGTH),
      Validators.maxLength(AppConstants.MAX_USERNAME_LENGTH),
      Validators.pattern(AppConstants.USERNAME_PATTERN),
      this.usernameAppNameValidator(),
    ],
    asyncValidators: [this.usernameAvailableAsyncValidator()],
  });

  ngOnInit(): void {
    this.userInfoService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(userInfo => {
        if (!userInfo) {
          return;
        }

        const shouldReplaceValue = !this.currentUsername || this.usernameControl.pristine;
        this.currentUsername = userInfo.username;
        if (shouldReplaceValue) {
          this.usernameControl.setValue(userInfo.username, {emitEvent: false});
          this.usernameControl.markAsPristine();
          this.usernameControl.updateValueAndValidity({emitEvent: false});
        }
        this.cdr.markForCheck();
      });

    this.usernameControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        const normalized = this.normalize(value);
        if (normalized !== value) {
          this.usernameControl.setValue(normalized);
        }
        this.cdr.markForCheck();
      });

    this.usernameControl.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onSubmit(): void {
    void this.save();
  }

  /** Validates against the backend and persists a changed username. */
  save(): Promise<boolean> {
    if (this.savePromise) {
      return this.savePromise;
    }

    this.savePromise = this.performSave().finally(() => {
      this.savePromise = null;
      this.cdr.markForCheck();
    });
    return this.savePromise;
  }

  protected get availabilityText(): string {
    if (this.usernameControl.pending) {
      return 'checking';
    }
    if (this.usernameControl.hasError('usernameTaken')) {
      return 'taken';
    }
    if (this.usernameControl.valid && this.usernameControl.value) {
      return 'available';
    }
    return '';
  }

  protected get errorText(): string {
    const control = this.usernameControl;
    if (!control.touched || !control.invalid || control.pending) {
      return '';
    }
    if (control.hasError('required')) {
      return 'Enter a username.';
    }
    if (control.hasError('minlength') || control.hasError('maxlength')) {
      return `Use ${AppConstants.MIN_USERNAME_LENGTH}–${AppConstants.MAX_USERNAME_LENGTH} characters.`;
    }
    if (control.hasError('pattern')) {
      return 'Use lowercase letters, numbers, and underscores only.';
    }
    if (control.hasError('appNameForbidden')) {
      return 'The app name cannot be part of a username.';
    }
    if (control.hasError('usernameTaken')) {
      return 'That username is already taken.';
    }
    if (control.hasError('availabilityServerError')) {
      return 'Could not check availability. Try again.';
    }
    return '';
  }

  private async performSave(): Promise<boolean> {
    const normalized = this.normalize(this.usernameControl.value);
    if (normalized !== this.usernameControl.value) {
      this.usernameControl.setValue(normalized);
    }
    this.usernameControl.markAsTouched();
    this.usernameControl.updateValueAndValidity();

    await firstValueFrom(this.usernameControl.statusChanges.pipe(
      startWith(this.usernameControl.status),
      filter(status => status !== 'PENDING'),
      take(1),
    ));

    if (this.usernameControl.invalid) {
      this.cdr.markForCheck();
      return false;
    }

    const username = this.usernameControl.value;
    if (username === this.currentUsername) {
      return true;
    }

    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await firstValueFrom(this.profileSettingsService.updateUsername(username));
      this.currentUsername = username;
      this.usernameControl.markAsPristine();
      this.userInfoService.updateUserInfo({username});
      this.alertService.open('Username updated', {appearance: 'positive'}).subscribe();
      return true;
    } catch {
      this.alertService.open('Failed to update username', {appearance: 'negative'}).subscribe();
      return false;
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  private usernameAppNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as unknown;
      const forbidden = typeof value === 'string' && value.toLowerCase().includes('almonium');
      return forbidden ? {appNameForbidden: true} : null;
    };
  }

  private usernameAvailableAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const username = this.normalize(String(control.value));
      if (!username || username === this.currentUsername) {
        return of(null);
      }

      return timer(350).pipe(
        switchMap(() => this.profileSettingsService.checkUsernameAvailability(username)),
        map(response => response.available ? null : {usernameTaken: true}),
        catchError(() => of({availabilityServerError: true})),
      );
    };
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s/g, '').replace(/-/g, '_');
  }
}
