import {Component, OnInit, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {initializePaddle, Environments} from '@paddle/paddle-js';
import {catchError, EMPTY, map} from 'rxjs';
import {TuiNotificationService} from '@taiga-ui/core';
import {AppConstants} from '../../app.constants';
import {environment} from '../../../environments/environment';
import {expectEnum, expectRecord, expectString} from '../../shared/runtime-validation';
import {formatMinorUnits} from '../../models/cadence-change.model';

interface PaddleCheckoutConfig {
  clientToken: string;
  environment: Environments;
}

interface CheckoutSummary {
  planLabel: string;
  chargedNow: string;
  billed: string;
  equivalent: string | null;
  renews: string | null;
}

/**
 * Checkout, in our own frame.
 *
 * The card fields and the pay button are Paddle's and always will be — that is what PCI compliance buys. Everything
 * around them is ours, so the checkout is drawn inline rather than as an overlay dropped on a blank page: the member
 * sees what they are buying, at what cadence, and when it renews, beside the form that takes their money.
 *
 * The summary is built from Paddle's own checkout events, never from a price we remember from the previous screen.
 * A total that disagrees with the amount charged is worse than no total at all.
 */
@Component({
  selector: 'app-payment-checkout',
  templateUrl: './payment-checkout.component.html',
  styleUrl: './payment-checkout.component.less',
})
export class PaymentCheckoutComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiNotificationService);

  protected summary: CheckoutSummary | null = null;
  protected failed = false;

  ngOnInit(): void {
    this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/billing/config`).pipe(
      map(parsePaddleCheckoutConfig),
      catchError(() => {
        this.failed = true;
        this.alerts.open('Could not load the secure checkout. Please try again.', {appearance: 'negative'}).subscribe();
        return EMPTY;
      }),
    ).subscribe(config => {
      void initializePaddle({
        token: config.clientToken,
        environment: config.environment,
        eventCallback: event => this.onCheckoutEvent(event),
        checkout: {
          settings: {
            displayMode: 'inline',
            frameTarget: 'paddle-frame',
            frameInitialHeight: 450,
            frameStyle: 'width: 100%; min-width: 312px; background-color: transparent; border: none;',
            variant: 'one-page',
            showAddDiscounts: false,
            successUrl: `${environment.feUrl}/payment/success`,
          },
        },
      });
    });
  }

  private onCheckoutEvent(event: {name?: string; data?: unknown}): void {
    if (event.name !== 'checkout.loaded' && event.name !== 'checkout.updated') return;
    this.summary = buildSummary(event.data);
  }
}

function parsePaddleCheckoutConfig(value: unknown): PaddleCheckoutConfig {
  const config = expectRecord(value, 'billing config');
  return {
    clientToken: expectString(config['clientToken'], 'billing config.clientToken'),
    environment: expectEnum(
      config['environment'],
      ['sandbox', 'production'],
      'billing config.environment',
    ),
  };
}

/**
 * Paddle's checkout payload is not ours to validate strictly — a missing field means one fewer row, never a thrown
 * error on a page someone is trying to pay on.
 */
function buildSummary(data: unknown): CheckoutSummary | null {
  if (typeof data !== 'object' || data === null) return null;
  const payload = data as Record<string, unknown>;
  const currency = typeof payload['currency_code'] === 'string' ? payload['currency_code'] : 'USD';
  const totals = asRecord(payload['totals']);
  const total = asNumber(totals?.['total']);
  if (total === null) return null;

  const item = asRecord(asArray(payload['items'])?.[0]);
  const cycle = asRecord(item?.['billing_cycle']);
  const interval = typeof cycle?.['interval'] === 'string' ? cycle['interval'] : null;
  const frequency = asNumber(cycle?.['frequency']) ?? 1;
  const productName = asRecord(item?.['product'])?.['name'];

  const charged = formatMoney(total, currency);
  return {
    planLabel: [typeof productName === 'string' ? productName : 'Membership', cadenceWord(interval)]
      .filter(Boolean)
      .join(', '),
    chargedNow: charged,
    billed: interval === 'year' ? `${charged} billed annually` : `${charged} billed monthly`,
    // Arithmetic on the figure above, and labelled as such. It is never the price.
    equivalent: interval === 'year' ? `Equivalent to ${formatMoney(total / 12, currency)}/month` : null,
    renews: interval ? formatDate(addInterval(new Date(), interval, frequency)) : null,
  };
}

function cadenceWord(interval: string | null): string {
  if (interval === 'year') return 'annual';
  if (interval === 'month') return 'monthly';
  return '';
}

/**
 * Paddle's checkout events report totals as decimal strings in major units, unlike its REST API, which uses minor
 * units. Converting here keeps one formatter for both.
 */
function formatMoney(majorUnits: number, currency: string): string {
  return formatMinorUnits(Math.round(majorUnits * 100), currency);
}

function addInterval(from: Date, interval: string, frequency: number): Date {
  const next = new Date(from);
  if (interval === 'year') next.setFullYear(next.getFullYear() + frequency);
  else if (interval === 'month') next.setMonth(next.getMonth() + frequency);
  else if (interval === 'week') next.setDate(next.getDate() + 7 * frequency);
  else next.setDate(next.getDate() + frequency);
  return next;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}
