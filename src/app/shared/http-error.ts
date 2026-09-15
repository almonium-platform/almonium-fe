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
