import {TestBed} from '@angular/core/testing';
import {isSafePath, ReturnPathService} from './return-path.service';

describe('ReturnPathService', () => {
  let service: ReturnPathService;

  beforeEach(() => {
    sessionStorage.clear();
    service = TestBed.inject(ReturnPathService);
  });

  it('keeps a same-origin path until it is consumed', () => {
    service.remember('/d/8fk2qaZZ');
    expect(service.peek()).toBe('/d/8fk2qaZZ');
    expect(service.consume()).toBe('/d/8fk2qaZZ');
    expect(service.peek()).toBeNull();
  });

  it('refuses anything that could leave the site', () => {
    service.remember('https://evil.example/d/x');
    service.remember('//evil.example');
    expect(service.peek()).toBeNull();
    expect(isSafePath('/c/abc')).toBeTrue();
    expect(isSafePath('/d/x y')).toBeFalse();
  });
});
