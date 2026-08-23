import {Component, Input} from '@angular/core';
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
      [attr.aria-label]="getProviderLabel()"
      (click)="getClickHandler()()"
      [disabled]="isDisabled"
      [ngClass]="[getProviderClass(), isDisabled ? 'disabled-button' : '']"
      [ngStyle]="{
        opacity: loginFlow || isProviderConnected() ? 1 : 0.5,
        filter: loginFlow || isProviderConnected() ? 'none' : 'grayscale(20%)',
        cursor: (loginFlow || !isDisabled) ? 'pointer' : 'not-allowed',
        }"
    >
      @if (provider.toLowerCase() === 'google') {
        <svg class="provider-mark google-mark" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z"/>
          <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.4 15.4 46 24 46z"/>
          <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .7-4.4l-7.1-5.5C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.2-5.5z"/>
          <path fill="#EA4335" d="M24 10.4c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.2 29.9 2 24 2 15.4 2 8 6.6 4.3 14.1l7.1 5.5c1.8-5.3 6.8-9.2 12.6-9.2z"/>
        </svg>
      } @else if (provider.toLowerCase() === 'apple') {
        <i class="provider-mark fa-brands fa-apple" aria-hidden="true"></i>
      } @else {
        <i class="provider-mark local-mark fa-regular fa-envelope" aria-hidden="true"></i>
      }
      <span class="provider-label">{{ getProviderLabel() }}</span>
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
  @Input() clickOnLinked!: (provider: string) => void;
  @Input() clickOnUnlinked?: (provider: string) => void;
  @Input() loginFlow?: boolean = false;

  private providerConfig: Record<string, { clickHandler: () => void }> = {
    google: {
      clickHandler: () => this.handleProviderAction('google')
    },
    apple: {
      clickHandler: () => this.handleProviderAction('apple')
    },
    local: {
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

  getProviderLabel(): string {
    return this.provider.toLowerCase() === 'local'
      ? 'Email'
      : this.provider.charAt(0).toUpperCase() + this.provider.slice(1).toLowerCase();
  }

  getClickHandler(): () => void {
    return this.providerConfig[this.provider.toLowerCase()]?.clickHandler ?? (() => undefined);
  }

  isProviderConnected(): boolean {
    return this.connectedProviders?.some(
      (p) => p.toLowerCase() === this.provider.toLowerCase()
    );
  }

  private handleProviderAction(provider: string): void {
    if (this.isProviderConnected() || this.loginFlow) {
      this.clickOnLinked?.(provider);
    } else {
      this.clickOnUnlinked?.(provider);
    }
  }
}
