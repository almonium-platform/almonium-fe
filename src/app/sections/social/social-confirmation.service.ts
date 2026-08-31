import {Injectable, signal} from '@angular/core';

export interface SocialConfirmation {
  title: string;
  message: string;
  confirmText: string;
  action: () => void;
  useCountdown?: boolean;
  /** Reversible actions ask in plum; only destructive ones wear the red button. */
  tone?: 'danger' | 'default';
}

/** Owns the lifecycle of destructive social confirmations. */
@Injectable()
export class SocialConfirmationService {
  readonly state = signal<SocialConfirmation | null>(null);

  open(confirmation: SocialConfirmation): void {
    this.state.set(confirmation);
  }

  close(): void {
    this.state.set(null);
  }

  confirm(): void {
    const confirmation = this.state();
    this.close();
    confirmation?.action();
  }
}
