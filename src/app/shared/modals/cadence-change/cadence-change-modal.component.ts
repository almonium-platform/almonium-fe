import {Component, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {DismissButtonComponent} from '../elements/dismiss-button/dismiss-button.component';
import {
  CadenceChangeKind,
  CadenceChangeOption,
  CadenceChangePreview,
  formatMinorUnits,
} from '../../../models/cadence-change.model';
import {PlanType} from '../../../models/userinfo.model';

interface Figure {
  label: string;
  value: string;
}

/**
 * The confirmation step for a billing cadence change.
 *
 * Nothing commits until the cadence, the amount due and the effective date are all on screen, and every one of those
 * figures is the server's — the client formats them and does no arithmetic of its own.
 *
 * The modal takes two shapes, decided by the options the server returned rather than by anything the caller passes.
 * With a refund available the member gets two real choices as stacked buttons; without one they get a single scheduled
 * switch and a cancel. The explanatory line above the buttons is load-bearing in the scheduled shape: without it the
 * asymmetry with the upgrade direction reads as stalling.
 */
@Component({
  selector: 'app-cadence-change-modal',
  imports: [DismissButtonComponent],
  styleUrls: ['./cadence-change-modal.component.less'],
  templateUrl: './cadence-change-modal.component.html',
})
export class CadenceChangeModalComponent {
  @Input() isVisible = false;
  @Input() preview: CadenceChangePreview | null = null;
  @Input() pending = false;

  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<CadenceChangeKind>();

  protected fadeOutAnimating = false;
  private closeTimeout?: ReturnType<typeof setTimeout>;

  protected get refundOption(): CadenceChangeOption | null {
    return this.optionOf(CadenceChangeKind.REFUND_AND_SWITCH);
  }

  protected get scheduledOption(): CadenceChangeOption | null {
    return this.optionOf(CadenceChangeKind.SCHEDULED);
  }

  protected get proratedOption(): CadenceChangeOption | null {
    return this.optionOf(CadenceChangeKind.PRORATED_NOW);
  }

  protected get title(): string {
    return this.refundOption ? "You're still within your 14-day guarantee." : this.switchHeading;
  }

  protected get switchHeading(): string {
    return `Switch to ${this.cadenceWord(this.preview?.targetType)} billing`;
  }

  /** The figures for whichever shape this is. Labels name the actual cadences, never "current" and "new". */
  protected get figures(): Figure[] {
    const preview = this.preview;
    if (!preview) return [];
    const refund = this.refundOption;
    if (refund) {
      return [
        {label: 'Refund to your card', value: this.amount(refund.refundMinorUnits ?? 0)},
        {label: `${this.capitalised(this.cadenceWord(preview.targetType))} billing starts`, value: this.when(refund.effectiveAt)},
        {label: 'Due now', value: this.amount(refund.dueNowMinorUnits)},
      ];
    }
    const option = this.scheduledOption ?? this.proratedOption;
    if (!option) return [];
    const figures: Figure[] = [
      {label: 'New cadence', value: this.cadenceValue(preview)},
    ];
    // Credit before the amount due, so the smaller number explains the larger one rather than following it.
    if (option.creditMinorUnits !== null) {
      figures.push({
        label: `Credit for this ${this.periodWord(preview.currentType)}`,
        value: `−${this.amount(option.creditMinorUnits)}`,
      });
    }
    figures.push({label: 'Due now', value: this.amount(option.dueNowMinorUnits)});
    if (option.kind === CadenceChangeKind.SCHEDULED) {
      figures.push({
        label: `${this.capitalised(this.cadenceWord(preview.currentType))} plan runs until`,
        value: this.when(preview.currentPeriodEndsAt),
      });
      figures.push({
        label: `${this.capitalised(this.cadenceWord(preview.targetType))} billing starts`,
        value: this.when(option.effectiveAt),
      });
    } else {
      figures.push({label: 'Next billed', value: this.when(option.nextBilledAt)});
    }
    return figures;
  }

  /**
   * The full period charge is the headline. For an annual switch the monthly equivalent is arithmetic that belongs
   * under it, never in place of it — which is why it is not this string.
   */
  private cadenceValue(preview: CadenceChangePreview): string {
    const amount = this.amount(preview.targetPriceMinorUnits);
    return preview.targetType === PlanType.YEARLY
      ? `${amount} billed annually`
      : `${amount} / ${this.periodWord(preview.targetType)}`;
  }

  /** Only the scheduled shape needs it: it is the sentence that explains why nothing happens today. */
  protected get explanation(): string | null {
    if (this.refundOption) {
      return 'We can refund your annual payment and start you on monthly billing today.';
    }
    if (!this.scheduledOption || !this.preview) return null;
    return `You've already paid through ${this.when(this.preview.currentPeriodEndsAt)}, so nothing changes until then.`;
  }

  protected get footnote(): string | null {
    if (!this.preview?.founderPrice) return null;
    return this.refundOption
      ? 'Either way you keep your founding-member price.'
      : 'Your founding-member price stays locked as long as your subscription remains active.';
  }

  protected get scheduleButtonLabel(): string {
    const option = this.scheduledOption;
    if (!option) return 'Schedule switch';
    return this.refundOption
      ? `Schedule the switch for ${this.monthAndYear(option.effectiveAt)}`
      : 'Schedule switch';
  }

  protected commit(kind: CadenceChangeKind): void {
    this.confirmed.emit(kind);
  }

  protected onBackdropPointerDown(event: PointerEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  protected onClose(): void {
    if (this.pending) return;
    this.fadeOutAnimating = true;
    clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => {
      this.closed.emit();
      this.fadeOutAnimating = false;
    }, 200); // Match animation duration in milliseconds
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    if (this.isVisible) {
      this.onClose();
    }
  }

  protected readonly CadenceChangeKind = CadenceChangeKind;

  private optionOf(kind: CadenceChangeKind): CadenceChangeOption | null {
    return this.preview?.options.find(option => option.kind === kind) ?? null;
  }

  private amount(minorUnits: number): string {
    return formatMinorUnits(minorUnits, this.preview?.currencyCode ?? 'USD');
  }

  /** A date the member reaches today is "Today"; a switch that lands in 359 days deserves its full date. */
  private when(date: Date): string {
    return this.isToday(date) ? 'Today' : this.fullDate(date);
  }

  private isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  private fullDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
  }

  private monthAndYear(date: Date): string {
    return date.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'});
  }

  private cadenceWord(type: PlanType | undefined): string {
    return type === PlanType.YEARLY ? 'annual' : 'monthly';
  }

  private periodWord(type: PlanType | undefined): string {
    return type === PlanType.YEARLY ? 'year' : 'month';
  }

  private capitalised(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
}
