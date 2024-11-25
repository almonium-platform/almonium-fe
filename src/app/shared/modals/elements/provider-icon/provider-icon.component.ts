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
      (click)="getClickHandler()()"
      [disabled]="!isProviderConnected()"
      [ngClass]="getProviderClass()"
      [ngStyle]="{
        opacity: isProviderConnected() ? 1 : 0.5,
        filter: isProviderConnected() ? 'none' : 'grayscale(20%)'
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
  `
})
export class ProviderIconComponent {
  @Input() provider!: string;
  @Input() connectedProviders!: string[];
  @Input() click!: Function;

  private providerConfig: { [key: string]: { sizeClass: string; clickHandler: () => void } } = {
    google: {
      sizeClass: 'text-2xl',
      clickHandler: () => this.click && this.click('google')
    },
    apple: {
      sizeClass: 'text-3xl',
      clickHandler: () => this.click && this.click('apple')
    },
    local: {
      sizeClass: 'text-2xl',
      clickHandler: () => this.click && this.click('local')
    }
  };

  getProviderClass(): string {
    return this.provider ? this.provider.toLowerCase() : '';
  }

  getSizeClass(): string {
    return this.providerConfig[this.provider.toLowerCase()]?.sizeClass || 'text-default';
  }

  getClickHandler(): () => void {
    console.log('provider', this.provider);
    console.log(this.providerConfig[this.provider.toLowerCase()]?.clickHandler || (() => {
    }));
    return this.providerConfig[this.provider.toLowerCase()]?.clickHandler || (() => {
    });
  }

  isProviderConnected(): boolean {
    return this.connectedProviders?.some(
      (p) => p.toLowerCase() === this.provider.toLowerCase()
    );
  }
}
