import {Component, EventEmitter, Output} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize, Observable, of, Subject, switchMap} from 'rxjs';
import {catchError, tap} from 'rxjs/operators';
import {
  TuiAvatar,
  TuiFile,
  TuiFileLike,
  TuiFileRejectedPipe,
  TuiFilesComponent,
  TuiInputFiles,
  TuiInputFilesDirective
} from '@taiga-ui/kit';
import {AsyncPipe, NgIf} from "@angular/common";
import {LucideAngularModule} from "lucide-angular";
import {TuiLink} from "@taiga-ui/core";

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.less'],
  imports: [
    NgIf,
    LucideAngularModule,
    TuiFile,
    TuiFilesComponent,
    ReactiveFormsModule,
    TuiInputFilesDirective,
    TuiInputFiles,
    AsyncPipe,
    TuiFileRejectedPipe,
    TuiLink,
    TuiAvatar,
  ],
})
export class FileUploadComponent {
  @Output() fileUploaded = new EventEmitter<File>();
  @Output() fileRemoved = new EventEmitter<void>();

  protected readonly control = new FormControl<TuiFileLike | null>(null, Validators.required);

  protected readonly failedFiles$ = new Subject<TuiFileLike | null>();
  protected readonly loadingFiles$ = new Subject<TuiFileLike | null>();
  protected readonly loadedFiles$ = this.control.valueChanges.pipe(
    switchMap((file) => this.processFile(file)),
  );

  protected removeFile(): void {
    this.control.setValue(null);
    this.fileRemoved.emit();
  }

  protected processFile(file: TuiFileLike | null): Observable<TuiFileLike | null> {
    this.failedFiles$.next(null);

    if (this.control.invalid || !file) {
      return of(null);
    }

    this.loadingFiles$.next(file);

    return of(file).pipe(
      tap(() => {
        this.fileUploaded.emit(file as File); // Notify parent that the file is ready
      }),
      catchError((error) => {
        console.error('Error processing file:', error);
        this.failedFiles$.next(file); // Notify about the failure
        return of(null); // Emit null on error
      }),
      finalize(() => this.loadingFiles$.next(null)) // Clear loading state
    );
  }
}
