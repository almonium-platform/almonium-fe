import {Component, OnInit, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {initializePaddle, Environments} from '@paddle/paddle-js';
import {catchError, EMPTY, map} from 'rxjs';
import {TuiNotificationService} from '@taiga-ui/core';
import {AppConstants} from '../../app.constants';
import {environment} from '../../../environments/environment';
import {expectEnum, expectRecord, expectString} from '../../shared/runtime-validation';

interface PaddleCheckoutConfig {
  clientToken: string;
  environment: Environments;
}

@Component({
  selector: 'app-payment-checkout',
  template: `
    <main class="checkout-page">
      <h1>Preparing secure checkout…</h1>
      <p>Your Paddle checkout will open automatically.</p>
    </main>
  `,
  styles: [`
    .checkout-page {
      display: grid;
      min-height: 100vh;
      place-content: center;
      padding: 2rem;
      text-align: center;
    }
  `],
})
export class PaymentCheckoutComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly alerts = inject(TuiNotificationService);

  ngOnInit(): void {
    this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/billing/config`).pipe(
      map(parsePaddleCheckoutConfig),
      catchError(() => {
        this.alerts.open('Could not load the secure checkout. Please try again.', {appearance: 'negative'}).subscribe();
        return EMPTY;
      }),
    ).subscribe(config => {
      void initializePaddle({
        token: config.clientToken,
        environment: config.environment,
        checkout: {
          settings: {
            displayMode: 'overlay',
            successUrl: `${environment.feUrl}/payment/success`,
          },
        },
      });
    });
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
