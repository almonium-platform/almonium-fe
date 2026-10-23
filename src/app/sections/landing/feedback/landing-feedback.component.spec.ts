import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';
import {LandingFeedbackComponent} from './landing-feedback.component';
import {LandingFeedback, LandingFeedbackService} from './landing-feedback.service';

describe('LandingFeedbackComponent', () => {
  function setup(result = of(undefined as void)) {
    const send = jasmine.createSpy<(feedback: LandingFeedback) => typeof result>('send').and.returnValue(result);
    TestBed.configureTestingModule({
      imports: [LandingFeedbackComponent],
      providers: [provideRouter([]), {provide: LandingFeedbackService, useValue: {send}}],
    });
    const fixture = TestBed.createComponent(LandingFeedbackComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const fill = (selector: string, value: string) => {
      const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const button = () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const note = () => host.querySelector('.note')?.textContent?.trim();
    const submit = () => {
      button().click();
      fixture.detectChanges();
    };
    return {host, send, fill, button, note, submit};
  }

  it('keeps Send greyed with a line saying what is missing until the answer has ten characters', () => {
    const {fill, button, note} = setup();
    expect(button().disabled).toBeTrue();
    expect(note()).toBe('Write a sentence or two to send.');
    fill('textarea', 'Flashcard');
    expect(note()).toBe('1 more characters to send.');
    fill('textarea', 'Flashcards');
    expect(button().disabled).toBeFalse();
    expect(note()).toBeUndefined();
    fill('input[type="email"]', 'marta@');
    expect(button().disabled).toBeTrue();
    expect(note()).toBe('Check the email address, or leave it empty.');
  });

  it('sends the answer with the email and replaces the form with the thanks', () => {
    const {host, send, fill, submit} = setup();
    fill('textarea', '  I always wanted a tool that reads with me.  ');
    fill('input[type="email"]', ' marta@example.com ');
    submit();
    expect(send).toHaveBeenCalledOnceWith({
      message: 'I always wanted a tool that reads with me.', email: 'marta@example.com', locale: navigator.language, website: '',
    });
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('Thank you. It’s in my inbox.');
    expect(host.textContent).toContain('I’ll write back to marta@example.com.');
  });

  it('says it cannot reply when no email was left', () => {
    const {host, send, fill, submit} = setup();
    fill('textarea', 'Flashcards that feel like reading.');
    submit();
    expect(send.calls.mostRecent().args[0].email).toBeUndefined();
    expect(host.textContent).toContain('You didn’t leave an email, so I can’t reply, but I’ll read it.');
  });

  it('keeps the text and says so when the send fails', () => {
    const {host, fill, submit} = setup(throwError(() => new Error('down')));
    fill('textarea', 'Flashcards that feel like reading.');
    submit();
    expect(host.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Flashcards that feel like reading.');
    expect(host.querySelector('.error')?.textContent?.trim()).toBe('That didn’t send. Try again in a moment.');
  });

  it('shows the counter only past 1800 characters', () => {
    const {host, fill} = setup();
    fill('textarea', 'a'.repeat(1800));
    expect(host.querySelector('.counter')).toBeNull();
    fill('textarea', 'a'.repeat(1801));
    expect(host.querySelector('.counter')?.textContent).toBe('1801 / 2000');
  });
});
