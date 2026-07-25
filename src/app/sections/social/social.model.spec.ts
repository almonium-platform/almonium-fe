import {ApiContractError} from '../../shared/runtime-validation';
import {parsePublicUserProfiles, parseRelatedUserProfiles} from './social.model';

describe('social API validation', () => {
  it('parses user search results from the backend contract', () => {
    expect(parsePublicUserProfiles([{id: 'user-1', username: 'Ada', avatarUrl: 'avatar.png'}]))
      .toEqual([{id: 'user-1', username: 'Ada', avatarUrl: 'avatar.png'}]);
  });

  it('rejects an unknown relationship status', () => {
    expect(() => parseRelatedUserProfiles([{
      id: 'user-1',
      username: 'Ada',
      avatarUrl: 'avatar.png',
      relationshipId: 'relationship-1',
      relationshipStatus: 'MYSTERY',
    }])).toThrowError(ApiContractError);
  });
});
