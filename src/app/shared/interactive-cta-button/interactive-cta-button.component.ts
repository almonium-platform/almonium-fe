import {Component, Input, HostListener, ElementRef} from '@angular/core';

@Component({
  selector: 'app-interactive-cta-button',
  template: `
    <div class="interactive-cta-btn-container">
      <button class="cta-btn">
        <span class="btn-text">{{ text }}</span>
      </button>
    </div>
  `,
  styleUrls: ['./interactive-cta-button.component.less'],
})
export class InteractiveCtaButtonComponent {
  @Input() text: string = 'Click Me';

  constructor(private elRef: ElementRef) {
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const button = this.elRef.nativeElement.querySelector('.cta-btn') as HTMLElement;
    const rect = button.getBoundingClientRect();

    const xPercentage = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercentage = ((event.clientY - rect.top) / rect.height) * 100;
    const angle = Math.round((xPercentage + yPercentage) / 2);

    button.style.background = `linear-gradient(${angle}deg, #00d1ff, #8a2be2)`;
  }
}

