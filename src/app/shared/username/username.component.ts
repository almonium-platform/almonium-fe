import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from "@angular/forms";
import {TuiAlertService, TuiError, TuiHintDirective, TuiTextfield, TuiTextfieldComponent} from "@taiga-ui/core";
import {BehaviorSubject, Observable, of, Subject, timer} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil} from "rxjs/operators";
import {UserInfoService} from "../../services/user-info.service";
import {UserInfo} from "../../models/userinfo.model";
import {AppConstants} from "../../app.constants";
import {ProfileSettingsService} from "../../sections/settings/profile/profile-settings.service";
import {AsyncPipe, NgClass} from "@angular/common";
import {TuiFieldErrorPipe} from "@taiga-ui/kit";
import {LucideAngularModule} from "lucide-angular";
import {EditButtonComponent} from "../edit-button/edit-button.component";

@Component({
  selector: 'app-username',
  templateUrl: './username.component.html',
  styleUrls: ['./username.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    ReactiveFormsModule,
    TuiTextfield,
    TuiError,
    AsyncPipe,
    TuiFieldErrorPipe,
    LucideAngularModule,
    TuiHintDirective,
    EditButtonComponent,
  ]
})
export class UsernameComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  usernameFontSize = '1.3rem';

  userInfo: UserInfo | null = null;
  usernameEditable = false;

  @ViewChild('username') usernameField!: TuiTextfieldComponent<string>;
  isLoading = false;

  usernameForm: FormGroup;
  tooltipUsername = `Requirements:
• ${AppConstants.MIN_USERNAME_LENGTH}-${AppConstants.MAX_USERNAME_LENGTH} characters,
• lowercase Latin letters,
• underscores, digits.`;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject$.asObservable();

  constructor(
    private userInfoService: UserInfoService,
    private profileSettingsService: ProfileSettingsService,
    private cdr: ChangeDetectorRef,
    private alertService: TuiAlertService,
  ) {
    this.usernameForm = new FormGroup({
      usernameValue: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(AppConstants.MIN_USERNAME_LENGTH),
          Validators.maxLength(AppConstants.MAX_USERNAME_LENGTH),
          Validators.pattern(AppConstants.USERNAME_PATTERN),
          this.usernameChangedValidator(),
          this.usernameAppNameValidator(),
        ],
        asyncValidators: [this.usernameAvailableAsyncValidator()],
        nonNullable: true,
      }),
    });
  }

  ngOnInit(): void {
    // 1) Listen for userInfo so we can set the initial value in the form.
    this.userInfoService.userInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(userInfo => {
        if (!userInfo) {
          return;
        }
        this.userInfo = userInfo;
        this.usernameForm.get('usernameValue')?.setValue(userInfo.username, {emitEvent: false});

        // Only measure the label if the field is NOT in edit mode
        // (so you’re not calling this on every keystroke).
        if (!this.usernameEditable) {
          this.usernameFontSize = this.calculateUsernameFontSize(userInfo.username);
        }

        // Keep the field "clean" while editing:
        this.keepUsernameFieldClean();
        this.cdr.markForCheck();
      });

    // 2) Track loading state when the form’s status changes.
    this.usernameForm.get('usernameValue')?.statusChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((status) => {
        this.isLoading = (status === 'PENDING');
        this.cdr.markForCheck();
      });
  }

  private keepUsernameFieldClean(): void {
    this.usernameForm
      .get('usernameValue')
      ?.valueChanges
      .pipe(
        // If you’re doing an internal `.replace()`, that is effectively a “normalize” step.
        debounceTime(300),          // shorter debounce to reduce “flicker”
        distinctUntilChanged(),
        map((value: string) => value.toLowerCase().replace(/\s/g, '').replace(/-/g, '_')),
        takeUntil(this.destroy$)
      )
      .subscribe((transformedValue: string) => {
        const control = this.usernameForm.get('usernameValue');
        if (!control) {
          return;
        }
        const currentValue = control.value;
        // Check if we actually changed anything:
        if (transformedValue !== currentValue) {
          control.setValue(transformedValue /*lowercase*/, {emitEvent: true});
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onUsernameEditClick() {
    // If user is already editing, clicking "Change" saves the username.
    if (this.usernameEditable) {
      this.updateUsername();
      return;
    }
    this.usernameEditable = true;
    this.cdr.detectChanges();

    // Focus the field once we switch to editing mode:
    setTimeout(() => {
      this.usernameField?.input?.nativeElement.focus();
    });
  }

  private updateUsername() {
    if (this.usernameForm.pending || this.usernameForm.invalid) {
      return;
    }

    this.loadingSubject$.next(true);

    const username = this.usernameForm.get('usernameValue')?.value || '';
    this.profileSettingsService
      .updateUsername(username)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({username});
          this.usernameForm.get('usernameValue')?.setValue(username, {emitEvent: false});
          this.alertService.open('Username updated', {appearance: 'success'}).subscribe();
          this.usernameEditable = false;
          this.usernameForm.updateValueAndValidity();
          // Recalculate label size
          this.usernameFontSize = this.calculateUsernameFontSize(username);
          this.cdr.markForCheck();
        },
        error: () => {
          this.alertService.open('Failed to update username', {appearance: 'error'}).subscribe();
        },
      });
  }

  //
  // --- VALIDATORS ---
  //
  private usernameChangedValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      // If not in "edit" mode yet, don’t force a “No changes” error
      if (!this.usernameEditable) {
        return null;
      }
      const currentUsername = this.userInfo?.username ?? null;
      if (control.value === currentUsername) {
        return {unchanged: true}; // or {unchanged: 'No changes'}
      }
      return null;
    };
  }

  private usernameAppNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const forbidden = control.value
        ?.toLowerCase()
        .includes('almonium'); // or whatever your app name is
      return forbidden ? {appNameForbidden: 'You can\'t mention the app name'} : null;
    };
  }

  /**
   * This async validator checks the username with the server
   * but only if the control passes sync validators and if "editing" is true.
   */
  private usernameAvailableAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      // If user not editing, or form is invalid, skip
      if (!this.usernameEditable || control.invalid) {
        return of(null);
      }

      // Debounce 500 ms, then check with server:
      return timer(500).pipe(
        switchMap(() =>
          this.profileSettingsService.checkUsernameAvailability(control.value).pipe(
            map(response => (response.available ? null : {usernameTaken: true})),
            catchError(() => of({serverError: true}))
          )
        )
      );
    };
  }

  //
  // Only measure the text once or when the user stops editing, rather than every keystroke:
  //
  private calculateUsernameFontSize(username: string): string {
    if (!username) {
      return '1.3rem';
    }

    const maxWidth = 280;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return '1.3rem';
    }

    // Make sure the font here matches the label's CSS. E.g.:
    context.font = '550 1.3rem "Your Font Family"';

    const textWidth = context.measureText(username).width;

    if (textWidth > maxWidth) {
      return '0.8rem';
    } else if (textWidth > maxWidth * 0.9) {
      return '0.9rem';
    } else if (textWidth > maxWidth * 0.8) {
      return '1rem';
    } else if (textWidth > maxWidth * 0.7) {
      return '1.1rem';
    }
    return '1.3rem';
  }
}
