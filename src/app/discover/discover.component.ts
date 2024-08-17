import {Component, ElementRef, Input, ViewChild} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {NgForOf, NgIf, NgOptimizedImage} from '@angular/common';
import {catchError, map} from 'rxjs/operators';
import {of} from 'rxjs';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {TuiTextareaModule} from "@taiga-ui/kit";
import {TuiTextfieldControllerModule} from "@taiga-ui/core";
import {ContenteditableValueAccessorModule} from '@tinkoff/angular-contenteditable-accessor';

@Component({
  selector: 'app-discover',
  templateUrl: './discover.component.html',
  styleUrls: ['./discover.component.scss'],
  imports: [
    NgForOf,
    NgIf,
    FormsModule,
    NgOptimizedImage,
    TuiTextareaModule,
    TuiTextfieldControllerModule,
    ReactiveFormsModule,
    ContenteditableValueAccessorModule
  ],
  standalone: true
})
export class DiscoverComponent {
  @Input() searchText: string = '';
  filteredOptions: string[] = [];
  currentFocus: number = -1;

  @ViewChild('searchInput') searchInput!: ElementRef;
  protected testForm = new FormGroup({
    testValue1: new FormControl('A field', Validators.required),
    testValue2: new FormControl('This one can be expanded', Validators.required),
    testValue3: new FormControl(
      'This one can be expanded (expandable on focus)',
      Validators.required,
    ),
  });

  constructor(private http: HttpClient) {
  }

  onSearchChange(searchText: string): void {
    this.currentFocus = -1;
    if (searchText && searchText.length >= 3) {
      const apiUrl = `https://api.datamuse.com/sug?k=demo&s=${searchText}&max=5`;
      this.http.get<{ word: string }[]>(apiUrl).pipe(
        map((data: { word: string }[]) => data.map(item => item.word)),
        catchError(() => of([]))
      ).subscribe(options => {
        this.filteredOptions = options;
      });
    } else {
      this.filteredOptions = [];
    }
  }

  onOptionSelected(option: string): void {
    this.searchText = option;
    this.filteredOptions = [];
    console.log('Selected option:', option); // Perform your search action here
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      // Move focus down
      this.currentFocus++;
      if (this.currentFocus >= this.filteredOptions.length) {
        this.currentFocus = 0;
      }
    } else if (event.key === 'ArrowUp') {
      // Move focus up
      this.currentFocus--;
      if (this.currentFocus < 0) {
        this.currentFocus = this.filteredOptions.length - 1;
      }
    } else if (event.key === 'Enter') {
      // Select the focused option
      event.preventDefault();
      if (this.currentFocus > -1 && this.currentFocus < this.filteredOptions.length) {
        this.onOptionSelected(this.filteredOptions[this.currentFocus]);
      }
    }
  }

  isOptionFocused(index: number): boolean {
    return this.currentFocus === index;
  }
}
