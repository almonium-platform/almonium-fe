import {Component, inject} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs/operators';
import {LandingFeedbackService} from './landing-feedback.service';

export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 2000;
/** The counter stays out of the way until the answer nears the cap. */
const COUNTER_FROM = 1800;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "What did every language app get wrong for you?": one open question to the founder, with no account and no
 * required email. Once sent, the thanks replaces the form in place; a failed send keeps the text for another try.
 */
@Component({
  selector: 'app-landing-feedback',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './landing-feedback.component.html',
  styleUrl: './landing-feedback.component.less',
})
export class LandingFeedbackComponent {
  private feedbackService = inject(LandingFeedbackService);

  protected readonly messageMax = FEEDBACK_MESSAGE_MAX;
  protected message = new FormControl('', {nonNullable: true});
  protected email = new FormControl('', {nonNullable: true});
  protected website = new FormControl('', {nonNullable: true});

  protected sending = false;
  protected failed = false;
  /** Set once the answer is in: the address to write back to, or '' when none was left. */
  protected sentTo: string | null = null;

  protected get counter(): string | null {
    const length = this.message.value.length;
    return length > COUNTER_FROM ? `${length} / ${FEEDBACK_MESSAGE_MAX}` : null;
  }

  /** The line under a greyed Send: what the visitor still has to do. */
  protected get missing(): string | null {
    const length = this.message.value.trim().length;
    if (length === 0) return $localize`Write a sentence or two to send.`;
    if (length < FEEDBACK_MESSAGE_MIN) return $localize`${FEEDBACK_MESSAGE_MIN - length}:count: more characters to send.`;
    const email = this.email.value.trim();
    if (email && !EMAIL.test(email)) return $localize`Check the email address, or leave it empty.`;
    return null;
  }

  protected send(event: Event): void {
    event.preventDefault();
    if (this.sending || this.missing !== null) return;
    const email = this.email.value.trim();
    this.sending = true;
    this.failed = false;
    this.feedbackService.send({
      message: this.message.value.trim(),
      ...(email ? {email} : {}),
      locale: navigator.language,
      website: this.website.value,
    }).pipe(finalize(() => this.sending = false)).subscribe({
      next: () => this.sentTo = email,
      error: () => this.failed = true,
    });
  }
}
