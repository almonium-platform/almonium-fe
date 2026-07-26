import {TestBed} from '@angular/core/testing';
import {LocalStorageService} from '../../../services/local-storage.service';
import {ReaderPosition} from './reader-position.model';
import {ReaderPositionStorage} from './reader-position-storage.service';

describe('ReaderPositionStorage', () => {
  let localStorage: LocalStorageService;
  let storage: ReaderPositionStorage;

  const position: ReaderPosition = {
    version: 1,
    scrollTop: 731,
    scrollHeight: 2000,
    clientWidth: 800,
    percentage: 48.7,
    anchor: {path: [2, 4], offset: 17},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage = TestBed.inject(LocalStorageService);
    storage = TestBed.inject(ReaderPositionStorage);
    localStorage.saveItem('user_info', {id: 'reader-1'});
  });

  afterEach(() => window.localStorage.clear());

  it('keeps precise positions separate for each reader presentation', () => {
    storage.save(12, 'base', position);
    storage.save(12, 'parallel:UK:side', {...position, scrollTop: 900});

    expect(storage.get(12, 'base')).toEqual(position);
    expect(storage.get(12, 'parallel:UK:side')?.scrollTop).toBe(900);
  });

  it('does not expose one user position to another user', () => {
    storage.save(12, 'base', position);
    localStorage.saveItem('user_info', {id: 'reader-2'});

    expect(storage.get(12, 'base')).toBeNull();
  });
});
