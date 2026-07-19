import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';

@Component({
  template: '<p>{{message}}</p>',
})
class AngularRuntimeTestComponent {
  protected readonly message = 'Angular runtime is ready';
}

describe('Angular runtime', () => {
  it('creates and renders a standalone component', async () => {
    await TestBed.configureTestingModule({
      imports: [AngularRuntimeTestComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AngularRuntimeTestComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance).toBeTruthy();
    expect(element.textContent).toContain('Angular runtime is ready');
  });
});
