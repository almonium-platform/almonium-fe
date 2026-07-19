import {HttpErrorResponse} from '@angular/common/http';

interface ApiErrorBody {
  message?: unknown;
}

function hasMessage(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'message' in value;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && hasMessage(error.error) && typeof error.error.message === 'string') {
    return error.error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
