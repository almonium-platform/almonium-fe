import {HttpResponse} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {BehaviorSubject, Subject, of} from 'rxjs';

import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {UserInfoService} from '../../../services/user-info.service';
import {ParallelModeService} from '../parallel-mode.service';
import {ReadService} from '../read.service';
import {ReaderComponent} from './reader.component';
import {ReaderDomService} from './reader-dom.service';
import {ReaderProgressTracker} from './reader-progress-tracker.service';

describe('ReaderComponent', () => {
  let fixture: ComponentFixture<ReaderComponent>;
  let baseResponse$: Subject<HttpResponse<ArrayBuffer>>;

  beforeEach(async () => {
    baseResponse$ = new Subject<HttpResponse<ArrayBuffer>>();

    await TestBed.configureTestingModule({
      imports: [ReaderComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {paramMap: of(convertToParamMap({slug: 'modern-flirtations'}))},
        },
        {
          provide: ReadService,
          useValue: {
            getPublicBook: () => of({
              id: '01989f47-4c2a-7a10-9e5b-751983624a25',
              language: 'EN',
              languageVariants: [],
            }),
            loadPublicBook: () => baseResponse$,
          },
        },
        {provide: ParallelModeService, useValue: {mode$: new BehaviorSubject('inline')}},
        {provide: PopupTemplateStateService, useValue: {open: () => undefined}},
        {provide: UserInfoService, useValue: {currentUserInfo: null}},
      ],
    })
      .overrideComponent(ReaderComponent, {
        set: {
          providers: [
            ReaderDomService,
            {provide: ReaderProgressTracker, useValue: {}},
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReaderComponent);
  });

  it('schedules chapter measurement after asynchronous base content arrives', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      scheduleChapterOffsetMeasurement(): void;
    };
    const scheduleMeasurement = spyOn(component, 'scheduleChapterOffsetMeasurement');

    const body = new TextEncoder().encode(
      '<section class="chapter"><h2 class="chapter-title" id="chapter-0">Chapter 1</h2></section>',
    ).buffer;
    baseResponse$.next(new HttpResponse({status: 200, body}));

    expect(scheduleMeasurement).toHaveBeenCalledTimes(1);
  });

  it('keeps a chapter navigation entry point visible when parallel text is active', () => {
    fixture.detectChanges();
    const body = new TextEncoder().encode(`
      <section class="chapter"><h2 class="chapter-title" id="chapter-0">Opening</h2><p>Text</p></section>
      <section class="chapter"><h2 class="chapter-title" id="chapter-1">The road</h2><p>More text</p></section>
    `).buffer;
    baseResponse$.next(new HttpResponse({status: 200, body}));
    fixture.detectChanges();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance as unknown as {
      isParallelViewActive: boolean;
      cdRef: {markForCheck(): void};
      selectChapter(index: number): void;
    };
    const chapterButtons = host.querySelectorAll<HTMLButtonElement>('.content-map button');
    expect(chapterButtons.length).toBe(2);
    const readingLayout = host.querySelector('.reader-reading-layout');
    expect(readingLayout?.classList.contains('has-content-map')).toBeTrue();
    expect(readingLayout?.querySelector(':scope > .content-map')).not.toBeNull();
    expect(readingLayout?.querySelector(':scope > .reader-content')).not.toBeNull();
    const selectChapter = spyOn(component, 'selectChapter');
    chapterButtons[1].click();
    expect(selectChapter).toHaveBeenCalledOnceWith(1);

    component.isParallelViewActive = true;
    component.cdRef.markForCheck();
    fixture.detectChanges();

    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Open chapter navigation"]');
    expect(host.querySelector('.content-map')).toBeNull();
    expect(trigger).not.toBeNull();
    expect(trigger?.closest('.chapter-nav-container')?.classList.contains('parallel-content-map')).toBeTrue();
  });
});
