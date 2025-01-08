import {Component, Input, OnInit} from '@angular/core';
import {NgClass, NgStyle} from '@angular/common';

@Component({
  selector: 'app-provider-icon',
  imports: [
    NgClass,
    NgStyle
  ],
  template: `
    <button
      type="button"
      class="social-button"
      (click)="getClickHandler()()"
      [disabled]="isDisabled"
      [ngClass]="[getProviderClass(), isDisabled ? 'disabled-button' : '']"
      [ngStyle]="{
        opacity: loginFlow || isProviderConnected() ? 1 : 0.5,
        filter: loginFlow || isProviderConnected() ? 'none' : 'grayscale(20%)',
        cursor: (loginFlow || !isDisabled) ? 'pointer' : 'not-allowed',
        }"
    >
      <i
        [ngClass]="[
          provider === 'local' ? 'fas' : 'fab',
          provider === 'local' ? 'fa-envelope' : 'fa-' + provider.toLowerCase(),
          getSizeClass()
        ]"
      ></i>
    </button>
  `,
  styles: [`
    .disabled-button:hover {
      opacity: 0.5 !important;
    }
  `]
})
export class ProviderIconComponent {
  @Input() provider!: string;
  @Input() connectedProviders!: string[];
  @Input() clickOnLinked!: Function;
  @Input() clickOnUnlinked?: Function;
  @Input() loginFlow?: boolean = false;

  private providerConfig: { [key: string]: { sizeClass: string; clickHandler: () => void } } = {
    google: {
      sizeClass: 'text-2xl',
      clickHandler: () => this.handleProviderAction('google')
    },
    apple: {
      sizeClass: 'text-3xl',
      clickHandler: () => this.handleProviderAction('apple')
    },
    local: {
      sizeClass: 'text-2xl',
      clickHandler: () => this.handleProviderAction('local')
    }
  };

  get isDisabled(): boolean {
    if (this.loginFlow) {
      return false;
    }
    if (this.clickOnUnlinked) {
      return false;
    }
    return !this.isProviderConnected();
  }

  getProviderClass(): string {
    return this.provider ? this.provider.toLowerCase() : '';
  }

  getSizeClass(): string {
    return this.providerConfig[this.provider.toLowerCase()]?.sizeClass || 'text-default';
  }

  getClickHandler(): () => void {
    return this.providerConfig[this.provider.toLowerCase()]?.clickHandler || (() => {
    });
  }

  isProviderConnected(): boolean {
    return this.connectedProviders?.some(
      (p) => p.toLowerCase() === this.provider.toLowerCase()
    );
  }

  private handleProviderAction(provider: string): void {
    if (this.isProviderConnected() || this.loginFlow) {
      this.clickOnLinked && this.clickOnLinked(provider);
    } else {
      this.clickOnUnlinked && this.clickOnUnlinked(provider);
    }
  }
}
