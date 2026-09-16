import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {ReadService} from '../read.service';
import {ChapterVocabulary, ChapterWord} from '../chapter-vocabulary.model';
import {ChapterVocabularyComponent} from './chapter-vocabulary.component';

describe('ChapterVocabularyComponent', () => {
  const chapterId = '01989f47-4c2a-7a10-9e5b-751983624a25';
  const word: ChapterWord = {lemma: 'lantern', surface: 'lanterns', context: 'Two lanterns burned. Then dark.', blockId: 'c11.p1'};
  const data: ChapterVocabulary = {chapterId, chapterSequence: 11, language: 'en', status: 'ready', words: [word]};
  const chapters = [
    {id: chapterId, sequence: 10, title: 'CHAPTER IV.', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: []},
    {id: chapterId, sequence: 11, title: 'CHAPTER V.', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: []},
  ];

  function setup(variant: 'rail' | 'end' = 'rail') {
    const response = new Subject<ChapterVocabulary>();
    const getChapterVocabulary = jasmine.createSpy().and.returnValue(response);
    TestBed.configureTestingModule({imports: [ChapterVocabularyComponent], providers: [{provide: ReadService, useValue: {getChapterVocabulary}}]});
    const fixture = TestBed.createComponent(ChapterVocabularyComponent);
    fixture.componentRef.setInput('editionSlug', 'original-en');
    fixture.componentRef.setInput('sequence', 11);
    fixture.componentRef.setInput('chapters', chapters);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return {fixture, host, response, getChapterVocabulary};
  }

  it('follows the chapter being read and makes each row the word, its form and its sentence', () => {
    const {fixture, host, response, getChapterVocabulary} = setup();
    expect(getChapterVocabulary).toHaveBeenCalledOnceWith('original-en', 11);
    expect(host.textContent).toContain('Loading the words');
    response.next(data);
    fixture.detectChanges();
    expect(host.querySelector('.vocab__lemma')?.textContent).toBe('lantern');
    expect(host.querySelector('.vocab__form')?.textContent).toBe('lanterns');
    expect(host.querySelector('.vocab__excerpt')?.textContent).toBe('Two lanterns burned.');
    expect(host.querySelector('.vocab__excerpt mark')?.textContent).toBe('lanterns');
    expect(host.textContent).toContain('Chapter V');
    expect(host.textContent).toContain('1 word');
    const picked = jasmine.createSpy();
    fixture.componentInstance.wordPicked.subscribe(picked);
    host.querySelector<HTMLButtonElement>('.vocab__row')!.click();
    expect(picked).toHaveBeenCalledOnceWith(word);
  });

  it('does not show the form twice when it is the lemma, and marks a kept word', () => {
    const {fixture, host, response} = setup();
    fixture.componentRef.setInput('savedEntries', new Set(['dreary']));
    response.next({...data, words: [{lemma: 'dreary', surface: 'dreary', context: 'A dreary night.', blockId: 'c11.p2'}]});
    fixture.detectChanges();
    expect(host.querySelector('.vocab__form')).toBeNull();
    expect(host.querySelector('.vocab__saved')?.textContent).toBe('Saved');
  });

  it('looks ahead or back through the chapters without leaving the page', () => {
    const {fixture, host, response, getChapterVocabulary} = setup();
    response.next(data);
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('[aria-label="Words from the previous chapter"]')!.click();
    expect(getChapterVocabulary).toHaveBeenCalledWith('original-en', 10);
    fixture.detectChanges();
    expect(host.textContent).toContain('Chapter IV');
  });

  it('does not let a response for another chapter become a word list', () => {
    const {fixture, host, response} = setup();
    response.next({...data, chapterSequence: 12});
    fixture.detectChanges();
    expect(host.textContent).toContain('could not be loaded');
    expect(host.querySelector('.vocab__row')).toBeNull();
  });

  it('says in one line when the words are not ready, and is absent when there are none to have', () => {
    const {fixture, host, response} = setup();
    response.next({...data, status: 'stale', words: []});
    fixture.detectChanges();
    expect(host.textContent).toContain('Words for this chapter aren’t ready yet');
    response.next({...data, status: 'unavailable', words: []});
    fixture.detectChanges();
    expect(host.querySelector('.vocab')).toBeNull();
  });

  it('keeps reading available on errors and offers another try', () => {
    const {fixture, host, response} = setup();
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(host.textContent).toContain('could not be loaded');
    expect(host.querySelector('.vocab__more')?.textContent).toContain('Try again');
  });

  it('shows five rows at the chapter end and the rest in place', () => {
    const {fixture, host, response} = setup('end');
    const words = Array.from({length: 7}, (_, index) => ({...word, lemma: `word${index}`, blockId: `c11.p${index}`}));
    response.next({...data, words});
    fixture.detectChanges();
    expect(host.querySelectorAll('.vocab__row').length).toBe(5);
    expect(host.textContent).toContain('7 of the book’s useful words occur here.');
    const more = host.querySelector<HTMLButtonElement>('.vocab__more')!;
    expect(more.textContent).toContain('All 7 words');
    more.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.vocab__row').length).toBe(7);
    expect(host.querySelector('.vocab__close')).toBeNull();
  });
});
