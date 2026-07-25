import {ApiContractError} from '../runtime-validation';
import {parseUserProfileInfo} from './user-profile.model';

describe('user profile API validation', () => {
  const profile = {
    id: 'user-1', username: 'Ada', avatarUrl: 'avatar.png', registeredAt: '2026-01-01T00:00:00Z',
    isPremium: false, hidden: false, interests: ['Languages'], loginStreak: 3, fluentLangs: ['EN'],
    targetLangs: [{language: 'FR', cefrLevel: 'A2'}], relationshipId: null,
    relationshipStatus: 'STRANGER', acceptsRequests: true,
  };

  it('parses the backend profile contract', () => {
    expect(parseUserProfileInfo(profile).username).toBe('Ada');
  });

  it('rejects an invalid profile relationship state', () => {
    expect(() => parseUserProfileInfo({...profile, relationshipStatus: 'UNKNOWN'}))
      .toThrowError(ApiContractError);
  });
});
