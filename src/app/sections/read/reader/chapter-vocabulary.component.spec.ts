import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {Subject} from 'rxjs';
import {ReadService} from '../read.service';
import {ChapterVocabulary} from '../chapter-vocabulary.model';
import {ChapterVocabularyComponent} from './chapter-vocabulary.component';

describe('ChapterVocabularyComponent', () => {
  const chapterId = '01989f47-4c2a-7a10-9e5b-751983624a25';
  const word = {lemma: 'lantern', surface: 'lanterns', context: 'Two lanterns burned.', blockId: 'c11.p1'};
  const data: ChapterVocabulary = {chapterId, chapterSequence: 11, language: 'en', status: 'ready', words: [word]};

  function setup() {
    const response = new Subject<ChapterVocabulary>();
    const getChapterVocabulary = jasmine.createSpy().and.returnValue(response);
    TestBed.configureTestingModule({imports: [ChapterVocabularyComponent], providers: [provideRouter([]), {provide: ReadService, useValue: {getChapterVocabulary}}]});
    const fixture = TestBed.createComponent(ChapterVocabularyComponent);
    fixture.componentRef.setInput('editionSlug', 'original-en');
    fixture.componentRef.setInput('bookTitle', 'Book');
    fixture.componentRef.setInput('chapterMetadata', {'chapter-11': {id: chapterId, sequence: 11, title: 'V', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: []}});
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    return {fixture, host, response, getChapterVocabulary};
  }

  it('loads only on demand and renders a contextual Discover link', () => {
    const {fixture, host, response, getChapterVocabulary} = setup();
    expect(getChapterVocabulary).toHaveBeenCalledOnceWith('original-en', 11);
    expect(host.textContent).toContain('Loading vocabulary');
    response.next(data);
    fixture.detectChanges();
    expect(host.textContent).toContain('In the text: lanterns');
    expect(host.querySelector('a')?.getAttribute('href')).toContain('context=Two%20lanterns%20burned.');
    expect(host.querySelector('a')?.getAttribute('href')).toContain('chapter=11');
  });
  it('does not let a response for another chapter become a word list', () => {
    const {fixture, host, response} = setup();
    response.next({...data, chapterSequence: 12});
    fixture.detectChanges();
    expect(host.textContent).toContain('Vocabulary could not be loaded');
    expect(host.querySelector('article')).toBeNull();
  });
  it('keeps an empty selection distinct from an unavailable artifact', () => {
    const {fixture, host, response} = setup();
    response.next({...data, words: []});
    fixture.detectChanges();
    expect(host.textContent).toContain('No words from this book');
    response.next({...data, status: 'stale', words: []});
    fixture.detectChanges();
    expect(host.textContent).toContain('Current vocabulary is not available');
  });
  it('keeps reading available on errors and discards requests when the edition changes', () => {
    const {fixture, host, response} = setup();
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(host.textContent).toContain('Your book is still available');
    fixture.componentRef.setInput('editionSlug', 'other-en');
    fixture.detectChanges();
    expect(host.querySelector('section')).toBeNull();
  });
});
