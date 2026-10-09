import {COUNTRY_CODES, countryOptions, parseRightsReportReceipt, reportMissing} from './rights-report.model';

describe('rights report model', () => {
  const ready = {role: 'READER' as const, email: '', message: 'The author died in 1980.', guest: false};

  it('says the one thing still missing, in the order the form asks for it', () => {
    expect(reportMissing({...ready, role: null})).toBe('Say who you are.');
    expect(reportMissing({...ready, message: '  short  '})).toBe('Describe the problem: 5 more characters at least.');
    expect(reportMissing({...ready, message: 'x'.repeat(4001)})).toBe('Shorten the message to 4000 characters.');
    expect(reportMissing(ready)).toBeNull();
  });

  it('asks a guest for an email it can answer, and never a member', () => {
    expect(reportMissing({...ready, guest: true})).toBe('Leave your email so we can answer.');
    expect(reportMissing({...ready, guest: true, email: 'not-an-address'})).toBe('Check the email address.');
    expect(reportMissing({...ready, guest: true, email: 'holder@example.com'})).toBeNull();
    expect(reportMissing({...ready, guest: false, email: 'not-an-address'})).toBeNull();
  });

  it('names every country in the interface language, sorted by name', () => {
    const options = countryOptions('en', ['UA', 'DE', 'AT']);
    expect(options).toEqual([{code: 'AT', name: 'Austria'}, {code: 'DE', name: 'Germany'}, {code: 'UA', name: 'Ukraine'}]);
    expect(COUNTRY_CODES.length).toBe(249);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('reads the receipt', () => {
    expect(parseRightsReportReceipt({id: 'r1', contact: 'copyright@almonium.com'})).toEqual({id: 'r1', contact: 'copyright@almonium.com'});
  });
});
