import {LanguageCode} from '../../models/language.enum';
import {ApiContractError} from '../../shared/runtime-validation';
import {BookImportMetadataStatus, BookImportStatus, parseBookImport} from './book-import.model';

describe('book import API runtime validation', () => {
  const pending = {
    id: '01989f47-4c2a-7a10-9e5b-751983624a25',
    title: 'pride and prejudice',
    author: '',
    description: '',
    language: null,
    publicationYear: null,
    status: 'QUEUED',
    metadataStatus: 'PENDING',
    metadataProvenance: {},
    progress: 0,
    wordCount: 0,
    error: '',
  };

  it('accepts an import whose details have not been detected yet', () => {
    const bookImport = parseBookImport(pending);

    expect(bookImport.language).toBeNull();
    expect(bookImport.status).toBe(BookImportStatus.QUEUED);
    expect(bookImport.metadataStatus).toBe(BookImportMetadataStatus.PENDING);
    expect(bookImport.metadataProvenance).toEqual({});
  });

  it('keeps who supplied each detail', () => {
    const bookImport = parseBookImport({
      ...pending,
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      language: 'EN',
      publicationYear: 1813,
      metadataStatus: 'PROPOSED',
      metadataProvenance: {title: 'source', author: 'ai', language: 'user', publication_year: 'ai'},
    });

    expect(bookImport.language).toBe(LanguageCode.EN);
    expect(bookImport.metadataProvenance).toEqual({title: 'source', author: 'ai', language: 'user', publication_year: 'ai'});
  });

  it('rejects an unknown provenance', () => {
    expect(() => parseBookImport({...pending, metadataProvenance: {title: 'guess'}})).toThrowError(ApiContractError);
  });
});
