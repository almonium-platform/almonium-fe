import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';

import {BookCoverComponent} from './book-cover.component';

describe('BookCoverComponent', () => {
  let fixture: ComponentFixture<BookCoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [BookCoverComponent]}).compileComponents();
    fixture = TestBed.createComponent(BookCoverComponent);
    fixture.componentRef.setInput('title', 'Frankenstein');
    fixture.componentRef.setInput('author', 'Mary Shelley');
    fixture.componentRef.setInput('workSlug', 'frankenstein');
  });

  it('renders a typographic fallback when there is no cover URL', () => {
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.debugElement.query(By.css('.typographic-cover'))).not.toBeNull();
    expect(element.textContent).toContain('Frankenstein');
    expect(element.textContent).toContain('Mary Shelley');
  });

  it('falls back when an external cover fails to load', () => {
    fixture.componentRef.setInput('coverUrl', 'https://example.test/missing.jpg');
    fixture.detectChanges();
    fixture.debugElement.query(By.css('img')).triggerEventHandler('error');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.typographic-cover'))).not.toBeNull();
  });
});
