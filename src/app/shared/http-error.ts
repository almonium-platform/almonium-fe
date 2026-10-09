import {AppHttpError} from './app-http-error';

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AppHttpError) {
    return error.hasUserMessage ? error.message : fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/** The HTTP status of a failed request, or null when the failure never reached the server. */
export function httpStatus(error: unknown): number | null {
  return error instanceof AppHttpError ? error.status : null;
}

/**
 * 451 Unavailable For Legal Reasons: the book is still under copyright in the reader's country. It is a plain
 * state of the page, never an error toast.
 */
export function isUnavailableInCountry(error: unknown): boolean {
  return httpStatus(error) === 451;
}
