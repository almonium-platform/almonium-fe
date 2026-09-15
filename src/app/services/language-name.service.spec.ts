import {LanguageNameService} from './language-name.service';
import {LanguageCode} from '../models/language.enum';

describe('LanguageNameService', () => {
  const service = new LanguageNameService();

  it('removes ISO macrolanguage annotations from display names', () => {
    expect(service.getLanguageName('DOI')).toBe('Dogri');
  });

  it('still resolves a normalized display name back to its code', () => {
    expect(service.getLanguageCode('Dogri')).toBe(LanguageCode.DOI);
  });
});
