import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {of, throwError} from 'rxjs';
import {AppHttpError} from '../../../shared/app-http-error';
import {RightsReportComponent} from './rights-report.component';
import {RightsReportService} from './rights-report.service';

describe('RightsReportComponent', () => {
  function setup(guest: boolean) {
    const report = jasmine.createSpy('report').and.returnValue(of({id: 'r1', contact: 'copyright@almonium.com'}));
    TestBed.configureTestingModule({imports: [RightsReportComponent], providers: [{provide: RightsReportService, useValue: {report}}]});
    const fixture = TestBed.createComponent(RightsReportComponent);
    fixture.componentRef.setInput('editionSlug', 'lolita-original-en');
    fixture.componentRef.setInput('guest', guest);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const fill = (selector: string, value: string) => {
      const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
      fixture.detectChanges();
    };
    const pick = (index: number) => {
      host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index].click();
      fixture.detectChanges();
    };
    const send = () => host.querySelector<HTMLButtonElement>('.sheet__primary')!;
    return {fixture, host, report, fill, pick, send};
  }

  it('keeps Send greyed with a line saying what is missing, then sends a guest’s report with their email', () => {
    const {fixture, host, report, fill, pick, send} = setup(true);
    expect(send().disabled).toBeTrue();
    expect(host.querySelector('.sheet__hint')?.textContent).toBe('Say who you are.');
    pick(0);
    fill('textarea', 'I represent the Nabokov estate.');
    expect(host.querySelector('.sheet__hint')?.textContent).toBe('Leave your email so we can answer.');
    fill('input[type="email"]', 'estate@example.com');
    fill('input[type="text"]', '  Dmitri  ');
    fill('select', 'US');
    expect(send().disabled).toBeFalse();
    expect(host.querySelector('.sheet__hint')).toBeNull();
    send().click();
    fixture.detectChanges();
    expect(report).toHaveBeenCalledOnceWith('lolita-original-en', {
      role: 'RIGHTS_HOLDER', country: 'US', message: 'I represent the Nabokov estate.', name: 'Dmitri', email: 'estate@example.com',
    });
    expect(host.textContent).toContain('Thanks — we’ll look at this within a day. You can also write to copyright@almonium.com.');
  });

  it('does not ask a member for an email, and reports for everywhere by default', () => {
    const {fixture, host, report, fill, pick, send} = setup(false);
    expect(host.querySelector('input[type="email"]')).toBeNull();
    expect(host.querySelector<HTMLSelectElement>('select')!.value).toBe('');
    pick(1);
    fill('textarea', 'This was published in 1960.');
    send().click();
    fixture.detectChanges();
    expect(report).toHaveBeenCalledOnceWith('lolita-original-en', {role: 'READER', country: '', message: 'This was published in 1960.'});
  });

  it('says plainly when one address has sent too many', () => {
    const {fixture, host, report, fill, pick, send} = setup(false);
    report.and.returnValue(throwError(() => new AppHttpError(new HttpErrorResponse({status: 429, error: {message: 'Too many reports; try again later.'}}))));
    pick(2);
    fill('textarea', 'Something is off here.');
    send().click();
    fixture.detectChanges();
    expect(host.querySelector('.sheet__error')?.textContent).toBe('Too many reports from here; try again in an hour.');
    expect(send().disabled).toBeFalse();
  });

  it('closes on Cancel', () => {
    const {fixture, host} = setup(true);
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);
    host.querySelector<HTMLButtonElement>('.sheet__quiet')!.click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
