import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ValidationMessagesService {
  private maxLanguages = 3; // Default

  setMaxLanguages(max: number): void {
    this.maxLanguages = max;
  }

  getValidationMessages(): { [key: string]: string | (() => string) } {
    return {
      required: 'At least one language is required',
      maxLanguages: () => `You can select up to ${this.maxLanguages} languages`,
    };
  }
}
