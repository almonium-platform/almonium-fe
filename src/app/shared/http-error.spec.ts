import {HttpErrorResponse} from '@angular/common/http';
import {AppHttpError} from './app-http-error';
import {getErrorMessage, httpStatus, isUnavailableInCountry} from './http-error';

describe('AppHttpError', () => {
  it('exposes the API status and message without exposing the raw HTTP response', () => {
    const error = new AppHttpError(new HttpErrorResponse({
      status: 409,
      url: 'https://api.example.test/api/resource',
      error: {message: 'The resource has changed'},
    }));

    expect(error.status).toBe(409);
    expect(error.url).toBe('https://api.example.test/api/resource');
    expect(getErrorMessage(error, 'Could not save')).toBe('The resource has changed');
  });

  it('uses a caller-provided fallback when a request does not have a safe API message', () => {
    const error = new AppHttpError(new HttpErrorResponse({
      status: 0,
      error: new ProgressEvent('error'),
    }));

    expect(getErrorMessage(error, 'Could not reach the server')).toBe('Could not reach the server');
  });

  it('recognises a book the reader’s country may not open by its 451', () => {
    const blocked = new AppHttpError(new HttpErrorResponse({status: 451, error: {success: false, message: 'This book isn’t available in your country.'}}));
    const missing = new AppHttpError(new HttpErrorResponse({status: 404}));

    expect(isUnavailableInCountry(blocked)).toBeTrue();
    expect(isUnavailableInCountry(missing)).toBeFalse();
    expect(isUnavailableInCountry(new Error('offline'))).toBeFalse();
    expect(httpStatus(missing)).toBe(404);
    expect(httpStatus('nope')).toBeNull();
  });
});
