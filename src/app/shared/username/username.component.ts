import {ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {AsyncPipe, NgClass, NgIf} from "@angular/common";
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
import {TuiAlertService, TuiError, TuiHint, TuiTextfield, TuiTextfieldComponent} from "@taiga-ui/core";
import {TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {LucideAngularModule} from "lucide-angular";
import {EditButtonComponent} from "../edit-button/edit-button.component";
import {UserInfoService} from "../../services/user-info.service";
import {BehaviorSubject, finalize, Observable, of, Subject, takeUntil, timer} from "rxjs";
import {UserInfo} from "../../models/userinfo.model";
import {AppConstants} from "../../app.constants";
import {catchError, debounceTime, distinctUntilChanged, map, switchMap} from "rxjs/operators";
import {ProfileSettingsService} from "../../sections/settings/profile/profile-settings.service";
import {TUI_VALIDATION_ERRORS, TuiFieldErrorPipe} from "@taiga-ui/kit";

@Component({
  selector: 'app-username',
  imports: [
    NgIf,
    NgClass,
    ReactiveFormsModule,
    TuiTextfield,
    TuiTextfieldControllerModule,
    TuiError,
    LucideAngularModule,
    TuiHint,
    EditButtonComponent,
    TuiFieldErrorPipe,
    AsyncPipe
  ],
  providers: [
    {
      provide: TUI_VALIDATION_ERRORS,
      useValue: {
        required: 'Value is required',
        minlength: ({requiredLength, actualLength}: {
          requiredLength: number;
          actualLength: number;
        }) => `Too short: ${actualLength}/${requiredLength} characters`,
        maxlength: ({requiredLength, actualLength}: {
          requiredLength: number;
          actualLength: number;
        }) => `Too long: ${actualLength}/${requiredLength} characters`,
        pattern: 'Use only digits, lowercase Latin letters, and underscores',
        usernameTaken: 'Username is already taken',
        serverError: 'Server error',
        unchanged: 'No changes',
        appNameForbidden: 'You cannot use the app name in your username ',
      }
    }
  ],
  templateUrl: './username.component.html',
  styleUrl: './username.component.less'
})
export class UsernameComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  protected userInfo: UserInfo | null = null;
  protected usernameEditable: boolean = false;
  @ViewChild('username') usernameField!: TuiTextfieldComponent<string>;
  protected isLoading: boolean = false;
  protected usernameForm: FormGroup;
  protected tooltipUsername: string = `Requirements:
• ${AppConstants.MIN_USERNAME_LENGTH}-${AppConstants.MAX_USERNAME_LENGTH} characters,
• lowercase Latin letters,
• underscores, digits.
`;
  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

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
        nonNullable: true,
      }),
    });
    this.usernameForm.get('usernameValue')?.setAsyncValidators(this.usernameAvailableAsyncValidator());

    // Track loading state
    this.usernameForm.get('usernameValue')?.statusChanges.subscribe((status) => {
      this.isLoading = status === 'PENDING';
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.userInfoService.userInfo$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(userInfo => {
      if (!userInfo) {
        return;
      }
      this.userInfo = userInfo;
      this.usernameForm.get('usernameValue')?.setValue(userInfo.username);
      this.keepUsernameFieldClean();
    });
  }

  private keepUsernameFieldClean(): void {
    this.usernameForm
      .get('usernameValue')
      ?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      // Convert to lowercase, remove spaces, and replace dashes with underscores
      map((value: string) => value.toLowerCase().replace(/\s/g, '').replace(/-/g, '_')),
      takeUntil(this.destroy$) // Unsubscribe when destroy$ emits
    )
      .subscribe((transformedValue: string) => {
        const currentValue = this.usernameForm.get('usernameValue')?.value;
        if (transformedValue !== currentValue) {
          this.usernameForm.get('usernameValue')?.setValue(transformedValue, {emitEvent: false});
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onUsernameEditClick() {
    if (this.usernameEditable) {
      this.updateUsername();
      return;
    }
    this.usernameEditable = true;
    this.cdr.detectChanges();
    if (this.usernameField) {
      this.usernameField.input?.nativeElement.focus();
    }
  }

  private updateUsername() {
    if (this.usernameForm.invalid) {
      return;
    }
    this.loadingSubject$.next(true);

    const username = this.usernameForm.get('usernameValue')?.value!;
    this.profileSettingsService.updateUsername(username)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.alertService.open('Username updated', {appearance: 'success'}).subscribe();
          this.userInfoService.updateUserInfo({username: username});
          this.usernameEditable = false;
        },
        error: () => {
          this.alertService.open('Failed to update username', {appearance: 'error'}).subscribe();
        }
      });
  }

  // validators
  private usernameChangedValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const currentUsername = this.userInfo?.username ?? null;
      if (!this.usernameEditable) {
        return null;
      }
      if (control.value === currentUsername) {
        return {unchanged: 'No changes'};
      }
      return null;
    };
  }

  private usernameAppNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const forbidden = control.value?.toLowerCase().includes('almonium');
      return forbidden ? {appNameForbidden: 'You cannot use the app name in your username.'} : null;
    };
  }

  private usernameAvailableAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value || !this.usernameEditable) {
        return of(null); // No need to validate empty value
      }

      // Start a timer to debounce the input
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

  protected getUsernameFontSize(): string {
    const username = this.userInfo?.username || '';
    const maxWidth = 280; // Set your max width (e.g., 70% of your container)

    // Create a canvas to measure text width
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return '1.3rem'; // Fallback
    }

    // Set the font style to match the username's label
    context.font = '550 1.3rem "Your Font Family"'; // Adjust font weight, size, and family

    const textWidth = context.measureText(username).width;

    // Adjust font size based on the text width
    if (textWidth > maxWidth) {
      return '0.8rem'; // Smallest size
    } else if (textWidth > maxWidth * 0.9) {
      return '0.9rem';
    } else if (textWidth > maxWidth * 0.8) {
      return '1rem';
    } else if (textWidth > maxWidth * 0.7) {
      return '1.1rem';
    }
    return '1.3rem'; // Default size
  }
}
