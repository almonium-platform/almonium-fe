import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject, of} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {LanguageApiService} from '../../../services/language-api.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {UserInfoService} from '../../../services/user-info.service';
import {LanguageRhythm, Rhythm, RhythmWeek} from '../rhythm.model';
import {RhythmService} from '../rhythm.service';
import {HarnessComponent} from './harness.component';

describe('HarnessComponent', () => {
  const monday = (weeksAgo: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) - weeksAgo * 7);
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  };

  const week = (weeksAgo: number, minutes: number, daysMet: number, frozen = false): RhythmWeek => ({
    weekStart: monday(weeksAgo),
    daysMet,
    met: !frozen && daysMet >= 2,
    frozen,
    days: [{date: monday(weeksAgo), minutes, met: daysMet > 0}],
  });

  const rhythmOf = (overrides: Partial<LanguageRhythm>, weeks: RhythmWeek[]): Rhythm => ({
    languages: [{
      language: LanguageCode.EN,
      target: 2,
      editable: true,
      startedAt: monday(11),
      setAsideAt: null,
      firstSessionAt: monday(11),
      frozenPace: null,
      weeks,
      ...overrides,
    }],
  });

  function render(rhythm: Rhythm): ComponentFixture<HarnessComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {provide: RhythmService, useValue: {rhythm, rhythm$: new BehaviorSubject(rhythm), load: () => of(rhythm)}},
        {
          provide: TargetLanguageDropdownService,
          useValue: {
            currentLanguage$: new BehaviorSubject(LanguageCode.EN),
            langColors$: new BehaviorSubject({EN: '#5A1A74'}),
          },
        },
        {provide: LanguageNameService, useValue: {getLanguageName: () => 'English'}},
        {provide: LanguageApiService, useValue: {}},
        {provide: UserInfoService, useValue: {}},
      ],
    });
    const fixture = TestBed.createComponent(HarnessComponent);
    fixture.detectChanges();
    return fixture;
  }

  const twelveActive = Array.from({length: 12}, (_, index) => week(11 - index, index === 5 ? 0 : 60, index === 5 ? 0 : 3));

  it('draws twelve weeks and names how many met the bar', () => {
    const element = render(rhythmOf({}, twelveActive)).nativeElement as HTMLElement;

    expect(element.querySelectorAll('.week').length).toBe(12);
    expect(element.querySelector('.record-summary')?.textContent)
      .toContain('Eleven of the last Twelve weeks met your target of two sessions');
    expect(element.querySelector('.record-summary')?.textContent).toContain('Tint shows time learning, not a score');
    expect(element.querySelector('.record-foot')?.textContent).toContain('Twice a week');
  });

  it('deepens the tint with time learning and leaves a blank week at no level', () => {
    const weeks = [week(1, 300, 3), week(0, 0, 0)];
    const element = render(rhythmOf({}, weeks)).nativeElement as HTMLElement;
    const drawn = element.querySelectorAll('.week');

    expect(drawn[0].classList).toContain('level-5');
    expect(drawn[1].classList).toContain('level-0');
  });

  it('hatches the weeks since a language was set aside and offers to bring it back', () => {
    const weeks = [week(2, 60, 3), week(1, 0, 0, true), week(0, 0, 0, true)];
    const element = render(
      rhythmOf({editable: false, setAsideAt: monday(1), firstSessionAt: monday(2)}, weeks),
    ).nativeElement as HTMLElement;

    expect(element.querySelectorAll('.week.frozen').length).toBe(2);
    expect(element.querySelector('.record-language')?.textContent).toContain('set aside');
    expect(element.querySelector('.record-summary')?.textContent).toContain('The weeks since are not counted against you');
    expect(element.querySelector('.link')?.textContent).toContain('Make active');
  });

  it('asks for no commitment before there is anything to measure', () => {
    const weeks = Array.from({length: 12}, (_, index) => week(11 - index, 0, 0));
    const element = render(rhythmOf({target: null, firstSessionAt: null}, weeks)).nativeElement as HTMLElement;

    expect(element.querySelector('.record-foot')).toBeNull();
    expect(element.querySelector('.record-summary')?.textContent)
      .toContain('You can set a target once there is something to measure');
  });

  it('opens the panel in place, keeping the weeks behind it', () => {
    const fixture = render(rhythmOf({}, twelveActive));
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.link')!.click();
    fixture.detectChanges();

    expect(element.querySelector('.weeks')?.classList).toContain('behind');
    expect(element.querySelectorAll('.week').length).toBe(12);
    expect(element.querySelector('.panel-title')?.textContent).toContain('How often is a good week?');
    expect([...element.querySelectorAll('.choice-copy > span')].map(label => label.textContent?.trim()))
      .toEqual(['Once a week', 'Twice a week', 'Four times a week', 'No target']);
    expect(element.querySelector('.choice-copy small')?.textContent).toContain('Keep the record, drop the bar');
    expect(element.querySelector('.choice.selected')?.textContent).toContain('Twice a week');
  });
});
