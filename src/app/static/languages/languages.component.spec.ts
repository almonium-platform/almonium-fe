import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {LanguageCode} from '../../models/language.enum';
import {LANGUAGE_CAPABILITIES} from './language-capabilities';
import {LanguagesComponent} from './languages.component';

describe('language capabilities', () => {
  it('has exactly one row for every language the app lists', () => {
    const codes = LANGUAGE_CAPABILITIES.map(row => row.code);
    expect(codes.length).toBe(Object.values(LanguageCode).length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('never claims a voice follows IPA without naming the engine that was heard', () => {
    for (const row of LANGUAGE_CAPABILITIES) {
      if (row.ipaMatch !== 'untested') {
        expect(row.voice.engine).withContext(row.code).toBeDefined();
      } else {
        expect(row.voice.status).withContext(row.code).toBe('none');
      }
    }
  });

  it('does not call any voice live while word audio is not playable in the app', () => {
    expect(LANGUAGE_CAPABILITIES.filter(row => row.voice.status === 'live').map(row => row.code)).toEqual([]);
  });
});

describe('LanguagesComponent', () => {
  let fixture: ComponentFixture<LanguagesComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [LanguagesComponent], providers: [provideRouter([])]}).compileComponents();
    fixture = TestBed.createComponent(LanguagesComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  const rowNames = () => Array.from(page.querySelectorAll('tbody th'), cell => cell.textContent?.trim() ?? '');

  it('lists every language, largest first', () => {
    expect(rowNames().length).toBe(Object.values(LanguageCode).length);
    expect(rowNames()[0]).toContain('Chinese');
  });

  it('sorts by name when asked', () => {
    const byName = Array.from(page.querySelectorAll<HTMLButtonElement>('.sort button'))[1];
    byName.click();
    fixture.detectChanges();
    const names = rowNames();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names[0].startsWith('A')).toBeTrue();
    expect(byName.getAttribute('aria-pressed')).toBe('true');
  });

  it('can show only the languages that have a voice', () => {
    const filter = page.querySelector<HTMLInputElement>('.filter input')!;
    filter.click();
    fixture.detectChanges();
    const withVoice = LANGUAGE_CAPABILITIES.filter(row => row.voice.status !== 'none').length;
    expect(rowNames().length).toBe(withVoice);
    expect(page.querySelectorAll('tbody .status.none').length).toBeLessThan(rowNames().length * 4);
  });

  it('names the engine and says what it was heard to do', () => {
    const german = Array.from(page.querySelectorAll('tbody tr')).find(row => row.querySelector('th')?.textContent?.includes('German'))!;
    expect(german.textContent).toContain('Google Chirp 3 HD');
    expect(german.textContent).toContain('Sounds and stress');
  });
});
