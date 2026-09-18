import {UrlSegment} from '@angular/router';
import {certificatePageMatcher} from './certificate-page.matcher';
import {certificatePath} from './certificate.model';

function segments(path: string): UrlSegment[] {
  return path.split('/').filter(Boolean).map(part => new UrlSegment(part, {}));
}

describe('certificatePageMatcher', () => {
  it('reads the reader and the edition out of /read/@name/slug', () => {
    const match = certificatePageMatcher(segments('/read/@marta/winnie-the-pooh'));
    expect(match?.posParams?.['username'].path).toBe('marta');
    expect(match?.posParams?.['editionSlug'].path).toBe('winnie-the-pooh');
    expect(match?.consumed.length).toBe(3);
  });

  it('leaves every other address alone', () => {
    expect(certificatePageMatcher(segments('/read'))).toBeNull();
    expect(certificatePageMatcher(segments('/read/marta/winnie-the-pooh'))).toBeNull();
    expect(certificatePageMatcher(segments('/read/@/winnie-the-pooh'))).toBeNull();
    expect(certificatePageMatcher(segments('/read/@marta/winnie-the-pooh/og.png'))).toBeNull();
  });

  it('builds the path the same way it is read', () => {
    const path = certificatePath({username: 'marta', editionSlug: 'winnie-the-pooh'});
    expect(path).toBe('/read/@marta/winnie-the-pooh');
    expect(certificatePageMatcher(segments(path))?.posParams?.['username'].path).toBe('marta');
  });
});
