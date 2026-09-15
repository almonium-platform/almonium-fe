import {HttpErrorResponse} from '@angular/common/http';

interface ApiErrorBody {
  message?: unknown;
}

function getApiMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('message' in value)) {
    return undefined;
  }

  const message = (value as ApiErrorBody).message;
  return typeof message === 'string' && message.trim() ? message : undefined;
}

/**
 * The single application representation of an unsuccessful HTTP request.
 *
 * Components can rely on its status and safe server message without knowing
 * Angular's HttpErrorResponse implementation or an individual API's body shape.
 */
export class AppHttpError extends Error {
  readonly status: number;
  readonly url: string | null;
  readonly body: unknown;
  readonly hasUserMessage: boolean;

  constructor(response: HttpErrorResponse) {
    const apiMessage = getApiMessage(response.error);
    super(apiMessage ?? 'Request failed');
    this.name = 'AppHttpError';
    this.status = response.status;
    this.url = response.url;
    this.body = response.error;
    this.hasUserMessage = apiMessage !== undefined;
  }
}
