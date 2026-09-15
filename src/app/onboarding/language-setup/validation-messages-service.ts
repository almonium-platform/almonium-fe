import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ValidationMessagesService {
  private maxLanguages = 3; // Default

  setMaxLanguages(max: number): void {
    this.maxLanguages = max;
  }

  getValidationMessages(): Record<string, string | (() => string)> {
    return {
      required: $localize`At least one language is required`,
      maxLanguages: () => {
        if (this.maxLanguages === 1) {
          return $localize`You can select only one language in free plan`;
        }
        return $localize`You can select up to ${this.maxLanguages}:maxLanguages: languages`;
      },
    };
  }
}
