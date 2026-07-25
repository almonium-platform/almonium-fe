import {HttpErrorResponse} from '@angular/common/http';
import {AppHttpError} from './app-http-error';
import {getErrorMessage} from './http-error';

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
});
